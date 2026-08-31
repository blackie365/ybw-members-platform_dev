import { MagazineIssue, MagazinePage, StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';

/**
 * MagazineReadStore — the storage seam for the PUBLIC magazine read layer.
 *
 * Postgres-only (Phase 5 complete): every method serves magazine data stored
 * as JSONB rows in Postgres. Firestore is no longer used for magazine reads.
 *
 * Implementation:
 *   - PgMagazineReadStore — resolves JSONB output from PG tables.
 *
 * Selector: getMagazineReadStore() in ./index.ts (always returns the Pg store).
 */
export interface MagazineReadStore {
  /** All issues, ordered publishDate DESC. Falls back to static siteContent. */
  getMagazineIssues(): Promise<MagazineIssue[]>;

  /** Single issue by id, else null. Falls back to static siteContent. */
  getMagazineIssue(issueId: string): Promise<MagazineIssue | null>;

  /** Latest issue by publishDate DESC, else null. */
  getLatestIssue(): Promise<MagazineIssue | null>;

  /** Builder pages for an issue, ordered by numeric id ASC. */
  getMagazinePages(issueId: string): Promise<MagazinePage[]>;

  /** Reader edition looked up by issueId, else null. */
  getReaderEditionByIssueId(issueId: string): Promise<ReaderEdition | null>;

  /** Reader edition by its document id, else null. */
  getReaderEditionById(id: string): Promise<ReaderEdition | null>;

  /** Reader editions ordered publishDate DESC (public listing). */
  listReaderEditions(limit?: number): Promise<ReaderEdition[]>;

  /** Reader edition by slug, else null. */
  getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null>;

  /** Story library items for an issue (admin builder). */
  getStoryLibrary(issueId: string): Promise<StoryLibraryItem[]>;

  /** IDML drafts (latest first) for the admin importer. */
  listIdmlDrafts(): Promise<any[]>;

  /** A single IDML draft by id, else null. */
  getIdmlDraft(draftId: string): Promise<any | null>;
}
