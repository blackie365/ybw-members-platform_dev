import { MagazinePage, StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';
import { MagazineWriteStore, IdmlDraftRecord } from './interface';
import { FirestoreMagazineWriteStore } from './firestore-write-store';

/**
 * Composite write store used when MAGAZINE_STORE=pg during the Phase 5
 * migration window.
 *
 * Every write goes to Postgres (primary — this is what the PUBLIC reader
 * consumes) AND is mirrored to Firestore (fallback), so the admin builder UI —
 * which still reads/writes Firestore directly during the transition — stays
 * fully functional. Once admin-builder reads move to Postgres and the Firestore
 * magazine collections are retired, callers can switch to the pure
 * PgMagazineWriteStore and drop this mirror.
 *
 * Firestore mirror failures are logged but never fail the primary PG write, so
 * a degraded Firestore cannot block a magazine write.
 */
export class CompositeMagazineWriteStore implements MagazineWriteStore {
  constructor(
    private readonly primary: MagazineWriteStore,
    private readonly mirror: MagazineWriteStore = new FirestoreMagazineWriteStore(),
  ) {}

  private async mirrorSafe(op: () => Promise<unknown>, label: string): Promise<void> {
    try {
      await op();
    } catch (err) {
      console.warn(`[CompositeMagazineWriteStore] Firestore ${label} mirror failed (PG write already persisted):`, err);
    }
  }

  async createIssue(issue: Partial<any>): Promise<string> {
    const id = await this.primary.createIssue(issue);
    await this.mirrorSafe(() => this.mirror.createIssue({ ...issue, id }), 'createIssue');
    return id;
  }

  async updateIssue(issueId: string, patch: Record<string, unknown>): Promise<void> {
    await this.primary.updateIssue(issueId, patch);
    await this.mirrorSafe(() => this.mirror.updateIssue(issueId, patch), 'updateIssue');
  }

  async deleteIssue(issueId: string): Promise<void> {
    await this.primary.deleteIssue(issueId);
    await this.mirrorSafe(() => this.mirror.deleteIssue(issueId), 'deleteIssue');
  }

  async setLatestIssue(issueId: string): Promise<void> {
    await this.primary.setLatestIssue(issueId);
    await this.mirrorSafe(() => this.mirror.setLatestIssue(issueId), 'setLatestIssue');
  }

  async setFeaturedFlipbookIssue(issueId: string): Promise<void> {
    await this.primary.setFeaturedFlipbookIssue(issueId);
    await this.mirrorSafe(() => this.mirror.setFeaturedFlipbookIssue(issueId), 'setFeaturedFlipbookIssue');
  }

  async upsertPage(issueId: string, page: MagazinePage & { id: number | string }): Promise<void> {
    await this.primary.upsertPage(issueId, page);
    await this.mirrorSafe(() => this.mirror.upsertPage(issueId, page), 'upsertPage');
  }

  async addPage(issueId: string, page: MagazinePage & { id: number | string }): Promise<string> {
    const id = await this.primary.addPage(issueId, page);
    await this.mirrorSafe(
      () => this.mirror.addPage(issueId, { ...page, __stagedDocId: id } as any),
      'addPage',
    );
    return id;
  }

  async deletePage(issueId: string, pageId: string): Promise<void> {
    await this.primary.deletePage(issueId, pageId);
    await this.mirrorSafe(() => this.mirror.deletePage(issueId, pageId), 'deletePage');
  }

  async bulkUpsertPages(issueId: string, pages: Array<MagazinePage & { id: number | string }>): Promise<void> {
    await this.primary.bulkUpsertPages(issueId, pages);
    await this.mirrorSafe(() => this.mirror.bulkUpsertPages(issueId, pages), 'bulkUpsertPages');
  }

  async bulkDeletePages(issueId: string, pageIds: string[]): Promise<void> {
    await this.primary.bulkDeletePages(issueId, pageIds);
    await this.mirrorSafe(() => this.mirror.bulkDeletePages(issueId, pageIds), 'bulkDeletePages');
  }

  async upsertReaderEdition(edition: ReaderEdition): Promise<void> {
    await this.primary.upsertReaderEdition(edition);
    await this.mirrorSafe(() => this.mirror.upsertReaderEdition(edition), 'upsertReaderEdition');
  }

  async deleteReaderEdition(id: string): Promise<void> {
    await this.primary.deleteReaderEdition(id);
    await this.mirrorSafe(() => this.mirror.deleteReaderEdition(id), 'deleteReaderEdition');
  }

  async persistStoryLibrary(issueId: string, items: StoryLibraryItem[]): Promise<void> {
    await this.primary.persistStoryLibrary(issueId, items);
    await this.mirrorSafe(() => this.mirror.persistStoryLibrary(issueId, items), 'persistStoryLibrary');
  }

  async saveIdmlDraft(draft: IdmlDraftRecord): Promise<void> {
    await this.primary.saveIdmlDraft(draft);
    await this.mirrorSafe(() => this.mirror.saveIdmlDraft(draft), 'saveIdmlDraft');
  }

  async deleteIdmlDraft(draftId: string): Promise<void> {
    await this.primary.deleteIdmlDraft(draftId);
    await this.mirrorSafe(() => this.mirror.deleteIdmlDraft(draftId), 'deleteIdmlDraft');
  }
}
