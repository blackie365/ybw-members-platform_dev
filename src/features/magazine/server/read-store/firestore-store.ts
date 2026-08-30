import { MagazineIssue, MagazinePage, StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';
import { MagazineReadStore } from './interface';
import { adminDb } from '@/lib/firebase-admin';

import {
  getMagazineIssuesServer,
  getLatestIssueServer,
  getMagazineIssueServer,
  getMagazinePagesServer,
} from '@/lib/magazine-service-server';

import {
  getReaderEditionByIssueId,
  getReaderEditionById,
  listReaderEditions,
  getReaderEditionBySlug,
} from '@/features/magazine/server/simple-reader';

/**
 * Firestore-backed read store.
 *
 * This is a THIN DELEGATION wrapper over the existing (unchanged) Firestore
 * read functions. It exists to give the read layer a stable seam so a Postgres
 * implementation (PgMagazineReadStore) can be dropped in behind the same
 * interface in a later phase without touching any call site or the fragile
 * legacy AUTHORITY fallback chains inside simple-reader.ts.
 *
 * IMPORTANT: do not "simplify" or "fix" the underlying functions through this
 * wrapper — it must preserve existing behaviour exactly.
 */
export class FirestoreMagazineReadStore implements MagazineReadStore {
  getMagazineIssues(): Promise<MagazineIssue[]> {
    return getMagazineIssuesServer();
  }

  getMagazineIssue(issueId: string): Promise<MagazineIssue | null> {
    return getMagazineIssueServer(issueId);
  }

  getLatestIssue(): Promise<MagazineIssue | null> {
    return getLatestIssueServer();
  }

  getMagazinePages(issueId: string): Promise<MagazinePage[]> {
    return getMagazinePagesServer(issueId);
  }

  getReaderEditionByIssueId(issueId: string): Promise<ReaderEdition | null> {
    return getReaderEditionByIssueId(issueId);
  }

  getReaderEditionById(id: string): Promise<ReaderEdition | null> {
    return getReaderEditionById(id);
  }

  listReaderEditions(limit?: number): Promise<ReaderEdition[]> {
    return listReaderEditions(limit);
  }

  getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null> {
    return getReaderEditionBySlug(slug);
  }

  async getStoryLibrary(issueId: string): Promise<StoryLibraryItem[]> {
    if (!adminDb) return [];
    const collectionRef = adminDb.collection('magazine_story_library');
    const [sourceRefSnapshot, issueIdSnapshot] = await Promise.all([
      collectionRef
        .where('sourceRef', '>=', `${issueId}:`)
        .where('sourceRef', '<', `${issueId}:\uf8ff`)
        .get(),
      collectionRef.where('issueId', '==', issueId).get(),
    ]);
    const docMap = new Map<string, StoryLibraryItem>();
    for (const snapshot of [sourceRefSnapshot, issueIdSnapshot]) {
      for (const doc of snapshot.docs) {
        docMap.set(doc.id, { id: doc.id, ...(doc.data() as any) } as StoryLibraryItem);
      }
    }
    return [...docMap.values()];
  }

  async listIdmlDrafts(): Promise<any[]> {
    if (!adminDb) return [];
    const snapshot = await adminDb
      .collection('magazine_idml_drafts')
      .orderBy('updatedAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getIdmlDraft(draftId: string): Promise<any | null> {
    if (!adminDb) return null;
    const doc = await adminDb.collection('magazine_idml_drafts').doc(draftId).get();
    return doc.exists ? (doc.data() as any) : null;
  }
}
