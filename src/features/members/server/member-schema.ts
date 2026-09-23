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

CREATE TABLE IF NOT EXISTS member_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  action       TEXT NOT NULL,
  target_type  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  email_lower  TEXT,
  operator     TEXT NOT NULL DEFAULT 'system',
  visibility_before TEXT,
  visibility_after  TEXT,
  fields_changed JSONB,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_audit_log_action     ON member_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_member_audit_log_target     ON member_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_member_audit_log_email      ON member_audit_log (email_lower);
CREATE INDEX IF NOT EXISTS idx_member_audit_log_created    ON member_audit_log (created_at DESC);
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initMemberPgSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getMagazinePgPool();
      if (!pool) return;
      try {
        await pool.query(SCHEMA_SQL);
      } catch (err) {
        console.warn('[initMemberPgSchema] SCHEMA_SQL block partial/fail; continuing with ALTER follow-ups:', err instanceof Error ? err.message : err);
      }
      try {
        await pool.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='member_profiles' AND column_name='visibility') THEN
              ALTER TABLE member_profiles ADD COLUMN visibility TEXT NOT NULL DEFAULT 'visible';
            END IF;
          END $$;
        `);
      } catch (err) {
        console.warn('[initMemberPgSchema] ALTER ADD COLUMN visibility:', err instanceof Error ? err.message : err);
      }
      try {
        await pool.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_member_profiles_visibility') THEN
              ALTER TABLE member_profiles ADD CONSTRAINT chk_member_profiles_visibility CHECK (visibility IN ('visible', 'invisible'));
            END IF;
          END $$;
        `);
      } catch (err) {
        console.warn('[initMemberPgSchema] ALTER ADD CONSTRAINT visibility:', err instanceof Error ? err.message : err);
      }
      try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_profiles_visibility ON member_profiles (visibility) WHERE visibility = 'visible'`);
      } catch (err) {
        console.warn('[initMemberPgSchema] CREATE INDEX visibility:', err instanceof Error ? err.message : err);
      }
      schemaReady = true;
    })();
  }
  await schemaPromise;
}
