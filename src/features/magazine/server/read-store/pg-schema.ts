import { getMagazinePgPool } from './pg-client';

/**
 * Idempotent schema init for the magazine read-store tables (Phase 3).
 *
 * Tables mirror the RESOLVED Firestore read output as JSONB (see
 * PgMagazineReadStore). Column projections (publish_date, slug, issue_id,
 * sort_key) exist only to support ordering/lookup without JSON traversal.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS magazine_issues (
  id           TEXT PRIMARY KEY,
  data         JSONB NOT NULL,
  publish_date TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS magazine_pages (
  issue_id  TEXT NOT NULL,
  id        TEXT NOT NULL,
  sort_key  INT  NOT NULL DEFAULT 0,
  data      JSONB NOT NULL,
  PRIMARY KEY (issue_id, id)
);
CREATE TABLE IF NOT EXISTS magazine_reader_editions (
  id           TEXT PRIMARY KEY,
  data         JSONB NOT NULL,
  data_light   JSONB,
  slug         TEXT,
  issue_id     TEXT,
  publish_date TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS magazine_story_library (
  id         TEXT PRIMARY KEY,
  issue_id   TEXT NOT NULL,
  data       JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS magazine_idml_drafts (
  id           TEXT PRIMARY KEY,
  updated_at   TIMESTAMPTZ,
  data         JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_magazine_issues_publish   ON magazine_issues (publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_reader_editions_publish   ON magazine_reader_editions (publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_reader_editions_slug      ON magazine_reader_editions (slug);
CREATE INDEX IF NOT EXISTS idx_reader_editions_issue     ON magazine_reader_editions (issue_id);
CREATE INDEX IF NOT EXISTS idx_magazine_pages_issue_sort ON magazine_pages (issue_id, sort_key ASC);
CREATE INDEX IF NOT EXISTS idx_story_library_issue       ON magazine_story_library (issue_id);
CREATE INDEX IF NOT EXISTS idx_idml_drafts_updated       ON magazine_idml_drafts (updated_at DESC);
ALTER TABLE magazine_reader_editions ADD COLUMN IF NOT EXISTS data_light JSONB;
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initMagazinePgSchema(): Promise<void> {
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

/** Best-effort helper: parse a publishDate (ISO/Date/number) -> Date | null. */
export function toPgDate(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
