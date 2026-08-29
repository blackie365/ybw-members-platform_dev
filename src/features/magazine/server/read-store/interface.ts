import { MagazineIssue, MagazinePage } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';

/**
 * MagazineReadStore — the storage seam for the PUBLIC magazine read layer.
 *
 * Phase 2 (Option 1 — adapter-based migration): we abstract ONLY the read
 * paths that serve the public reader, issue pages, sitemap and magazine
 * experiences. All magazine *writes* still go to Firestore (unchanged) in this
 * phase, so a later phase can add a Postgres implementation behind the same
 * interface without touching any call site.
 *
 * Implementations:
 *   - FirestoreMagazineReadStore  (current behaviour — delegates to the existing
 *     magazine-service-server + simple-reader functions, byte-for-byte unchanged)
 *   - PgMagazineReadStore          (added in a later phase)
 *
 * Selector: getMagazineReadStore() in ./index.ts (env-driven, defaults to firestore).
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

  /**
   * Reader edition looked up by issueId, with the full AUTHORITY #0/#1/#2
   * legacy fallback chain preserved. Returns null if unresolvable.
   */
  getReaderEditionByIssueId(issueId: string): Promise<ReaderEdition | null>;

  /** Reader edition by its document id, else null. */
  getReaderEditionById(id: string): Promise<ReaderEdition | null>;

  /** Reader editions ordered publishDate DESC (public listing). */
  listReaderEditions(limit?: number): Promise<ReaderEdition[]>;

  /** Reader edition by slug, else null (AUTHORITY chain preserved). */
  getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null>;
}
