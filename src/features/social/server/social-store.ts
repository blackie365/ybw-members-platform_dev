import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';

/**
 * Idempotent schema init for the social auto-post queue.
 *
 * One row per Ghost article, ever. `ghost_post_id` is UNIQUE so an article can
 * never be queued twice — the daily picker simply skips any article that
 * already has a row, whatever its status. A skipped or failed article is
 * re-queued by updating its existing row, never by inserting a second one.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS social_posts (
  id            BIGSERIAL PRIMARY KEY,
  ghost_post_id TEXT NOT NULL UNIQUE,
  slug          TEXT,
  title         TEXT,
  url           TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'skipped', 'failed')),
  caption_fb    TEXT,
  caption_ig    TEXT,
  targets       JSONB NOT NULL DEFAULT '[]'::jsonb,
  queued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at    TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  result        JSONB,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts (status, queued_at DESC);
`;

export type SocialStatus = 'pending' | 'approved' | 'skipped' | 'failed';

export interface SocialQueueRow {
  id: number;
  ghost_post_id: string;
  slug: string | null;
  title: string | null;
  url: string | null;
  status: SocialStatus;
  caption_fb: string | null;
  caption_ig: string | null;
  targets: string[];
  queued_at: string;
  decided_at: string | null;
  published_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

/**
 * Postgres hands BIGINT/BIGSERIAL columns back as strings, so `id` arrives as
 * "2" even though SocialQueueRow types it as a number. The admin screen passes
 * that id straight to the server action, where `Number.isInteger("2")` is
 * false — so every decision was rejected as an invalid queue id. Coerce at the
 * boundary, where the type is declared, rather than at each call site.
 */
function normaliseRow(row: SocialQueueRow): SocialQueueRow {
  return { ...row, id: Number(row.id) };
}

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initSocialPgSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getMagazinePgPool();
      if (!pool) return;
      try {
        await pool.query(SCHEMA_SQL);
        schemaReady = true;
      } catch (err) {
        console.warn(
          '[initSocialPgSchema] schema init failed:',
          err instanceof Error ? err.message : err,
        );
      }
    })();
  }
  await schemaPromise;
}

async function pool() {
  const p = getMagazinePgPool();
  if (!p) return null;
  await initSocialPgSchema();
  return p;
}

/**
 * Which of these Ghost post ids already have a queue row (any status).
 *
 * Best-effort: the picker falls back to "nothing queued" if Postgres is
 * unreachable, because the UNIQUE index on ghost_post_id — not this lookup — is
 * what actually prevents a double post.
 */
export async function getQueuedPostIds(postIds: string[]): Promise<Set<string>> {
  if (!postIds.length) return new Set();
  try {
    const p = await pool();
    if (!p) return new Set();
    const { rows } = await p.query<{ ghost_post_id: string }>(
      `SELECT ghost_post_id FROM social_posts WHERE ghost_post_id = ANY($1::text[])`,
      [postIds],
    );
    return new Set(rows.map((r) => r.ghost_post_id));
  } catch (err) {
    console.warn(
      '[getQueuedPostIds] lookup failed, treating the queue as empty:',
      err instanceof Error ? err.message : err,
    );
    return new Set();
  }
}

export interface InsertQueueInput {
  ghostPostId: string;
  slug: string;
  title: string;
  url: string;
  captionFb: string;
  captionIg: string;
  targets: string[];
}

/**
 * Insert a pending queue row. Returns null when the article already has a row
 * (the daily picker should treat that as "already handled").
 */
export async function insertQueuedPost(input: InsertQueueInput): Promise<SocialQueueRow | null> {
  const p = await pool();
  if (!p) return null;
  const { rows } = await p.query<SocialQueueRow>(
    `INSERT INTO social_posts
       (ghost_post_id, slug, title, url, caption_fb, caption_ig, targets, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending')
     ON CONFLICT (ghost_post_id) DO NOTHING
     RETURNING *`,
    [
      input.ghostPostId,
      input.slug,
      input.title,
      input.url,
      input.captionFb,
      input.captionIg,
      JSON.stringify(input.targets),
    ],
  );
  return rows[0] ? normaliseRow(rows[0]) : null;
}

export async function getSocialPost(id: number): Promise<SocialQueueRow | null> {
  const p = await pool();
  if (!p) return null;
  const { rows } = await p.query<SocialQueueRow>(`SELECT * FROM social_posts WHERE id = $1`, [id]);
  return rows[0] ? normaliseRow(rows[0]) : null;
}

/**
 * Record a decision. Only a `pending` row can be decided, so a double-click on
 * an approval link (or a replayed URL) is a no-op rather than a second post.
 * Returns the row that the caller may act on, or null when nothing was claimed.
 */
export async function claimDecision(
  id: number,
  decision: 'approved' | 'skipped',
): Promise<SocialQueueRow | null> {
  const p = await pool();
  if (!p) return null;
  const { rows } = await p.query<SocialQueueRow>(
    `UPDATE social_posts
        SET status = $2, decided_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [id, decision],
  );
  return rows[0] ? normaliseRow(rows[0]) : null;
}

/** Store the outcome of an approved post (or its failure). */
export async function recordPublishResult(
  id: number,
  outcome: { ok: boolean; result?: unknown; error?: string },
): Promise<void> {
  const p = await pool();
  if (!p) return;
  await p.query(
    `UPDATE social_posts
        SET status = $2,
            published_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE published_at END,
            result = $3::jsonb,
            error = $4
      WHERE id = $1`,
    [
      id,
      outcome.ok ? 'approved' : 'failed',
      JSON.stringify(outcome.result ?? null),
      outcome.error ?? null,
    ],
  );
}

/** Article ids already handled, for the picker's exclusion list. */
export async function recentQueueRows(limit = 10): Promise<SocialQueueRow[]> {
  const p = await pool();
  if (!p) return [];
  const { rows } = await p.query<SocialQueueRow>(
    `SELECT * FROM social_posts ORDER BY queued_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(normaliseRow);
}
