import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';
import Stripe from 'stripe';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id                 TEXT PRIMARY KEY,   -- Stripe event id ("evt_xxx")
  event_type         TEXT,
  livemode           BOOLEAN NOT NULL DEFAULT false,
  status             TEXT NOT NULL DEFAULT 'processing',
  started_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at       TIMESTAMPTZ,
  failed_at          TIMESTAMPTZ,
  expire_at          TIMESTAMPTZ,
  retry_count        INTEGER NOT NULL DEFAULT 0,
  last_reclaimed_at  TIMESTAMPTZ,
  last_error         TEXT,
  last_error_stack   TEXT,
  total_attempts     INTEGER,
  payload            JSONB
);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_status_expire
  ON stripe_webhook_events (status, expire_at);

CREATE TABLE IF NOT EXISTS market_insights (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data       JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_insights_created ON market_insights (created_at DESC);
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initSharedOpsPgSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getMagazinePgPool();
      if (!pool) return;
      await pool.query(SCHEMA_SQL);
      schemaReady = true;
    })();
  }
  await schemaPromise;
}

async function ready(): Promise<boolean> {
  try {
    await initSharedOpsPgSchema();
    return getMagazinePgPool() !== null;
  } catch (err) {
    console.warn('[shared-ops-pg] schema init failed:', err);
    return false;
  }
}

const OUTCOME_TTL_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const PROCESSING_STALE_MS = 15 * 1000;

export type StripeWebhookStatus =
  | 'processing'
  | 'processed'
  | 'failed_retryable'
  | 'failed_permanent';

export interface StripeWebhookEvent {
  id: string;
  eventType?: string;
  livemode?: boolean;
  status: StripeWebhookStatus;
  startedAt?: string;
  createdAt?: string;
  processedAt?: string;
  failedAt?: string;
  expireAt?: string;
  retryCount: number;
  lastReclaimedAt?: string;
  lastError?: string;
  lastErrorStack?: string;
  totalAttempts?: number;
}

export type StripeClaimResult =
  | { outcome: 'claim'; retryCount: number }
  | { outcome: 'duplicate'; status?: StripeWebhookStatus };

export class PgStripeWebhookEventStore {
  async claimProcessing(event: { id: string; type: string; livemode?: boolean }): Promise<StripeClaimResult> {
    const livemode = event.livemode === true;
    if (!(await ready())) {
      throw new Error('[stripe-webhook-store] Postgres not ready');
    }
    const pool = getMagazinePgPool()!;
    const expireAt = new Date(Date.now() + OUTCOME_TTL_INTERVAL_MS);
    const startedAt = new Date();

    // 1. Brand new event: claim it atomically.
    const claimInsert = await pool.query(
      `INSERT INTO stripe_webhook_events
         (id, event_type, livemode, status, started_at, created_at, expire_at, retry_count)
       VALUES ($1,$2,$3,'processing',$4,NOW(),$5,0)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, retry_count;`,
      [event.id, event.type, livemode, startedAt, expireAt],
    );
    if (claimInsert.rows.length === 1) {
      return { outcome: 'claim', retryCount: 0 };
    }

    // 2. Event exists already. Is it terminal (processed / failed_perm)?
    const cur = await pool.query(
      `SELECT id, status, started_at, retry_count
         FROM stripe_webhook_events WHERE id = $1`,
      [event.id],
    );
    const row = cur.rows[0];
    if (!row) {
      throw new Error(`[stripe-webhook-store] claim failed — event ${event.id} missing after conflict`);
    }
    if (row.status === 'processed' || row.status === 'failed_permanent') {
      return { outcome: 'duplicate', status: row.status as StripeWebhookStatus };
    }
    if (row.status === 'processing') {
      // 3. Reclaim stale processing.
      const staleIntervalMs = PROCESSING_STALE_MS;
      const reclaim = await pool.query(
        `UPDATE stripe_webhook_events
            SET status = 'processing',
                started_at = NOW(),
                retry_count = retry_count + 1,
                expire_at = $2::timestamptz,
                last_reclaimed_at = NOW()
          WHERE id = $1
            AND status = 'processing'
            AND (started_at IS NULL OR started_at < NOW() - ($3 || ' milliseconds')::interval)
          RETURNING retry_count`,
        [event.id, expireAt, staleIntervalMs],
      );
      if (reclaim.rows.length === 1) {
        const nextRetry = Number(reclaim.rows[0].retry_count);
        return { outcome: 'claim', retryCount: nextRetry };
      }
      return { outcome: 'duplicate', status: 'processing' };
    }
    if (row.status === 'failed_retryable') {
      // 4. Retryable — accept the retry as a fresh claim, bump retry_count.
      const reclaimRetry = await pool.query(
        `UPDATE stripe_webhook_events
            SET status = 'processing',
                started_at = NOW(),
                retry_count = retry_count + 1,
                expire_at = $2::timestamptz
          WHERE id = $1
            AND status = 'failed_retryable'
          RETURNING retry_count`,
        [event.id, expireAt],
      );
      const nextRetry = Number(reclaimRetry.rows[0]?.retry_count ?? (Number(row.retry_count ?? 0) + 1));
      return { outcome: 'claim', retryCount: nextRetry };
    }
    return { outcome: 'duplicate', status: row.status as StripeWebhookStatus };
  }

  async markProcessed(eventId: string): Promise<void> {
    if (!(await ready())) return;
    const now = new Date();
    const expireAt = new Date(Date.now() + OUTCOME_TTL_INTERVAL_MS);
    try {
      const pool = getMagazinePgPool()!;
      await pool.query(
        `UPDATE stripe_webhook_events
            SET status = 'processed', processed_at = $2, expire_at = $3
          WHERE id = $1`,
        [eventId, now, expireAt],
      );
    } catch (err) {
      console.warn(`[stripe-webhook-store] markProcessed(${eventId}) PG failed:`, err);
    }
  }

  async markFailed(
    eventId: string,
    opts: { errorMessage: string; errorStack?: string; permanent: boolean; totalAttempts: number },
  ): Promise<void> {
    if (!(await ready())) return;
    const now = new Date();
    const expireAt = new Date(Date.now() + OUTCOME_TTL_INTERVAL_MS);
    const status: StripeWebhookStatus = opts.permanent ? 'failed_permanent' : 'failed_retryable';
    try {
      const pool = getMagazinePgPool()!;
      await pool.query(
        `UPDATE stripe_webhook_events
            SET status           = $2::text,
                failed_at        = $3,
                last_error       = $4,
                last_error_stack = $5,
                total_attempts   = $6,
                expire_at        = $7
          WHERE id = $1`,
        [
          eventId,
          status,
          now,
          opts.errorMessage?.slice(0, 8000) ?? null,
          opts.errorStack?.slice(0, 16000) ?? null,
          Number.isFinite(opts.totalAttempts) ? opts.totalAttempts : null,
          expireAt,
        ],
      );
    } catch (err) {
      console.warn(`[stripe-webhook-store] markFailed(${eventId}) PG failed:`, err);
    }
  }

  async get(eventId: string): Promise<StripeWebhookEvent | null> {
    if (!(await ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT id, event_type, livemode, status, started_at, created_at,
                processed_at, failed_at, expire_at, retry_count,
                last_reclaimed_at, last_error, last_error_stack, total_attempts
           FROM stripe_webhook_events WHERE id = $1`,
        [eventId],
      );
      const r = rows[0];
      if (!r) return null;
      const iso = (v: unknown): string | undefined =>
        v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : undefined;
      return {
        id: r.id,
        eventType: typeof r.event_type === 'string' ? r.event_type : undefined,
        livemode: typeof r.livemode === 'boolean' ? r.livemode : undefined,
        status: (r.status as StripeWebhookStatus) ?? 'processing',
        startedAt: iso(r.started_at),
        createdAt: iso(r.created_at),
        processedAt: iso(r.processed_at),
        failedAt: iso(r.failed_at),
        expireAt: iso(r.expire_at),
        retryCount: Number.isFinite(r.retry_count) ? Number(r.retry_count) : 0,
        lastReclaimedAt: iso(r.last_reclaimed_at),
        lastError: typeof r.last_error === 'string' ? r.last_error : undefined,
        lastErrorStack: typeof r.last_error_stack === 'string' ? r.last_error_stack : undefined,
        totalAttempts: Number.isFinite(r.total_attempts) ? Number(r.total_attempts) : undefined,
      };
    } catch (err) {
      console.warn(`[stripe-webhook-store] get(${eventId}) PG failed:`, err);
      return null;
    }
  }

  async storePayload(event: Stripe.Event): Promise<void> {
    if (!(await ready())) return;
    try {
      const pool = getMagazinePgPool()!;
      await pool.query(
        `UPDATE stripe_webhook_events SET payload = $2::jsonb WHERE id = $1`,
        [event.id, JSON.stringify(event)],
      );
    } catch (err) {
      console.warn('[stripe-webhook-store] storePayload PG write failed:', err);
    }
  }
}

let _stripeSingleton: PgStripeWebhookEventStore | null = null;
export function getStripeWebhookEventStore(): PgStripeWebhookEventStore {
  if (!_stripeSingleton) _stripeSingleton = new PgStripeWebhookEventStore();
  return _stripeSingleton;
}

export interface MarketInsightPoint {
  summary: string;
  fullText: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface MarketInsight {
  id: string;
  title: string;
  points: MarketInsightPoint[];
  createdAt: string;
}

export class PgMarketInsightStore {
  async save(insight: Omit<MarketInsight, 'id'>): Promise<MarketInsight> {
    if (!(await ready())) {
      throw new Error('[market-insight-store] Postgres not ready');
    }
    const createdAtIso = typeof insight.createdAt === 'string' && insight.createdAt
      ? insight.createdAt
      : new Date().toISOString();
    const id =
      [...Array(20)]
        .map(() =>
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
            Math.floor(Math.random() * 62)
          ],
        )
        .join('');
    const saved: MarketInsight = {
      id,
      title: insight.title,
      points: insight.points ?? [],
      createdAt: createdAtIso,
    };
    const pool = getMagazinePgPool()!;
    try {
      await pool.query(
        `INSERT INTO market_insights (id, title, created_at, data)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           created_at = COALESCE(EXCLUDED.created_at, market_insights.created_at),
           data = EXCLUDED.data`,
        [id, saved.title.slice(0, 500), createdAtIso, JSON.stringify(saved)],
      );
    } catch (err) {
      console.warn('[market-insight-store] save PG write failed:', err);
      throw err;
    }
    return saved;
  }
}

let _insightSingleton: PgMarketInsightStore | null = null;
export function getMarketInsightStore(): PgMarketInsightStore {
  if (!_insightSingleton) _insightSingleton = new PgMarketInsightStore();
  return _insightSingleton;
}

export const _internals = {
  pgSchemaReady: () => schemaReady,
  OUTCOME_TTL_INTERVAL_MS,
  PROCESSING_STALE_MS,
};
