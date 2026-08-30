import { MagazinePage, StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';
import { adminDb } from '@/lib/firebase-admin';
import { MagazineWriteStore, IdmlDraftRecord } from './interface';

/**
 * Firestore-backed write store — the CURRENT behavior. Every method delegates
 * to the existing Admin SDK Firestore operations so the action layer can route
 * through the shared MagazineWriteStore seam without changing semantics.
 */
export class FirestoreMagazineWriteStore implements MagazineWriteStore {
  private requireDb(): any {
    if (!adminDb) throw new Error('Firebase Admin not configured');
    return adminDb;
  }

  async createIssue(issue: Partial<any>): Promise<string> {
    const db = this.requireDb();
    const docRef = await db.collection('magazine_issues').add(issue);
    return docRef.id;
  }

  async updateIssue(issueId: string, patch: Record<string, unknown>): Promise<void> {
    const db = this.requireDb();
    await db.collection('magazine_issues').doc(issueId).set(patch, { merge: true });
  }

  async deleteIssue(issueId: string): Promise<void> {
    const db = this.requireDb();
    await db.collection('magazine_issues').doc(issueId).delete();
  }

  async setLatestIssue(issueId: string): Promise<void> {
    const db = this.requireDb();
    const now = new Date().toISOString();
    const issuesRef = db.collection('magazine_issues');
    await db.runTransaction(async (tx: any) => {
      const latestSnap = await tx.get(issuesRef.where('isLatest', '==', true));
      for (const doc of latestSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { isLatest: false, updatedAt: now });
      }
      tx.set(issuesRef.doc(issueId), { isLatest: true, updatedAt: now }, { merge: true });
    });
  }

  async setFeaturedFlipbookIssue(issueId: string): Promise<void> {
    const db = this.requireDb();
    const now = new Date().toISOString();
    const issuesRef = db.collection('magazine_issues');
    await db.runTransaction(async (tx: any) => {
      const featuredSnap = await tx.get(issuesRef.where('featureInFlipbook', '==', true));
      for (const doc of featuredSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { featureInFlipbook: false, updatedAt: now });
      }
      tx.set(issuesRef.doc(issueId), { featureInFlipbook: true, updatedAt: now }, { merge: true });
    });
  }

  async upsertPage(issueId: string, page: MagazinePage & { id: number | string }): Promise<void> {
    const db = this.requireDb();
    const payload = { ...(page as any) };
    delete payload.docId;
    await db
      .collection('magazine_issues')
      .doc(issueId)
      .collection('pages')
      .doc(String(payload.__stagedDocId || page.docId || String(page.id)))
      .set(payload, { merge: true });
  }

  async addPage(issueId: string, page: MagazinePage & { id: number | string }): Promise<string> {
    const db = this.requireDb();
    const payload = { ...(page as any) };
    delete payload.docId;
    const docRef = await db
      .collection('magazine_issues')
      .doc(issueId)
      .collection('pages')
      .add(payload);
    return docRef.id;
  }

  async deletePage(issueId: string, pageId: string): Promise<void> {
    const db = this.requireDb();
    await db.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).delete();
  }

  async bulkUpsertPages(issueId: string, pages: Array<MagazinePage & { id: number | string }>): Promise<void> {
    const db = this.requireDb();
    const collectionRef = db.collection('magazine_issues').doc(issueId).collection('pages');
    const batch = db.batch();
    for (const page of pages) {
      const payload = { ...(page as any) };
      const docId = payload.__stagedDocId || page.docId || String(page.id);
      delete payload.docId;
      delete payload.__stagedDocId;
      batch.set(collectionRef.doc(docId), payload, { merge: true });
    }
    await batch.commit();
  }

  async bulkDeletePages(issueId: string, pageIds: string[]): Promise<void> {
    const db = this.requireDb();
    const collectionRef = db.collection('magazine_issues').doc(issueId).collection('pages');
    const batch = db.batch();
    for (const pid of pageIds) batch.delete(collectionRef.doc(pid));
    await batch.commit();
  }

  async upsertReaderEdition(edition: ReaderEdition): Promise<void> {
    const db = this.requireDb();
    await db.collection('magazine_reader_editions').doc(edition.id).set(edition, { merge: true });
  }

  async deleteReaderEdition(id: string): Promise<void> {
    const db = this.requireDb();
    await db.collection('magazine_reader_editions').doc(id).delete();
  }

  async persistStoryLibrary(issueId: string, items: StoryLibraryItem[]): Promise<void> {
    const db = this.requireDb();
    const collectionRef = db.collection('magazine_story_library');
    const batch = db.batch();
    const keptIds = new Set<string>();
    for (const item of items) {
      const docId = String(item.id || '').trim() || `${issueId}-library-${String(Date.now())}`;
      keptIds.add(docId);
      batch.set(collectionRef.doc(docId), { ...item, issueId, updatedAt: new Date().toISOString() }, { merge: true });
    }
    // Delete stale collection docs that belong to this issue but are no longer
    // in the incoming list (keeps the admin-builder Firestore source clean).
    try {
      const stale = await collectionRef.where('issueId', '==', issueId).get();
      for (const doc of stale.docs) {
        if (keptIds.has(doc.id)) continue;
        batch.delete(collectionRef.doc(doc.id));
      }
    } catch (staleErr) {
      console.warn('Story library stale-doc scan failed (continuing):', staleErr);
    }
    await batch.commit();
    // Best-effort mirror of the story library into the issue doc. This mirrors
    // the original _helpers.ts persistence (which also mirrored onto the issue).
    // The count + light mirror are the important contract for the read side.
    await db
      .collection('magazine_issues')
      .doc(issueId)
      .set(
        { storyLibrary: items, storyLibraryCount: items.length, updatedAt: new Date().toISOString() },
        { merge: true },
      );
  }

  async saveIdmlDraft(draft: IdmlDraftRecord): Promise<void> {
    const db = this.requireDb();
    await db
      .collection('magazine_idml_drafts')
      .doc(draft.id)
      .set({ ...draft, updatedAt: new Date().toISOString() });
  }

  async deleteIdmlDraft(draftId: string): Promise<void> {
    const db = this.requireDb();
    await db.collection('magazine_idml_drafts').doc(draftId).delete();
  }
}
