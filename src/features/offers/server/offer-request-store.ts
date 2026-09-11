import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS offer_requests (
  id               TEXT PRIMARY KEY,
  status           TEXT,
  is_members_only  BOOLEAN NOT NULL DEFAULT true,
  user_id          TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  data             JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offer_requests_status_created ON offer_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_requests_created       ON offer_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_requests_user          ON offer_requests (user_id);
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initOfferPgSchema(): Promise<void> {
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

export type OfferStatus = 'active' | 'pending' | 'expired' | string;

export interface OfferRequestRecord {
  id: string;
  status?: OfferStatus;
  isMembersOnly?: boolean;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  data: Record<string, unknown>;
}

type ListOpts = {
  status?: OfferStatus;
  orderCreatedDesc?: boolean;
  limit?: number;
};

function toOffer(row: undefined | {
  id: string;
  status: unknown;
  is_members_only: unknown;
  user_id: unknown;
  created_at: unknown;
  updated_at: unknown;
  data: unknown;
}): OfferRequestRecord | null {
  if (!row) return null;
  const dataRaw = row.data ?? {};
  const data =
    dataRaw && typeof dataRaw === 'object' ? (dataRaw as Record<string, unknown>) : {};
  const status = typeof row.status === 'string' ? row.status : undefined;
  const isMembersOnly = typeof row.is_members_only === 'boolean' ? row.is_members_only : undefined;
  const userId = typeof row.user_id === 'string' ? row.user_id : undefined;
  const createdAt =
    typeof row.created_at === 'string'
      ? row.created_at
      : row.created_at instanceof Date
        ? row.created_at.toISOString()
        : undefined;
  const updatedAt =
    typeof row.updated_at === 'string'
      ? row.updated_at
      : row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : undefined;
  return { id: row.id, status, isMembersOnly, userId, createdAt, updatedAt, data };
}

function toTimestampIso(v: unknown): string | null {
  if (typeof v === 'string') return v || null;
  if (v instanceof Date) return v.toISOString();
  return null;
}

export class PgOfferRequestStore {
  private async ready(): Promise<boolean> {
    try {
      await initOfferPgSchema();
      return getMagazinePgPool() !== null;
    } catch (err) {
      console.warn('[PgOfferRequestStore] schema init failed:', err);
      return false;
    }
  }

  async health(): Promise<boolean> {
    return this.ready();
  }

  async create(input: { data: Record<string, unknown> }): Promise<OfferRequestRecord> {
    const data = (input.data && typeof input.data === 'object' ? input.data : {}) as Record<string, unknown>;
    const id =
      (typeof (data as any).id === 'string' && (data as any).id) ||
      [...Array(20)]
        .map(() =>
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
            Math.floor(Math.random() * 62)
          ],
        )
        .join('');

    const createdAt =
      toTimestampIso(data.createdAt) ??
      (typeof (data as any).created_at === 'string' ? (data as any).created_at : null) ??
      new Date().toISOString();
    const status =
      typeof data.status === 'string' && data.status.trim() ? data.status.trim() : 'pending';
    const isMembersOnly =
      typeof data.isMembersOnly === 'boolean'
        ? data.isMembersOnly
        : typeof (data as any).is_members_only === 'boolean'
          ? (data as any).is_members_only
          : true;
    const userId =
      typeof data.userId === 'string' && data.userId
        ? data.userId
        : typeof (data as any).user_id === 'string' && (data as any).user_id
          ? (data as any).user_id
          : undefined;
    const updatedAt = toTimestampIso(data.updatedAt) ?? createdAt;

    const rec: OfferRequestRecord = {
      id,
      status,
      isMembersOnly,
      userId,
      createdAt,
      updatedAt,
      data: { ...data, id },
    };

    if (await this.ready()) {
      try {
        const pool = getMagazinePgPool()!;
        await pool.query(
          `INSERT INTO offer_requests (id, status, is_members_only, user_id, created_at, updated_at, data)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             is_members_only = EXCLUDED.is_members_only,
             user_id = EXCLUDED.user_id,
             created_at = COALESCE(EXCLUDED.created_at, offer_requests.created_at),
             updated_at = EXCLUDED.updated_at,
             data = EXCLUDED.data`,
          [
            rec.id,
            rec.status ?? null,
            rec.isMembersOnly ?? true,
            rec.userId ?? null,
            rec.createdAt ?? null,
            rec.updatedAt ?? null,
            JSON.stringify(rec.data ?? {}),
          ],
        );
      } catch (err) {
        console.warn(`[PgOfferRequestStore] create(${id}) PG write failed:`, err);
        throw err;
      }
    } else {
      throw new Error('[PgOfferRequestStore] Postgres not ready — cannot create offer');
    }
    return rec;
  }

  async get(id: string): Promise<OfferRequestRecord | null> {
    if (!id) return null;
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT id, status, is_members_only, user_id, created_at, updated_at, data FROM offer_requests WHERE id = $1',
        [id],
      );
      return toOffer(rows[0]);
    } catch (err) {
      console.warn(`[PgOfferRequestStore] get(${id}) PG query failed:`, err);
      return null;
    }
  }

  async upsert(rec: OfferRequestRecord): Promise<void> {
    if (!(await this.ready())) {
      throw new Error('[PgOfferRequestStore] Postgres not ready — cannot upsert');
    }
    const pool = getMagazinePgPool()!;
    try {
      await pool.query(
        `INSERT INTO offer_requests (id, status, is_members_only, user_id, created_at, updated_at, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           is_members_only = EXCLUDED.is_members_only,
           user_id = EXCLUDED.user_id,
           created_at = COALESCE(EXCLUDED.created_at, offer_requests.created_at),
           updated_at = EXCLUDED.updated_at,
           data = EXCLUDED.data`,
        [
          rec.id,
          rec.status ?? null,
          rec.isMembersOnly ?? true,
          rec.userId ?? null,
          rec.createdAt ?? null,
          rec.updatedAt ?? new Date().toISOString(),
          JSON.stringify(rec.data ?? {}),
        ],
      );
    } catch (err) {
      console.warn(`[PgOfferRequestStore] upsert(${rec.id}) PG write failed:`, err);
      throw err;
    }
  }

  async patch(id: string, patch: Record<string, unknown>): Promise<void> {
    if (!id) return;
    const now = new Date().toISOString();
    const patchWidened: Record<string, unknown> =
      patch && typeof patch === 'object' ? (patch as Record<string, unknown>) : {};
    const patchWithStamp: Record<string, unknown> = { ...patchWidened, updatedAt: now };
    if (!(await this.ready())) {
      throw new Error('[PgOfferRequestStore] Postgres not ready — cannot patch');
    }
    const existing = await this.get(id);
    const mergedData: Record<string, unknown> = {
      ...(existing?.data ?? {}),
      ...patchWithStamp,
      id,
    };
    const next: OfferRequestRecord = {
      id,
      status: typeof patchWithStamp.status === 'string' ? (patchWithStamp.status as OfferStatus) : existing?.status,
      isMembersOnly:
        typeof patchWithStamp.isMembersOnly === 'boolean'
          ? patchWithStamp.isMembersOnly
          : existing?.isMembersOnly,
      userId:
        typeof patchWithStamp.userId === 'string'
          ? patchWithStamp.userId
          : existing?.userId,
      createdAt: existing?.createdAt ?? toTimestampIso(mergedData.createdAt) ?? now,
      updatedAt: now,
      data: mergedData,
    };
    const pool = getMagazinePgPool()!;
    try {
      await pool.query(
        `INSERT INTO offer_requests (id, status, is_members_only, user_id, created_at, updated_at, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           status = COALESCE(EXCLUDED.status, offer_requests.status),
           is_members_only = COALESCE(EXCLUDED.is_members_only, offer_requests.is_members_only),
           user_id = COALESCE(EXCLUDED.user_id, offer_requests.user_id),
           created_at = COALESCE(offer_requests.created_at, EXCLUDED.created_at),
           updated_at = EXCLUDED.updated_at,
           data = offer_requests.data || '{}'::jsonb || EXCLUDED.data`,
        [
          next.id,
          next.status ?? null,
          next.isMembersOnly ?? true,
          next.userId ?? null,
          next.createdAt ?? null,
          next.updatedAt,
          JSON.stringify(next.data ?? {}),
        ],
      );
    } catch (err) {
      console.warn(`[PgOfferRequestStore] patch(${id}) PG write failed:`, err);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    if (!id) return;
    if (!(await this.ready())) return;
    try {
      const pool = getMagazinePgPool()!;
      await pool.query('DELETE FROM offer_requests WHERE id = $1', [id]);
    } catch (err) {
      console.warn(`[PgOfferRequestStore] delete(${id}) PG delete failed:`, err);
    }
  }

  async list(opts: ListOpts = {}): Promise<OfferRequestRecord[]> {
    const orderCreatedDesc = opts.orderCreatedDesc !== false;
    const status = opts.status;
    const limit = typeof opts.limit === 'number' && opts.limit > 0 ? opts.limit : undefined;

    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const params: unknown[] = [];
      const where: string[] = [];
      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const orderClause = orderCreatedDesc
        ? 'ORDER BY COALESCE(created_at, updated_at) DESC NULLS LAST'
        : 'ORDER BY COALESCE(created_at, updated_at) ASC NULLS LAST';
      params.push(limit ?? 1_000_000);
      const sql = `SELECT id, status, is_members_only, user_id, created_at, updated_at, data
                   FROM offer_requests ${whereClause} ${orderClause} LIMIT $${params.length}`;
      const { rows } = await pool.query(sql, params);
      return rows.map((r) => toOffer(r)).filter((r): r is OfferRequestRecord => r !== null);
    } catch (err) {
      console.warn('[PgOfferRequestStore] list PG query failed:', err);
      return [];
    }
  }
}

let _singleton: PgOfferRequestStore | null = null;

export function getOfferRequestStore(): PgOfferRequestStore {
  if (!_singleton) _singleton = new PgOfferRequestStore();
  return _singleton;
}

export const _internals = {
  pgSchemaReady: () => schemaReady,
};
