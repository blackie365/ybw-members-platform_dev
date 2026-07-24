'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin';
import type { StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { checkAdmin } from '@/lib/server/auth-utils';
import { revalidatePath } from 'next/cache';
import { getPosts } from '@/lib/ghost';
import { parseIdml } from '@/lib/idml-parser';
import { mapIdmlToReaderPages, buildEditionMetadata, detectArticles } from '@/lib/idml-template-mapper';
import type { ReaderPage, ReaderEdition } from '@/features/magazine/domain/types';
import { upsertReaderEdition } from '@/features/magazine/server/simple-reader';

const STORY_LIBRARY_COLLECTION = 'magazine_story_library';

type StoryLibraryCollectionDoc = {
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

function normalizeStoryText(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function deriveStandfirst(value: string): string {
  const normalized = normalizeStoryText(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const sentence = normalized.split(/(?<=[.!?])\s+/)[0]?.trim() || normalized;
  return sentence.length <= 220 ? sentence : `${sentence.slice(0, 220).trimEnd()}...`;
}

function buildStoryLibraryIdentity(item: Partial<StoryLibraryItem>): string {
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

function mergeStoryLibraryItems(
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

function mapCollectionDocToStoryLibraryItem(
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

function resolveStoryLibraryDocId(issueId: string, item: StoryLibraryItem): string {
  const cleanId = String(item.id || '').trim();
  if (cleanId.startsWith(`${issueId}-`)) return cleanId;
  return `${issueId}-library-${cleanId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
}

function buildStoryLibrarySourceRef(issueId: string, item: StoryLibraryItem, docId: string): string {
  const sourceRef = String(item.sourceRef || '').trim();
  if (sourceRef) return sourceRef;

  const sourcePath = String(item.source?.path || '').trim();
  if (sourcePath) return `${issueId}:${sourcePath}`;

  const legacyId = docId.startsWith(`${issueId}-`) ? docId.slice(issueId.length + 1) : docId;
  return `${issueId}:${legacyId}`;
}

function mapStoryLibraryItemToCollectionDoc(
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

function buildIssueStoryLibraryMirror(
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

function normalizeStoryLibraryItems(storyLibrary: StoryLibraryItem[]): StoryLibraryItem[] {
  return Array.isArray(storyLibrary)
    ? storyLibrary
        .filter(Boolean)
        .map((item) => ({
          ...item,
          title: String(item.title || '').trim(),
          text: normalizeStoryText(item.text || ''),
          standfirst: String(item.standfirst || '').trim() || undefined,
          imageUrl: String(item.imageUrl || '').trim() || undefined,
          imageFileNames: Array.isArray(item.imageFileNames)
            ? item.imageFileNames.map((value) => String(value || '').trim()).filter(Boolean)
            : undefined,
          sourceRef: String(item.sourceRef || '').trim() || undefined,
        }))
        .filter((item) => item.title || item.text)
    : [];
}

async function persistStoryLibraryForIssue(
  issueId: string,
  storyLibrary: StoryLibraryItem[],
): Promise<StoryLibraryItem[]> {
  if (!adminDb) throw new Error('Database not initialized');

  const nextItems = normalizeStoryLibraryItems(storyLibrary);
  const existingItems = await getIssueStoryLibraryCollectionItems(issueId);
  const existingDocIds = new Set(existingItems.map((item) => resolveStoryLibraryDocId(issueId, item)));
  const nextDocIds = new Set(nextItems.map((item) => resolveStoryLibraryDocId(issueId, item)));
  const now = new Date().toISOString();

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

async function getIssueStoryLibraryCollectionItems(issueId: string): Promise<StoryLibraryItem[]> {
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

function inferStoryLibraryDefaults(input: {
  title: string;
  body: string;
  startPage: number;
}): Pick<StoryLibraryItem, 'includedInPremiumReader' | 'premiumReaderContentType' | 'premiumReaderPriority'> {
  const haystack = `${input.title} ${input.body.slice(0, 240)}`.toLowerCase();

  if (/\b(editor('?s)? note|from the editor|editorial)\b/.test(haystack)) {
    return {
      includedInPremiumReader: true,
      premiumReaderContentType: 'editorial',
      premiumReaderPriority: 85,
    };
  }

  if (/\b(profile|spotlight|member spotlight)\b/.test(haystack)) {
    return {
      includedInPremiumReader: true,
      premiumReaderContentType: 'profile',
      premiumReaderPriority: 58,
    };
  }

  if (/\b(column|opinion|comment|expert)\b/.test(haystack)) {
    return {
      includedInPremiumReader: true,
      premiumReaderContentType: 'column',
      premiumReaderPriority: 56,
    };
  }

  if (input.startPage <= 12) {
    return {
      includedInPremiumReader: true,
      premiumReaderContentType: 'lead',
      premiumReaderPriority: 72,
    };
  }

  return {
    includedInPremiumReader: true,
    premiumReaderContentType: 'feature',
    premiumReaderPriority: 48,
  };
}

async function uploadParsedIdmlImages(parsed: Awaited<ReturnType<typeof parseIdml>>, fileName: string) {
  const imageUrls: Record<string, string> = {};

  if (parsed.images.length === 0 || !adminStorage) return imageUrls;

  const bucket = adminStorage.bucket();
  const uploadPromises = parsed.images.map(async (img) => {
    const filePath = `magazine-import/${fileName}/${img.fileName}`;
    const storageFile = bucket.file(filePath);

    await storageFile.save(img.data, {
      metadata: { contentType: img.mimeType },
    });
    await storageFile.makePublic();

    return {
      fileName: img.fileName,
      url: `https://storage.googleapis.com/${bucket.name}/${filePath}`,
    };
  });

  const results = await Promise.all(uploadPromises);
  for (const result of results) {
    imageUrls[result.fileName] = result.url;
  }

  return imageUrls;
}

function buildStoryLibraryItemsFromParsedIdml(
  parsed: Awaited<ReturnType<typeof parseIdml>>,
  fileName: string,
  imageUrls: Record<string, string>,
): StoryLibraryItem[] {
  const articles = detectArticles(parsed.pages);
  const items: Array<StoryLibraryItem | null> = articles.map((article, index) => {
      const cleanTitle = normalizeStoryText(article.title || '');
      const cleanBody = normalizeStoryText(article.body || '');
      const imageFileNames = Array.from(
        new Set(
          (article.images || [])
            .map((value) => String(value || '').trim())
            .filter(Boolean),
        ),
      );
      const imageUrl = imageFileNames.find((value) => imageUrls[value]) || '';
      const defaults = inferStoryLibraryDefaults({
        title: cleanTitle,
        body: cleanBody,
        startPage: article.startPage,
      });

      if (!cleanTitle || cleanTitle === 'YorkshireBusinessWoman') return null;
      if (/^\d+$/.test(cleanTitle)) return null;
      if (/^\<\?ace/i.test(cleanTitle)) return null;
      if (cleanBody.length < 120) return null;

      return {
        id: `idml-${article.startPage}-${article.endPage}-${index + 1}`,
        title: cleanTitle,
        standfirst: deriveStandfirst(cleanBody) || undefined,
        text: cleanBody,
        imageUrl: imageUrl ? imageUrls[imageUrl] : undefined,
        imageFileNames,
        includedInPremiumReader: defaults.includedInPremiumReader,
        premiumReaderPriority: defaults.premiumReaderPriority,
        premiumReaderContentType: defaults.premiumReaderContentType,
        premiumReaderPlacementPreference: 'auto',
        sourceRef: `${fileName}:pages-${article.startPage}-${article.endPage}`,
        source: {
          type: 'idml',
          fileName,
          path: `pages-${article.startPage}-${article.endPage}`,
        },
        createdAt: new Date().toISOString(),
      } satisfies StoryLibraryItem;
    });

  return items.filter((item): item is StoryLibraryItem => item !== null);
}

export async function getGhostPostsAction(options?: any) {
  try {
    await checkAdmin();
    const hasGhostKey = Boolean(
      process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || process.env.GHOST_CONTENT_API_KEY
    );
    if (!hasGhostKey) {
      throw new Error('Ghost is not configured (missing Content API key).');
    }
    const posts = await getPosts(options);
    return { success: true, data: posts };
  } catch (error: any) {
    console.error("Error in getGhostPostsAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getMagazineIssuesAction() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .get();

    const issues = snapshot.docs.map(doc => {
      const data = doc.data();
      const serializedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value && typeof value === 'object' && 'seconds' in value) {
          acc[key] = new Date((value as any).seconds * 1000).toISOString();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      return {
        ...serializedData,
        id: doc.id
      };
    });

    return { success: true, data: issues };
  } catch (error: any) {
    console.error("Error in getMagazineIssuesAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateMagazineIssueAction(issueId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const { id: _ignoredId, ...rest } = data ?? {};
    await adminDb.collection('magazine_issues').doc(issueId).update({
      ...rest,
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/admin/magazine');
    revalidatePath('/magazine');
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getMagazineStoryLibraryAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Database not initialized');

    const [issueDoc, collectionItems] = await Promise.all([
      adminDb.collection('magazine_issues').doc(issueId).get(),
      getIssueStoryLibraryCollectionItems(issueId),
    ]);

    const issueData = (issueDoc.data() || {}) as { storyLibrary?: StoryLibraryItem[] };
    const issueItems = Array.isArray(issueData.storyLibrary) ? issueData.storyLibrary : [];
    const merged = mergeStoryLibraryItems(collectionItems, issueItems);

    return { success: true, data: merged };
  } catch (error: any) {
    console.error('Error in getMagazineStoryLibraryAction:', error);
    return { success: false, error: error.message };
  }
}

export async function saveMagazineStoryLibraryAction(issueId: string, storyLibrary: StoryLibraryItem[]) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Database not initialized');

    const resolvedItems = await persistStoryLibraryForIssue(issueId, storyLibrary);

    revalidatePath(`/admin/magazine/builder/${issueId}`);
    revalidatePath('/admin/magazine');
    return { success: true, data: resolvedItems };
  } catch (error: any) {
    console.error('Error in saveMagazineStoryLibraryAction:', error);
    return { success: false, error: error.message };
  }
}

export async function setLatestMagazineIssueAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const now = new Date().toISOString();
    const issuesRef = adminDb.collection('magazine_issues');

    await adminDb.runTransaction(async (tx) => {
      const latestSnap = await tx.get(issuesRef.where('isLatest', '==', true));
      for (const doc of latestSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { isLatest: false, updatedAt: now });
      }
      tx.set(issuesRef.doc(issueId), { isLatest: true, updatedAt: now }, { merge: true });
    });

    revalidatePath('/admin/magazine');
    revalidatePath('/new-edition');
    revalidatePath('/magazine');
    return { success: true };
  } catch (error: any) {
    console.error("Error in setLatestMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function setFeaturedFlipbookIssueAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const now = new Date().toISOString();
    const issuesRef = adminDb.collection('magazine_issues');

    await adminDb.runTransaction(async (tx) => {
      const featuredSnap = await tx.get(issuesRef.where('featureInFlipbook', '==', true));
      for (const doc of featuredSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { featureInFlipbook: false, updatedAt: now });
      }
      tx.set(issuesRef.doc(issueId), { featureInFlipbook: true, updatedAt: now }, { merge: true });
    });

    revalidatePath('/new-edition');
    return { success: true };
  } catch (error: any) {
    console.error("Error in setFeaturedFlipbookIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function createMagazineIssueAction(data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const { id: _ignoredId, ...rest } = data ?? {};
    const docRef = await adminDb.collection('magazine_issues').add({
      ...rest,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/admin/magazine');
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error in createMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMagazineIssueAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).delete();
    revalidatePath('/admin/magazine');
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getMagazinePagesAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('magazine_issues').doc(issueId).collection('pages')
      .orderBy('id', 'asc')
      .get();

    const pages = snapshot.docs.map(doc => {
      const data = doc.data();
      const serializedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value && typeof value === 'object' && 'seconds' in value) {
          acc[key] = new Date((value as any).seconds * 1000).toISOString();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      return {
        docId: doc.id,
        ...serializedData
      };
    });

    return { success: true, data: pages };
  } catch (error: any) {
    console.error("Error in getMagazinePagesAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateMagazinePageAction(issueId: string, pageId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    revalidatePath(`/admin/magazine/builder/${issueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function addMagazinePageAction(issueId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const docRef = await adminDb.collection('magazine_issues').doc(issueId).collection('pages').add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    revalidatePath(`/admin/magazine/builder/${issueId}`);
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error in addMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMagazinePageAction(issueId: string, pageId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).delete();
    revalidatePath(`/admin/magazine/builder/${issueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function fetchIssuuMetadataAction(url: string) {
  try {
    await checkAdmin();

    const oembedUrl = `https://issuu.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch metadata from Issuu');
    }

    const data = await response.json();

    let highResThumbnail = data.thumbnail_url;
    if (data.thumbnail_url) {
      const idMatch = data.thumbnail_url.match(/(?:image\.issuu\.com|image\.isu\.pub)\/([^\/]+)\//);
      if (idMatch && idMatch[1]) {
        highResThumbnail = `https://image.isu.pub/${idMatch[1]}/jpg/page_1.jpg`;
      } else {
        highResThumbnail = data.thumbnail_url
          .replace(/_thumb_(?:small|medium)\.jpg/i, '.jpg')
          .replace(/_thumb_large\.jpg/i, '.jpg')
          .replace(/issuu\.com/i, 'isu.pub');
      }
    }

    return {
      success: true,
      data: {
        title: data.title,
        thumbnailUrl: highResThumbnail,
        authorName: data.author_name,
        description: data.description
      }
    };
  } catch (error: any) {
    console.error("Error in fetchIssuuMetadataAction:", error);
    return { success: false, error: error.message };
  }
}

export async function importIdmlAction(idmlBase64: string, fileName: string) {
  try {
    await checkAdmin();

    const buffer = Buffer.from(idmlBase64, 'base64');
    const data = await processIdmlBuffer(buffer, fileName);
    return { success: true, data };
  } catch (error: any) {
    console.error('Error importing IDML:', error);
    return { success: false, error: error.message || 'Failed to parse IDML file' };
  }
}

export async function importIdmlFromUrlAction(fileUrl: string, fileName: string) {
  try {
    await checkAdmin();

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const data = await processIdmlBuffer(buffer, fileName);
    return { success: true, data };
  } catch (error: any) {
    console.error('Error importing IDML from URL:', error);
    return { success: false, error: error.message || 'Failed to import IDML file' };
  }
}

async function processIdmlBuffer(buffer: Buffer, fileName: string) {
  const parsed = await parseIdml(buffer);

  if (parsed.pages.length === 0) {
    throw new Error('No readable content found in the IDML file');
  }

  const imageUrls = await uploadParsedIdmlImages(parsed, fileName);

  let pages = mapIdmlToReaderPages(parsed.pages);

  pages = pages.map((page) => ({
    ...page,
    content: {
      ...page.content,
      imageUrl: page.content.imageUrl
        ? (imageUrls[page.content.imageUrl] || page.content.imageUrl)
        : '',
      imageUrls: (page.content.imageUrls || []).map(
        (name) => imageUrls[name] || name,
      ),
    },
  }));

  const metadata = buildEditionMetadata(pages, fileName);

  return {
    pages,
    metadata,
    pageCount: parsed.pageCount,
    storyCount: parsed.pages.reduce((sum, p) => sum + p.stories.length, 0),
    imageCount: parsed.images.length,
    imageUrls,
  };
}

export async function extractIdmlStoryLibraryAction(idmlBase64: string, fileName: string) {
  try {
    await checkAdmin();

    const buffer = Buffer.from(idmlBase64, 'base64');
    const parsed = await parseIdml(buffer);

    if (parsed.pages.length === 0) {
      throw new Error('No readable content found in the IDML file');
    }

    const imageUrls = await uploadParsedIdmlImages(parsed, fileName);
    const storyLibrary = buildStoryLibraryItemsFromParsedIdml(parsed, fileName, imageUrls);

    return {
      success: true,
      data: {
        storyLibrary,
        pageCount: parsed.pageCount,
        storyCount: storyLibrary.length,
        imageCount: parsed.images.length,
      },
    };
  } catch (error: any) {
    console.error('Error extracting IDML story library:', error);
    return { success: false, error: error.message || 'Failed to extract IDML stories' };
  }
}

export async function importIdmlToStoryLibraryAction(issueId: string, idmlBase64: string, fileName: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Database not initialized');

    const buffer = Buffer.from(idmlBase64, 'base64');
    const parsed = await parseIdml(buffer);

    if (parsed.pages.length === 0) {
      throw new Error('No readable content found in the IDML file');
    }

    const imageUrls = await uploadParsedIdmlImages(parsed, fileName);
    const importedItems = buildStoryLibraryItemsFromParsedIdml(parsed, fileName, imageUrls);

    const [issueDoc, collectionItems] = await Promise.all([
      adminDb.collection('magazine_issues').doc(issueId).get(),
      getIssueStoryLibraryCollectionItems(issueId),
    ]);

    const issueData = (issueDoc.data() || {}) as { storyLibrary?: StoryLibraryItem[] };
    const issueItems = Array.isArray(issueData.storyLibrary) ? issueData.storyLibrary : [];
    const existingItems = mergeStoryLibraryItems(collectionItems, issueItems);
    const nextLibrary = mergeStoryLibraryItems(existingItems, importedItems);
    const savedItems = await persistStoryLibraryForIssue(issueId, nextLibrary);

    revalidatePath(`/admin/magazine/builder/${issueId}`);
    revalidatePath('/admin/magazine');

    return {
      success: true,
      data: {
        storyLibrary: savedItems,
        importedCount: importedItems.length,
        totalCount: savedItems.length,
        pageCount: parsed.pageCount,
        storyCount: importedItems.length,
        imageCount: parsed.images.length,
      },
    };
  } catch (error: any) {
    console.error('Error importing IDML into Story Library:', error);
    return { success: false, error: error.message || 'Failed to import IDML stories into Story Library' };
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function publishIdmlEditionAction(params: {
  pages: ReaderPage[];
  title: string;
  description: string;
  coverImage: string;
  publishDate?: string;
}) {
  try {
    await checkAdmin();

    const slug = slugify(params.title) || `edition-${Date.now()}`;
    const now = new Date().toISOString();

    const edition: ReaderEdition = {
      id: `idml-${slug}-${Date.now().toString(36)}`,
      slug,
      title: params.title,
      description: params.description,
      coverImage: params.coverImage,
      publishDate: params.publishDate || now,
      pageCount: params.pages.length,
      pages: params.pages,
      createdAt: now,
    };

    await upsertReaderEdition(edition);
    revalidatePath('/magazine');

    return { success: true, data: { id: edition.id, slug: edition.slug } };
  } catch (error: any) {
    console.error('Error publishing IDML edition:', error);
    return { success: false, error: error.message || 'Failed to publish edition' };
  }
}

const IDML_DRAFT_COLLECTION = 'magazine_idml_drafts';

export async function saveIdmlDraft(draft: {
  id: string;
  pages: ReaderPage[];
  metadata: { title: string; description: string; coverImage: string };
  stats: { pageCount: number; storyCount: number; imageCount: number };
  fileName: string;
}) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Firebase Admin not configured');

    await adminDb.collection(IDML_DRAFT_COLLECTION).doc(draft.id).set({
      ...draft,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error saving IDML draft:', error);
    return { success: false, error: error.message };
  }
}

export async function loadIdmlDraft(draftId: string) {
  try {
    await checkAdmin();
    if (!adminDb) return { success: false, error: 'Firebase Admin not configured' };

    const doc = await adminDb.collection(IDML_DRAFT_COLLECTION).doc(draftId).get();
    if (!doc.exists) return { success: false, error: 'Draft not found' };

    return { success: true, data: doc.data() as Record<string, any> };
  } catch (error: any) {
    console.error('Error loading IDML draft:', error);
    return { success: false, error: error.message };
  }
}

export async function loadLatestIdmlDraft() {
  try {
    await checkAdmin();
    if (!adminDb) return { success: false, error: 'Firebase Admin not configured' };

    const snapshot = await adminDb
      .collection(IDML_DRAFT_COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return { success: false, error: 'No draft found' };

    const doc = snapshot.docs[0];
    return { success: true, data: { id: doc.id, ...doc.data() } };
  } catch (error: any) {
    console.error('Error loading latest IDML draft:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteIdmlDraft(draftId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Firebase Admin not configured');

    await adminDb.collection(IDML_DRAFT_COLLECTION).doc(draftId).delete();
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting IDML draft:', error);
    return { success: false, error: error.message };
  }
}
