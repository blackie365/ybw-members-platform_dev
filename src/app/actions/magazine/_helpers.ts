import { adminDb } from '@/lib/firebase-admin';
import type { StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { revalidatePath } from 'next/cache';
import { normalizeStoryLibraryItem, normalizeStoryLibraryImageFields } from '@/lib/magazine-utils';

export function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    console.warn(`safeRevalidatePath failed for ${path}:`, error);
  }
}

export const STORY_LIBRARY_COLLECTION = 'magazine_story_library';

export type StoryLibraryCollectionDoc = {
  title?: string;
  author?: string;
  standfirst?: string;
  body?: string;
  heroImage?: {
    src?: string;
    alt?: string;
  };
  source?: string;
  sourceRef?: string;
  issueId?: string;
  issueTags?: string[];
  tags?: string[];
  status?: string;
  priority?: number;
  contentType?: string;
  createdAt?: string;
  updatedAt?: string;
  includedInEditionCandidatePool?: boolean;
  placementConfidence?: number;
  editorialConfidence?: number;
  manualNotes?: string;
  pullQuotes?: string[];
  gallery?: Array<{ src?: string; alt?: string }>;
};

export function normalizeStoryText(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function deriveStandfirst(value: string): string {
  const normalized = normalizeStoryText(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const sentence = normalized.split(/(?<=[.!?])\s+/)[0]?.trim() || normalized;
  return sentence.length <= 220 ? sentence : `${sentence.slice(0, 220).trimEnd()}...`;
}

export function buildStoryLibraryIdentity(item: Partial<StoryLibraryItem>): string {
  const sourceRef = String(item.sourceRef || '').trim().toLowerCase();
  if (sourceRef) return `source:${sourceRef}`;

  const sourceType = String(item.source?.type || '').trim().toLowerCase();
  const fileName = String(item.source?.fileName || '').trim().toLowerCase();
  const path = String(item.source?.path || '').trim().toLowerCase();
  if (sourceType || fileName || path) return `path:${sourceType}:${fileName}:${path}`;

  const title = String(item.title || '').trim().toLowerCase();
  const body = normalizeStoryText(String(item.text || '')).slice(0, 180).toLowerCase();
  return `text:${title}:${body}`;
}

export function mergeStoryLibraryItems(
  collectionItems: StoryLibraryItem[],
  issueItems: StoryLibraryItem[],
): StoryLibraryItem[] {
  const merged: StoryLibraryItem[] = [];
  const seen = new Set<string>();

  for (const item of [...collectionItems, ...issueItems]) {
    const key = buildStoryLibraryIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function mapCollectionDocToStoryLibraryItem(
  docId: string,
  data: StoryLibraryCollectionDoc,
): StoryLibraryItem {
  const body = normalizeStoryText(data.body || '');
  const imageUrl =
    String(data.heroImage?.src || '').trim() ||
    String(data.gallery?.[0]?.src || '').trim() ||
    undefined;

  return {
    id: docId,
    title: String(data.title || '').trim() || 'Untitled Story',
    author: String(data.author || '').trim() || undefined,
    standfirst: String(data.standfirst || '').trim() || deriveStandfirst(body) || undefined,
    text: body,
    imageUrl,
    includedInPremiumReader: data.includedInEditionCandidatePool !== false,
    premiumReaderPriority: typeof data.priority === 'number' ? data.priority : undefined,
    premiumReaderContentType: String(data.contentType || '').trim() || undefined,
    premiumReaderPlacementPreference: 'auto',
    imageFileNames: [],
    sourceRef: String(data.sourceRef || '').trim() || undefined,
    source: {
      type: String(data.source || '').trim() || 'legacy',
      path: String(data.sourceRef || '').trim() || undefined,
    },
    createdAt: String(data.createdAt || '').trim() || new Date().toISOString(),
  };
}

export function resolveStoryLibraryDocId(issueId: string, item: StoryLibraryItem): string {
  const cleanId = String(item.id || '').trim();
  if (cleanId.startsWith(`${issueId}-`)) return cleanId;
  return `${issueId}-library-${cleanId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
}

export function buildStoryLibrarySourceRef(issueId: string, item: StoryLibraryItem, docId: string): string {
  const sourceRef = String(item.sourceRef || '').trim();
  if (sourceRef) return sourceRef;

  const sourcePath = String(item.source?.path || '').trim();
  if (sourcePath) return `${issueId}:${sourcePath}`;

  const legacyId = docId.startsWith(`${issueId}-`) ? docId.slice(issueId.length + 1) : docId;
  return `${issueId}:${legacyId}`;
}

export function mapStoryLibraryItemToCollectionDoc(
  issueId: string,
  item: StoryLibraryItem,
  docId: string,
): StoryLibraryCollectionDoc {
  const cleanText = normalizeStoryText(item.text || '');
  const title = String(item.title || '').trim() || 'Untitled Story';
  const sourceRef = buildStoryLibrarySourceRef(issueId, item, docId);
  const imageUrl = String(item.imageUrl || '').trim();
  const contentType = String(item.premiumReaderContentType || '').trim() || 'feature';
  const createdAt = String(item.createdAt || '').trim() || new Date().toISOString();

  return {
    title,
    author: String(item.author || '').trim() || undefined,
    standfirst: String(item.standfirst || '').trim() || deriveStandfirst(cleanText) || undefined,
    body: cleanText,
    heroImage: imageUrl
      ? {
          src: imageUrl,
          alt: title,
        }
      : undefined,
    source: String(item.source?.type || '').trim() || 'manual',
    sourceRef,
    issueId,
    issueTags: [],
    tags: ['imported', contentType],
    status: 'approved',
    priority:
      typeof item.premiumReaderPriority === 'number' ? item.premiumReaderPriority : 40,
    contentType,
    includedInEditionCandidatePool: item.includedInPremiumReader !== false,
    placementConfidence: 0.7,
    editorialConfidence: 0.9,
    manualNotes: item.source?.fileName
      ? `Imported from ${item.source.fileName}`
      : undefined,
    pullQuotes: [],
    gallery: imageUrl ? [{ src: imageUrl, alt: title }] : [],
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export function buildIssueStoryLibraryMirror(
  items: StoryLibraryItem[],
  mode: 'full' | 'light' = 'full',
): StoryLibraryItem[] {
  return items.map((item) => {
    const cleanText = normalizeStoryText(item.text || '');
    const imageFileNames = Array.isArray(item.imageFileNames)
      ? item.imageFileNames.map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    return {
      id: String(item.id || '').trim(),
      title: String(item.title || '').trim() || 'Untitled Story',
      author: String(item.author || '').trim() || undefined,
      standfirst: String(item.standfirst || '').trim() || deriveStandfirst(cleanText) || undefined,
      text: mode === 'full' ? cleanText : cleanText.slice(0, 1600),
      imageUrl: String(item.imageUrl || '').trim() || undefined,
      includedInPremiumReader: item.includedInPremiumReader !== false,
      premiumReaderPriority:
        typeof item.premiumReaderPriority === 'number' ? item.premiumReaderPriority : undefined,
      premiumReaderContentType: String(item.premiumReaderContentType || '').trim() || undefined,
      premiumReaderPlacementPreference:
        String(item.premiumReaderPlacementPreference || '').trim() || 'auto',
      imageFileNames: mode === 'full' ? imageFileNames : imageFileNames.slice(0, 8),
      sourceRef: String(item.sourceRef || '').trim() || undefined,
      source: {
        type: String(item.source?.type || '').trim() || undefined,
        fileName: String(item.source?.fileName || '').trim() || undefined,
        path: String(item.source?.path || '').trim() || undefined,
      },
      createdAt: String(item.createdAt || '').trim() || new Date().toISOString(),
    };
  });
}

export function normalizeStoryLibraryItems(storyLibrary: StoryLibraryItem[]): StoryLibraryItem[] {
  return Array.isArray(storyLibrary)
    ? storyLibrary
        .filter(Boolean)
        .map((item) =>
          normalizeStoryLibraryItem({
            ...item,
            title: String(item.title || '').trim(),
            text: normalizeStoryText(item.text || ''),
            standfirst: String(item.standfirst || '').trim() || undefined,
            imageUrl: String(item.imageUrl || '').trim() || undefined,
            imageFileNames: Array.isArray(item.imageFileNames)
              ? item.imageFileNames.map((value) => String(value || '').trim()).filter(Boolean)
              : undefined,
            sourceRef: String(item.sourceRef || '').trim() || undefined,
          } as StoryLibraryItem),
        )
        .filter((item) => item.title || item.text)
    : [];
}

export async function persistStoryLibraryForIssue(
  issueId: string,
  storyLibrary: StoryLibraryItem[],
): Promise<StoryLibraryItem[]> {
  if (!adminDb) throw new Error('Database not initialized');

  const normalized = normalizeStoryLibraryImageFields(storyLibrary || []);
  const nextItems = normalizeStoryLibraryItems(normalized);
  const existingItems = await getIssueStoryLibraryCollectionItems(issueId);
  const existingDocIds = new Set(existingItems.map((item) => resolveStoryLibraryDocId(issueId, item)));
  const nextDocIds = new Set(nextItems.map((item) => resolveStoryLibraryDocId(issueId, item)));
  const now = new Date().toISOString();

  const engine = (process.env.MAGAZINE_STORE || 'firestore').toLowerCase();
  if (engine === 'pg' || engine === 'postgres') {
    // Phase 5: persist through the composite write store (Postgres primary +
    // Firestore mirror). The PG writer projects the story library onto the
    // issue row for the public reader; the Firestore mirror keeps the admin
    // builder consistent. Stale-doc cleanup for the Firestore legacy collection
    // is handled by the mirror's own delete logic.
    const { getMagazineWriteStore } = await import('@/features/magazine/server/write-store');
    const resolvedNext = nextItems.map((item) => ({
      ...item,
      id: resolveStoryLibraryDocId(issueId, item),
    }));
    await getMagazineWriteStore().persistStoryLibrary(issueId, resolvedNext);

    const persistedItems = await getIssueStoryLibraryCollectionItems(issueId);
    return persistedItems.length > 0
      ? mergeStoryLibraryItems(persistedItems, nextItems)
      : nextItems;
  }

  // Default (Firestore) engine: original batch upsert + stale-doc deletion +
  // issue mirror, preserved so behaviour is byte-for-byte unchanged.
  const batch = adminDb.batch();

  for (const item of nextItems) {
    const docId = resolveStoryLibraryDocId(issueId, item);
    const docRef = adminDb.collection(STORY_LIBRARY_COLLECTION).doc(docId);
    batch.set(docRef, mapStoryLibraryItemToCollectionDoc(issueId, item, docId), { merge: true });
  }

  for (const docId of existingDocIds) {
    if (nextDocIds.has(docId)) continue;
    batch.delete(adminDb.collection(STORY_LIBRARY_COLLECTION).doc(docId));
  }

  await batch.commit();

  try {
    await adminDb.collection('magazine_issues').doc(issueId).set({
      storyLibrary: buildIssueStoryLibraryMirror(nextItems, 'full'),
      storyLibraryCount: nextItems.length,
      updatedAt: now,
    }, { merge: true });
  } catch (mirrorError) {
    console.warn('Full story library mirror failed, retrying with light mirror:', mirrorError);
    try {
      await adminDb.collection('magazine_issues').doc(issueId).set({
        storyLibrary: buildIssueStoryLibraryMirror(nextItems, 'light'),
        storyLibraryCount: nextItems.length,
        updatedAt: now,
      }, { merge: true });
    } catch (lightMirrorError) {
      console.warn('Light story library mirror failed, keeping collection-only records:', lightMirrorError);
      await adminDb.collection('magazine_issues').doc(issueId).set({
        storyLibraryCount: nextItems.length,
        updatedAt: now,
      }, { merge: true });
    }
  }

  const persistedItems = await getIssueStoryLibraryCollectionItems(issueId);
  return persistedItems.length > 0
    ? mergeStoryLibraryItems(persistedItems, nextItems)
    : nextItems;
}

export async function getIssueStoryLibraryCollectionItems(issueId: string): Promise<StoryLibraryItem[]> {
  if (!issueId) return [];

  const engine = (process.env.MAGAZINE_STORE || 'firestore').toLowerCase();
  if (engine === 'pg' || engine === 'postgres') {
    try {
      const { getMagazineReadStore } = await import('@/features/magazine/server/read-store');
      const items = await getMagazineReadStore().getStoryLibrary(issueId);
      if (items && Array.isArray(items)) return items;
    } catch (err) {
      console.warn('[getIssueStoryLibraryCollectionItems] PG read failed, falling back to Firestore:', err);
    }
  }
  if (!adminDb) throw new Error('Database not initialized');

  const collectionRef = adminDb.collection(STORY_LIBRARY_COLLECTION);
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
      docMap.set(doc.id, mapCollectionDocToStoryLibraryItem(doc.id, doc.data() as StoryLibraryCollectionDoc));
    }
  }

  return [...docMap.values()];
}
