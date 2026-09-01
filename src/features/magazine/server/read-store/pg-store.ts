import { MagazineIssue, MagazinePage, StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';
import { MagazineReadStore } from './interface';
import { getMagazinePgPool } from './pg-client';
import { initMagazinePgSchema } from './pg-schema';

/**
 * Postgres-backed magazine read store (Phase 3).
 *
 * Data model: each table stores the RESOLVED read output (the exact shape the
 * Firestore read functions return) as a JSONB blob under `data`. This avoids
 * reimplementing the fragile reader hydration / AUTHORITY fallback chains in
 * SQL — the backfill script writes what the real reader would have returned.
 *
 * Lookups are simple and fast; ordering is served from helper columns
 * (publish_date, slug, issue_id, sort_key).
 *
 * Every method returns `undefined`-ish sentinel that the composite store
 * translates into a Firestore fallback (null / []) when:
 *   - no Postgres pool is configured, or
 *   - the row isn't found.
 */
export class PgMagazineReadStore implements MagazineReadStore {
  private async ready(): Promise<boolean> {
    try {
      await initMagazinePgSchema();
      return getMagazinePgPool() !== null;
    } catch (err) {
      console.warn('[PgMagazineReadStore] schema init failed:', err);
      return false;
    }
  }

  async getMagazineIssues(): Promise<MagazineIssue[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT data FROM magazine_issues ORDER BY publish_date DESC NULLS LAST, id DESC',
      );
      return rows.map((r) => r.data as MagazineIssue);
    } catch (err) {
      console.warn('[PgMagazineReadStore] getMagazineIssues failed:', err);
      return [];
    }
  }

  async getMagazineIssue(issueId: string): Promise<MagazineIssue | null> {
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query('SELECT data FROM magazine_issues WHERE id = $1', [issueId]);
      return rows.length ? (rows[0].data as MagazineIssue) : null;
    } catch (err) {
      console.warn(`[PgMagazineReadStore] getMagazineIssue(${issueId}) failed:`, err);
      return null;
    }
  }

  async getLatestIssue(): Promise<MagazineIssue | null> {
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT data FROM magazine_issues ORDER BY publish_date DESC NULLS LAST, id DESC LIMIT 1',
      );
      return rows.length ? (rows[0].data as MagazineIssue) : null;
    } catch (err) {
      console.warn('[PgMagazineReadStore] getLatestIssue failed:', err);
      return null;
    }
  }

  async getMagazinePages(issueId: string): Promise<MagazinePage[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT id, data FROM magazine_pages WHERE issue_id = $1 ORDER BY sort_key ASC, id ASC',
        [issueId],
      );
      // Inject a stable identity (docId = numeric page id) so the admin builder
      // can address pages consistently across PG rows and its client state. This
      // is the Phase 5 page-identity invariant: docId === String(id).
      return rows.map((r) => {
        const page = { ...(r.data as MagazinePage) } as MagazinePage & { docId?: string };
        page.docId = String(r.id);
        return page as MagazinePage;
      });
    } catch (err) {
      console.warn(`[PgMagazineReadStore] getMagazinePages(${issueId}) failed:`, err);
      return [];
    }
  }

  async getReaderEditionByIssueId(issueId: string): Promise<ReaderEdition | null> {
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT data FROM magazine_reader_editions
         WHERE issue_id = $1
         ORDER BY (data->>'updatedAt') DESC NULLS LAST, publish_date DESC NULLS LAST, id DESC
         LIMIT 1`,
        [issueId],
      );
      return rows.length ? (rows[0].data as ReaderEdition) : null;
    } catch (err) {
      console.warn(`[PgMagazineReadStore] getReaderEditionByIssueId(${issueId}) failed:`, err);
      return null;
    }
  }

  async getReaderEditionById(id: string): Promise<ReaderEdition | null> {
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT data_light, data FROM magazine_reader_editions WHERE id = $1',
        [id],
      );
      if (!rows.length) return null;
      return ((rows[0].data_light as ReaderEdition | null) ?? (rows[0].data as ReaderEdition));
    } catch (err) {
      console.warn(`[PgMagazineReadStore] getReaderEditionById(${id}) failed:`, err);
      return null;
    }
  }

  async listReaderEditions(limit = 24): Promise<ReaderEdition[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT data_light, data FROM magazine_reader_editions ORDER BY publish_date DESC NULLS LAST LIMIT $1',
        [limit],
      );
      return rows.map((r) => (r.data_light ?? r.data) as ReaderEdition);
    } catch (err) {
      console.warn('[PgMagazineReadStore] listReaderEditions failed:', err);
      return [];
    }
  }

  async getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null> {
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      // Slug lookups can collide (a legacy row keyed by the issue id and the
      // current synced row share the same slug). Always resolve to the most
      // recently written edition so builder edits land in the reader.
      const { rows } = await pool.query(
        `SELECT data FROM magazine_reader_editions
         WHERE slug = $1
         ORDER BY (data->>'updatedAt') DESC NULLS LAST, publish_date DESC NULLS LAST, id DESC
         LIMIT 1`,
        [slug],
      );
      return rows.length ? (rows[0].data as ReaderEdition) : null;
    } catch (err) {
      console.warn(`[PgMagazineReadStore] getReaderEditionBySlug(${slug}) failed:`, err);
      return null;
    }
  }

  async getStoryLibrary(issueId: string): Promise<StoryLibraryItem[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT data FROM magazine_story_library WHERE issue_id = $1 ORDER BY data->>\'premiumReaderPriority\' ASC NULLS LAST, id ASC',
        [issueId],
      );
      return rows.map((r) => r.data as StoryLibraryItem);
    } catch (err) {
      console.warn(`[PgMagazineReadStore] getStoryLibrary(${issueId}) failed:`, err);
      return [];
    }
  }

  async listIdmlDrafts(): Promise<any[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT data FROM magazine_idml_drafts ORDER BY updated_at DESC NULLS LAST',
      );
      return rows.map((r) => r.data);
    } catch (err) {
      console.warn('[PgMagazineReadStore] listIdmlDrafts failed:', err);
      return [];
    }
  }

  async getIdmlDraft(draftId: string): Promise<any | null> {
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT data FROM magazine_idml_drafts WHERE id = $1',
        [draftId],
      );
      return rows.length ? rows[0].data : null;
    } catch (err) {
      console.warn(`[PgMagazineReadStore] getIdmlDraft(${draftId}) failed:`, err);
      return null;
    }
  }
}
