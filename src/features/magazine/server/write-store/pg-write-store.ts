import { MagazinePage, StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';
import { MagazineWriteStore, IdmlDraftRecord } from './interface';
import { getMagazinePgPool } from '../read-store/pg-client';
import { initMagazinePgSchema, toPgDate } from '../read-store/pg-schema';

/**
 * Postgres-backed magazine write store (Phase 5).
 *
 * Every write lands in the same JSONB tables the PgMagazineReadStore serves,
 * so the PUBLIC reader reflects data immediately. Page rows are keyed by the
 * numeric page `id` (matching magazine_pages PK (issue_id, id)); the Firestore
 * docId is not a PG identity concept, so callers key page mutations by the
 * numeric id (present on every builder page payload).
 */
export class PgMagazineWriteStore implements MagazineWriteStore {
  private async pool() {
    await initMagazinePgSchema();
    const pool = getMagazinePgPool();
    if (!pool) throw new Error('No Postgres pool configured for magazine writes');
    return pool;
  }

  async createIssue(issue: Partial<any>): Promise<string> {
    const pool = await this.pool();
    const id = String(issue?.id || '');
    if (!id) throw new Error('Cannot create issue without an id');
    const data = { ...issue, id };
    const publish = toPgDate(issue?.publishDate);
    await pool.query(
      `INSERT INTO magazine_issues (id, data, publish_date) VALUES ($1,$2::jsonb,$3)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, publish_date = EXCLUDED.publish_date`,
      [id, JSON.stringify(data), publish],
    );
    return id;
  }

  async updateIssue(issueId: string, patch: Record<string, unknown>): Promise<void> {
    const pool = await this.pool();
    const { rows } = await pool.query('SELECT data FROM magazine_issues WHERE id = $1', [issueId]);
    const existing = (rows[0]?.data as Record<string, unknown>) || {};
    const data = { ...existing, ...patch, id: issueId };
    const publish = toPgDate((data as any).publishDate ?? (existing as any).publishDate);
    await pool.query(
      `INSERT INTO magazine_issues (id, data, publish_date) VALUES ($1,$2::jsonb,$3)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, publish_date = EXCLUDED.publish_date`,
      [issueId, JSON.stringify(data), publish],
    );
  }

  async deleteIssue(issueId: string): Promise<void> {
    const pool = await this.pool();
    await pool.query('DELETE FROM magazine_issues WHERE id = $1', [issueId]);
    await pool.query('DELETE FROM magazine_pages WHERE issue_id = $1', [issueId]);
    // Also drop reader editions linked to this issue.
    await pool.query('DELETE FROM magazine_reader_editions WHERE issue_id = $1', [issueId]);
    await pool.query('DELETE FROM magazine_story_library WHERE issue_id = $1', [issueId]);
  }

  async setLatestIssue(issueId: string): Promise<void> {
    const pool = await this.pool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Clear isLatest on all issues (any engine's rows).
      const clear = await client.query('SELECT data FROM magazine_issues');
      for (const row of clear.rows) {
        const data = (row.data as Record<string, unknown>) || {};
        if ((data as any).isLatest && (data as any).id !== issueId) {
          await client.query(
            'UPDATE magazine_issues SET data = data || $2::jsonb WHERE id = $1',
            [data.id, JSON.stringify({ isLatest: false, updatedAt: new Date().toISOString() })],
          );
        }
      }
      const { rows } = await client.query('SELECT data FROM magazine_issues WHERE id = $1', [issueId]);
      const existing = (rows[0]?.data as Record<string, unknown>) || {};
      const data = { ...existing, id: issueId, isLatest: true, updatedAt: new Date().toISOString() };
      await client.query(
        `INSERT INTO magazine_issues (id, data, publish_date) VALUES ($1,$2::jsonb,$3)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, publish_date = EXCLUDED.publish_date`,
        [issueId, JSON.stringify(data), toPgDate((data as any).publishDate)],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async setFeaturedFlipbookIssue(issueId: string): Promise<void> {
    const pool = await this.pool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const clear = await client.query('SELECT data FROM magazine_issues');
      for (const row of clear.rows) {
        const data = (row.data as Record<string, unknown>) || {};
        if ((data as any).featureInFlipbook && (data as any).id !== issueId) {
          await client.query(
            'UPDATE magazine_issues SET data = data || $2::jsonb WHERE id = $1',
            [data.id, JSON.stringify({ featureInFlipbook: false, updatedAt: new Date().toISOString() })],
          );
        }
      }
      const { rows } = await client.query('SELECT data FROM magazine_issues WHERE id = $1', [issueId]);
      const existing = (rows[0]?.data as Record<string, unknown>) || {};
      const data = {
        ...existing,
        id: issueId,
        featureInFlipbook: true,
        updatedAt: new Date().toISOString(),
      };
      await client.query(
        `INSERT INTO magazine_issues (id, data, publish_date) VALUES ($1,$2::jsonb,$3)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, publish_date = EXCLUDED.publish_date`,
        [issueId, JSON.stringify(data), toPgDate((data as any).publishDate)],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async upsertPage(issueId: string, page: MagazinePage & { id: number | string }): Promise<void> {
    const pool = await this.pool();
    await this.writePage(pool, issueId, page);
  }

  async addPage(issueId: string, page: MagazinePage & { id: number | string }): Promise<string> {
    const pool = await this.pool();
    const id = this.pageId(page);
    await this.writePage(pool, issueId, page);
    // PG has no auto-id; use the numeric id when provided, else a generated doc id.
    return id;
  }

  async deletePage(issueId: string, pageId: string): Promise<void> {
    const pool = await this.pool();
    // pageId is the numeric id when coming through the PG writer.
    await pool.query('DELETE FROM magazine_pages WHERE issue_id = $1 AND id = $2', [issueId, pageId]);
  }

  async bulkUpsertPages(issueId: string, pages: Array<MagazinePage & { id: number | string }>): Promise<void> {
    const pool = await this.pool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const page of pages) await this.writePage(client, issueId, page, true);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async bulkDeletePages(issueId: string, pageIds: string[]): Promise<void> {
    const pool = await this.pool();
    const ids = pageIds.filter(Boolean);
    if (ids.length === 0) return;
    await pool.query('DELETE FROM magazine_pages WHERE issue_id = $1 AND id = ANY($2::text[])', [
      issueId,
      ids,
    ]);
  }

  async upsertReaderEdition(edition: ReaderEdition): Promise<void> {
    const pool = await this.pool();
    const id = String(edition.id || '');
    if (!id) throw new Error('Cannot upsert reader edition without an id');
    const data = JSON.stringify(edition);
    const slug = edition.slug ? String(edition.slug) : null;
    const issueId = edition.issueId ? String(edition.issueId) : null;
    const publish = toPgDate(edition.publishDate);
    await pool.query(
      `INSERT INTO magazine_reader_editions (id, data, data_light, slug, issue_id, publish_date)
       VALUES ($1,$2::jsonb,$2::jsonb,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, data_light = EXCLUDED.data,
         slug = EXCLUDED.slug, issue_id = EXCLUDED.issue_id, publish_date = EXCLUDED.publish_date`,
      [id, data, slug, issueId, publish],
    );
  }

  async deleteReaderEdition(id: string): Promise<void> {
    const pool = await this.pool();
    await pool.query('DELETE FROM magazine_reader_editions WHERE id = $1', [id]);
  }

  async persistStoryLibrary(issueId: string, items: StoryLibraryItem[]): Promise<void> {
    const pool = await this.pool();
    const resolved: Array<{ id: string; data: StoryLibraryItem }> = [];
    const seen = new Set<string>();
    for (const item of items || []) {
      const id = String(item.id || '').trim();
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      resolved.push({ id, data: { ...(item as any), issueId } });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Delete rows for this issue that are no longer present.
      if (resolved.length > 0) {
        await client.query(
          'DELETE FROM magazine_story_library WHERE issue_id = $1 AND id <> ALL($2::text[])',
          [issueId, resolved.map((r) => r.id)],
        );
      } else {
        await client.query('DELETE FROM magazine_story_library WHERE issue_id = $1', [issueId]);
      }
      for (const { id, data } of resolved) {
        await client.query(
          `INSERT INTO magazine_story_library (id, issue_id, data) VALUES ($1,$2,$3::jsonb)
           ON CONFLICT (id) DO UPDATE SET issue_id = EXCLUDED.issue_id, data = EXCLUDED.data`,
          [id, issueId, JSON.stringify(data)],
        );
      }
      // Mirror the story library onto the issue row (matches the historical
      // Firestore behaviour of projecting storyLibrary into magazine_issues).
      const maskLight = resolved.map((r) => {
        const d = (r.data as any) as Record<string, unknown>;
        return {
          id: r.id,
          title: d.title || '',
          author: d.author || undefined,
          standfirst: d.standfirst || undefined,
          text: String(d.text || '').slice(0, 1600),
          imageUrl: d.imageUrl || undefined,
          includedInPremiumReader: d.includedInPremiumReader !== false,
          premiumReaderPriority: d.premiumReaderPriority,
          premiumReaderContentType: d.premiumReaderContentType,
          premiumReaderPlacementPreference: d.premiumReaderPlacementPreference || 'auto',
          imageFileNames: Array.isArray(d.imageFileNames) ? d.imageFileNames.slice(0, 8) : [],
          sourceRef: d.sourceRef || undefined,
          source: d.source || undefined,
          createdAt: d.createdAt || undefined,
        };
      });
      // Use a partial-safe JSON merge so we don't clobber any parallel issue meta.
      const { rows } = await client.query('SELECT data FROM magazine_issues WHERE id = $1', [issueId]);
      const issueData = (rows[0]?.data as Record<string, unknown>) || {};
      const merged = {
        ...issueData,
        id: issueId,
        storyLibrary: maskLight,
        storyLibraryCount: resolved.length,
        updatedAt: new Date().toISOString(),
      };
      await client.query(
        `INSERT INTO magazine_issues (id, data, publish_date) VALUES ($1,$2::jsonb,$3)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, publish_date = EXCLUDED.publish_date`,
        [issueId, JSON.stringify(merged), toPgDate(issueData.publishDate)],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async saveIdmlDraft(draft: IdmlDraftRecord): Promise<void> {
    const pool = await this.pool();
    const id = String(draft.id || '');
    if (!id) throw new Error('Cannot save IDML draft without an id');
    const data = { ...draft, id };
    await pool.query(
      `INSERT INTO magazine_idml_drafts (id, updated_at, data) VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
      [id, new Date().toISOString(), JSON.stringify(data)],
    );
  }

  async deleteIdmlDraft(draftId: string): Promise<void> {
    const pool = await this.pool();
    await pool.query('DELETE FROM magazine_idml_drafts WHERE id = $1', [draftId]);
  }

  private pageId(page: MagazinePage & { id: number | string }): string {
    if (page.id !== undefined && page.id !== null && String(page.id).trim() !== '') {
      return String(page.id);
    }
    return `pg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // `exec` is a pg.PoolClient | Pool (any is used to keep the non-txn and txn
  // call paths sharing one helper without an extra pg type import).
  private async writePage(exec: any, issueId: string, page: MagazinePage & { id: number | string }, inTxn = false): Promise<void> {
    const raw = { ...(page as any) };
    delete raw.docId;
    delete raw.__stagedDocId;
    const id = this.pageId(page);
    let sortKey = 0;
    const numeric = Number(raw.id);
    if (raw.id !== undefined && raw.id !== null && !Number.isNaN(numeric)) sortKey = numeric;
    const publish = toPgDate(raw.publishDate);
    void publish;
    const sql =
      `INSERT INTO magazine_pages (issue_id, id, sort_key, data) VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (issue_id, id) DO UPDATE SET sort_key = EXCLUDED.sort_key, data = EXCLUDED.data`;
    if (inTxn) {
      await exec.query(sql, [issueId, id, sortKey, JSON.stringify(raw)]);
    } else {
      await exec.query(sql, [issueId, id, sortKey, JSON.stringify(raw)]);
    }
  }
}
