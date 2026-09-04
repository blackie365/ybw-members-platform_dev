import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';

/**
 * Idempotent schema init for the members profile table (migration target that
 * replaces the Firestore `newMemberCollection` pseudo-DB).
 *
 * Design intent (see design notes):
 *  - The full member profile is stored as a JSONB blob under `data` so reads
 *    mirror the previous Firestore document shape without reimplementing
 *    hydration in SQL.
 *  - A handful of helper columns (clerk_id, email, email_lower, member_slug,
 *    is_featured, is_active, created_at, updated_at) exist to serve lookups,
 *    the public directory ordering, featured selection and admin counts.
 *  - Billing/paid-state is NOT stored here as truth: the paid tier is derived
 *    from Ghost (see ghost helpers). Any legacy billing fields copied over are
 *    kept only for audit/transition and are not used for gating.
 *
 * clerk_id is the Clerk user id (document key), the same identity the app has
 * always used. email is the join key to the Ghost member record.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS member_profiles (
  clerk_id     TEXT PRIMARY KEY,
  data         JSONB NOT NULL,
  email        TEXT,
  email_lower  TEXT,
  member_slug  TEXT,
  is_featured  BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  role         TEXT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_member_profiles_email       ON member_profiles (email);
CREATE INDEX IF NOT EXISTS idx_member_profiles_email_lower ON member_profiles (email_lower);
CREATE INDEX IF NOT EXISTS idx_member_profiles_slug        ON member_profiles (member_slug);
CREATE INDEX IF NOT EXISTS idx_member_profiles_created     ON member_profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_profiles_featured    ON member_profiles (is_featured) WHERE is_featured = true;
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initMemberPgSchema(): Promise<void> {
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
