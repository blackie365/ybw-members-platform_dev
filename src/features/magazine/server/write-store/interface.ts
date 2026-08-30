import { MagazineIssue, MagazinePage, StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';

/**
 * IDML draft shape persisted to magazine_idml_drafts (mirrors the Firestore
 * doc written by saveIdmlDraft). `data` is stored as JSONB; helper columns
 * (id, updated_at) support lookup + "latest draft" ordering.
 */
export interface IdmlDraftRecord {
  id: string;
  pages: ReaderPagePayload[];
  metadata: { title: string; description: string; coverImage: string };
  stats: { pageCount: number; storyCount: number; imageCount: number };
  fileName: string;
  updatedAt?: string;
}

// ReaderPagePayload mirrors the builder page payload used by IDML drafts.
type ReaderPagePayload = any;

/**
 * MagazineWriteStore — the storage seam for all ADMIN magazine writes.
 *
 * Phase 5: mirrors the MagazineReadStore seam but for the WRITE side. During
 * the migration window the action layer uses a Composite writer (Postgres
 * primary + Firestore mirror) so:
 *   - the PUBLIC reader (Postgres read store) sees fresh data immediately, and
 *   - anything still reading Firestore (the admin builder UI) keeps working.
 *
 * Later, once admin-builder reads also move to Postgres, the composite can be
 * reduced to the pure Postgres writer and the Firestore magazine collections
 * retired.
 *
 * Selector: getMagazineWriteStore() in ./index.ts (env-driven).
 */
export interface MagazineWriteStore {
  /** Create or fully replace an issue (createMagazineIssueAction). Returns id. */
  createIssue(issue: Partial<MagazineIssue> & { id?: string }): Promise<string>;

  /** Merge a partial issue update (updateMagazineIssueAction / readerEdition link). */
  updateIssue(issueId: string, patch: Record<string, unknown>): Promise<void>;

  /** Delete an issue and its pages (deleteMagazineIssueAction). */
  deleteIssue(issueId: string): Promise<void>;

  /** Set exactly one issue as latest (clears others). Transactional. */
  setLatestIssue(issueId: string): Promise<void>;

  /** Set exactly one issue as featured flipbook (clears others). Transactional. */
  setFeaturedFlipbookIssue(issueId: string): Promise<void>;

  /** Upsert a single builder page by its numeric id for an issue. */
  upsertPage(issueId: string, page: MagazinePage & { id: number | string }): Promise<void>;

  /** Add (auto-id) a builder page. Returns the generated doc id. */
  addPage(issueId: string, page: MagazinePage & { id: number | string }): Promise<string>;

  /** Delete a builder page (by numeric id) for an issue. */
  deletePage(issueId: string, pageId: string): Promise<void>;

  /** Bulk upsert builder pages (bulkUpdateMagazinePagesAction). */
  bulkUpsertPages(issueId: string, pages: Array<MagazinePage & { id: number | string }>): Promise<void>;

  /** Bulk delete builder pages (bulkDeleteMagazinePagesAction). */
  bulkDeletePages(issueId: string, pageIds: string[]): Promise<void>;

  /** Upsert a reader edition (upsertReaderEdition). */
  upsertReaderEdition(edition: ReaderEdition): Promise<void>;

  /** Delete a reader edition (deleteReaderEdition). */
  deleteReaderEdition(id: string): Promise<void>;

  /** Replace the story library for an issue (persistStoryLibraryForIssue). */
  persistStoryLibrary(issueId: string, items: StoryLibraryItem[]): Promise<void>;

  /** Save an IDML draft (saveIdmlDraft). */
  saveIdmlDraft(draft: IdmlDraftRecord): Promise<void>;

  /** Delete an IDML draft (deleteIdmlDraft). */
  deleteIdmlDraft(draftId: string): Promise<void>;
}
