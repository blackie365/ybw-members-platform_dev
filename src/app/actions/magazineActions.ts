'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin';
import type { StoryLibraryItem, MagazinePage } from '@/components/admin/magazine-builder/types';
import { checkAdmin } from '@/lib/server/auth-utils';
import { revalidatePath } from 'next/cache';
import { getPosts } from '@/lib/ghost';
import { parseIdml } from '@/lib/idml-parser';
import { mapIdmlToReaderPages, buildEditionMetadata, detectArticles, detectAdPage } from '@/lib/idml-template-mapper';
import type { ReaderPage, ReaderEdition } from '@/features/magazine/domain/types';
import { upsertReaderEdition, syncReaderEditionCoverFromIssue, syncReaderEditionsForIssue, getReaderEditionIdBySlug, listReaderEditions, deleteReaderEdition, getReaderEditionByIssueId, getReaderEditionById, hydrateEditionWithLegacyPages, CURRENT_READER_SCHEMA_VERSION } from '@/features/magazine/server/simple-reader';
import { deriveIssueSlug } from '@/features/magazine/domain/builder-to-reader';
import { fixMagazineImageUrl, hydrateReaderEditionContents, normalizeMagazinePageContent, normalizeStoryLibraryItem } from '@/lib/magazine-utils';
import {
  ReaderEditionSchema,
  ReaderPageSchema,
  MagazinePageSchema,
  StoryLibraryItemSchema,
  MagazineIssueSchema,
  safeParseMagazine,
} from '@/features/magazine/domain/validation-schemas';

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    console.warn(`safeRevalidatePath failed for ${path}:`, error);
  }
}

function normalizeImageUrl(raw: any): string {
  if (typeof raw !== 'string') return '';
  let value = raw.trim();
  if (!value) return '';
  while (/^[`'"<>\s]+|[`'"<>\s]+$/g.test(value)) {
    value = value.replace(/^[`'"<>\s]+/, '').replace(/[`'"<>\s]+$/, '');
  }
  if (/^(undefined|null|none|n\/a)$/i.test(value)) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\//i.test(value)) return value;
  const gsMatch = value.match(/^gs:\/\/([^/]+)\/(.+)$/i);
  if (gsMatch) {
    const bucket = gsMatch[1];
    const path = gsMatch[2];
    try {
      const encodedPath = encodeURIComponent(path);
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
    } catch {
      return '';
    }
  }
  return value && /^https?:/i.test(value) ? value : '';
}

function normalizeStoryLibraryImageFields<T extends any>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const prim = ['imageUrl', 'image', 'featureImage', 'heroImage', 'mainImage', 'coverImage', 'photo', 'headshot', 'portrait', 'partnerLogo', 'logoImage', 'backgroundImage', 'logo', 'pdfUrl'];
  const arrs = ['imageUrls', 'images', 'gallery', 'additionalImages', 'imageFileNames', 'logoImages', 'coverImages'];
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const next: any = { ...item };
    for (const k of prim) {
      if (k in next) {
        next[k] = normalizeImageUrl(next[k]);
      }
    }
    for (const k of arrs) {
      if (Array.isArray(next[k])) {
        next[k] = next[k]
          .map((entry: any) => normalizeImageUrl(entry))
          .filter((entry: string) => entry.length > 0);
      }
    }
    if (typeof next.content === 'object' && next.content !== null) {
      const c: any = { ...next.content };
      for (const k of prim) {
        if (k in c) c[k] = normalizeImageUrl(c[k]);
      }
      for (const k of arrs) {
        if (Array.isArray(c[k])) {
          c[k] = c[k].map((entry: any) => normalizeImageUrl(entry)).filter((s: string) => s.length > 0);
        }
      }
      next.content = c;
    }
    return next as T;
  });
}

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

function parseGoogleStoragePath(storagePath: string): { bucketName?: string; objectPath: string } {
  const trimmed = String(storagePath || '').trim();
  if (!trimmed) {
    throw new Error('Storage path is required');
  }

  if (trimmed.startsWith('gs://')) {
    const withoutScheme = trimmed.replace(/^gs:\/\//i, '');
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex === -1) {
      throw new Error('Storage path must include both bucket and object path');
    }

    return {
      bucketName: withoutScheme.slice(0, slashIndex).trim(),
      objectPath: withoutScheme.slice(slashIndex + 1).trim(),
    };
  }

  return { objectPath: trimmed.replace(/^\/+/, '') };
}

function isFirebaseStorageUrl(url: string): { bucket?: string; objectPath?: string } | null {
  const s = String(url || '').trim();
  if (!s) return null;

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();

    // Pattern A: firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>[...]
    if (host === 'firebasestorage.googleapis.com' || host === 'www.firebasestorage.googleapis.com') {
      const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (m) {
        const bucket = decodeURIComponent(m[1]);
        const objectPath = decodeURIComponent(m[2]).replace(/\+/g, ' ');
        return { bucket, objectPath };
      }
    }

    // Pattern B: storage.googleapis.com/<bucket>/<path> (buildPublicStorageUrl format)
    if (host === 'storage.googleapis.com' || host === 'www.storage.googleapis.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const bucket = parts[0];
        const objectPath = parts.slice(1).map(decodeURIComponent).join('/');
        return { bucket, objectPath };
      }
    }

    // Pattern C: storage.cloud.google.com/<bucket>/<path>
    if (host.endsWith('.firebasestorage.app')) {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 1) {
        return { bucket: host, objectPath: parts.map(decodeURIComponent).join('/') };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function downloadIdmlBufferFromStoragePath(storagePath: string): Promise<{ buffer: Buffer; bucketName: string; objectPath: string }> {
  if (!adminStorage) throw new Error('Firebase Admin Storage not configured');

  const { bucketName, objectPath } = parseGoogleStoragePath(storagePath);
  if (!objectPath) throw new Error('Storage path has no object');

  const bucket = bucketName ? adminStorage.bucket(bucketName) : adminStorage.bucket();
  const [buffer] = await bucket.file(objectPath).download();
  if (!buffer || buffer.length === 0) throw new Error(`Downloaded file is empty: gs://${bucketName || bucket.name}/${objectPath}`);

  return { buffer, bucketName: bucketName || bucket.name, objectPath };
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

async function persistStoryLibraryForIssue(
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
      url: buildPublicStorageUrl(bucket.name, filePath),
    };
  });

  const results = await Promise.all(uploadPromises);
  for (const result of results) {
    imageUrls[result.fileName] = result.url;
  }

  return imageUrls;
}

function buildPublicStorageUrl(bucketName: string, filePath: string): string {
  // Firebase Storage public URL strategy — PROVEN 2026-08-14 on production
  // `newmembersdirectory130325.firebasestorage.app` with real browser
  // Origin header:
  //
  // The legacy REST v0 API pattern returns HTTP 400 for modern
  // `.firebasestorage.app` alias buckets when a browser `Origin:` header is
  // present, which then triggers Chromium ORB (net::ERR_BLOCKED_BY_ORB)
  // and ZERO images paint.
  //
  // The direct-CDN path pattern below returns HTTP 200 image/jpeg with
  // `Access-Control-Allow-Origin: *` and NO `Cross-Origin-Resource-Policy:`
  // response header, which ORB does not block and paints correctly in
  // every browser.
  //
  // Projects created after mid-2024 DO NOT have a physical
  // `<proj>.appspot.com` GCS bucket at all — that spelling returns
  // NoSuchBucket. So we NEVER rewrite the Admin SDK's bucket.name to a
  // different spelling; we keep the EXACT bucket name the Admin SDK gave us.
  //
  // Canonical output (defeats ORB on every Firebase project type):
  //   https://storage.googleapis.com/<EXACT_BUCKET>/<safeSegmentEncodedPath>
  const bucket = String(bucketName || '').trim();
  const path = String(filePath || '');
  const safeSegmentEncodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://storage.googleapis.com/${bucket}/${safeSegmentEncodedPath}`;
}

function isPreferredStoryLibraryImageFileName(fileName: string): boolean {
  const cleanName = String(fileName || '').trim();
  if (!cleanName) return false;
  if (!/\.(png|jpe?g|webp|gif)$/i.test(cleanName)) return false;
  if (/(^|[^a-z])(logo|advert|adverts|facebook post|bbw\s*2025|bbw\s*2026)([^a-z]|$)/i.test(cleanName)) {
    return false;
  }

  return true;
}

async function uploadStoryLibraryArticleImages(
  parsed: Awaited<ReturnType<typeof parseIdml>>,
  fileName: string,
  storyLibrary: StoryLibraryItem[],
) {
  const imageUrls: Record<string, string> = {};

  if (parsed.images.length === 0 || !adminStorage || storyLibrary.length === 0) {
    return imageUrls;
  }

  const imagesByFileName = new Map(
    parsed.images.map((img) => [img.fileName, img] as const),
  );
  const requestedFileNames = Array.from(
    new Set(
      storyLibrary
        .flatMap((item) => {
          const imageFileNames = Array.isArray(item.imageFileNames)
            ? item.imageFileNames
                .map((value) => String(value || '').trim())
                .filter(Boolean)
            : [];

          const preferredFileName =
            imageFileNames.find((value) => isPreferredStoryLibraryImageFileName(value) && imagesByFileName.has(value)) ||
            imageFileNames.find((value) => /\.(png|jpe?g|webp|gif|svg)$/i.test(value) && imagesByFileName.has(value)) ||
            imageFileNames.find((value) => imagesByFileName.has(value));

          return preferredFileName ? [preferredFileName] : [];
        }),
    ),
  );

  if (requestedFileNames.length === 0) {
    return imageUrls;
  }

  const bucket = adminStorage.bucket();
  const uploadResults = await Promise.all(
    requestedFileNames.map(async (requestedFileName) => {
      const parsedImage = imagesByFileName.get(requestedFileName);
      if (!parsedImage) return null;

      const filePath = `magazine-import/${fileName}/story-library/${parsedImage.fileName}`;
      const storageFile = bucket.file(filePath);

      await storageFile.save(parsedImage.data, {
        metadata: { contentType: parsedImage.mimeType },
      });
      await storageFile.makePublic();

      return {
        fileName: parsedImage.fileName,
        url: buildPublicStorageUrl(bucket.name, filePath),
      };
    }),
  );

  for (const result of uploadResults) {
    if (!result) continue;
    imageUrls[result.fileName] = result.url;
  }

  return imageUrls;
}

function normLabel(s: any): string {
  return String(s || '')
    .trim()
    .replace(/[\s._-]+/g, '')
    .toLowerCase();
}

function pageHasLabel(parsedPage: any, targetLabel: string): boolean {
  const labelsRaw: string[] = Array.isArray(parsedPage?.labels) ? parsedPage.labels : [];
  const frameLabels: string[] = (parsedPage?.frames || [])
    .map((f: any) => f?.label)
    .filter(Boolean);
  const allLabels = Array.from(new Set([...labelsRaw, ...frameLabels])).filter(Boolean);
  const target = normLabel(targetLabel);
  if (allLabels.some((l) => normLabel(l) === target)) return true;

  // Aggregate label groups (e.g. targetLabel = "EditorsFrame" → matches
  // EditorsTitleFrame / EditorsBodyFrame / EditorsImageFrame as well, so
  // the three-part frame labeling pattern used in the August 2026 IDML
  // gets identified as the editor page even without the aggregate tag.)
  if (target === "editorsframe") {
    const variants = ["editorstitleframe", "editorsbodyframe", "editorsimageframe"];
    if (allLabels.some((l) => {
      const n = normLabel(l);
      return variants.includes(n) || n.startsWith("editors") || n.startsWith("editor");
    })) {
      return true;
    }
  }
  return false;
}

function extractPageText(parsedPage: any, includeTitles = true): string {
  const stories: any[] = Array.isArray(parsedPage?.stories) ? parsedPage.stories : [];
  const allFrames: any[] = Array.isArray(parsedPage?.frames) ? parsedPage.frames : [];

  // For EditorsFrame style pages: if the page uses the three-part labeling
  // pattern (EditorsTitleFrame / EditorsBodyFrame) pull those stories
  // explicitly (title first, body second) so we get semantic ordering even
  // when frame order in the IDML XML is chaotic / later in the stack.
  const findFrame = (label: string) =>
    allFrames.find((f) => normLabel(f?.label) === normLabel(label));
  const findStoryForFrame = (frame: any) =>
    frame?.storyId ? stories.find((s) => s.id === frame.storyId) : undefined;

  const explicitTitleFrame = findFrame("EditorsTitleFrame");
  const explicitBodyFrame = findFrame("EditorsBodyFrame");
  const explicitTitleStory = findStoryForFrame(explicitTitleFrame);
  const explicitBodyStory = findStoryForFrame(explicitBodyFrame);

  const frameStoryIds = new Set<string>(
    [...allFrames]
      .sort((a: any, b: any) => {
        // Keep original order-based sort, but bubble EditorsTitleFrame to
        // the front and EditorsBodyFrame to second, so those stories are
        // always serialized in the right order on Editor's Note pages.
        const la = normLabel(a?.label);
        const lb = normLabel(b?.label);
        const ra = la === "editorstitleframe" ? 0 : la === "editorsbodyframe" ? 1 : 2;
        const rb = lb === "editorstitleframe" ? 0 : lb === "editorsbodyframe" ? 1 : 2;
        if (ra !== rb) return ra - rb;
        return (a.order || 0) - (b.order || 0);
      })
      .map((f: any) => f?.storyId)
      .filter(Boolean),
  );
  const seen = new Set<string>();
  const orderedStories: any[] = [];
  if (explicitTitleStory) {
    seen.add(explicitTitleStory.id);
    orderedStories.push(explicitTitleStory);
  }
  if (explicitBodyStory && !seen.has(explicitBodyStory.id)) {
    seen.add(explicitBodyStory.id);
    orderedStories.push(explicitBodyStory);
  }
  for (const fid of frameStoryIds) {
    const s = stories.find((st) => st.id === fid);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      orderedStories.push(s);
    }
  }
  if (orderedStories.length === 0) {
    for (const s of stories) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        orderedStories.push(s);
      }
    }
  }
  const titleStoryIds = new Set<string>();
  for (const f of allFrames) {
    if (f?.isTitle) {
      titleStoryIds.add(f?.storyId);
    }
  }
  if (explicitTitleStory?.id) titleStoryIds.add(explicitTitleStory.id);
  const textParts = orderedStories
    .filter((s) => includeTitles || !titleStoryIds.has(s.id))
    .map((s) => String(s?.text || '').trim())
    .filter(Boolean);
  return normalizeStoryText(textParts.join('\n\n'));
}

function extractPageImageFileNames(parsedPage: any): string[] {
  const logoSet = new Set<string>(Array.isArray(parsedPage?.logoImageFileNames) ? parsedPage.logoImageFileNames : []);
  const pageImages: string[] = Array.isArray(parsedPage?.imageFileNames) ? parsedPage.imageFileNames : [];
  const storyImages: string[] = (Array.isArray(parsedPage?.stories) ? parsedPage.stories : [])
    .flatMap((s: any) => Array.isArray(s?.imageHints) ? s.imageHints : [])
    .filter(Boolean);

  const explicitEditorsImages: string[] = [];
  const remainingFramesImages: string[] = [];
  const allFrames: any[] = Array.isArray(parsedPage?.frames) ? parsedPage.frames : [];
  const editorsNorm = normLabel("EditorsImageFrame");
  for (const frame of allFrames) {
    const fn = normLabel(frame?.label) === editorsNorm
      ? explicitEditorsImages
      : remainingFramesImages;
    if (Array.isArray(frame?.imageHints)) {
      for (const hint of frame.imageHints) {
        if (hint && !fn.includes(String(hint))) fn.push(String(hint));
      }
    }
  }

  const ordered = Array.from(new Set([
    ...explicitEditorsImages,
    ...pageImages,
    ...storyImages,
  ])).filter((n) => !logoSet.has(n));
  return ordered;
}

function buildStoryLibraryItemsFromParsedIdml(
  parsed: Awaited<ReturnType<typeof parseIdml>>,
  fileName: string,
  imageUrls: Record<string, string>,
): StoryLibraryItem[] {
  const sortedPages = [...parsed.pages].sort(
    (a: any, b: any) => Number(a.pageNumber || 0) - Number(b.pageNumber || 0),
  );
  const articles = detectArticles(parsed.pages);

  const articleStartPagesCovered = new Set<number>(
    articles.map((a) => Number(a.startPage)).filter(Boolean),
  );

  const extraItems: StoryLibraryItem[] = [];

  const editorPage = sortedPages.find((p: any) => pageHasLabel(p, 'EditorsFrame'))
    || sortedPages.find((p: any) => Number(p.pageNumber) === 5);

  if (editorPage && !articleStartPagesCovered.has(Number(editorPage.pageNumber))) {
    const pageNo = Number(editorPage.pageNumber);
    const editorBody = extractPageText(editorPage, true);
    const editorImages = extractPageImageFileNames(editorPage);
    const imageUrl = editorImages.find((v) => imageUrls[v]) || '';
    if (editorBody.length >= 40) {
      extraItems.push({
        id: `idml-editorial-${pageNo}`,
        title: "Editor's Note",
        standfirst: deriveStandfirst(editorBody) || undefined,
        text: editorBody,
        imageUrl: imageUrl ? normalizeImageUrl(imageUrls[imageUrl]) : undefined,
        imageFileNames: editorImages,
        includedInPremiumReader: true,
        premiumReaderPriority: 85,
        premiumReaderContentType: 'editorial',
        premiumReaderPlacementPreference: 'auto',
        sourceRef: `${fileName}:pages-${pageNo}-${pageNo}`,
        source: {
          type: 'idml',
          fileName,
          path: `pages-${pageNo}-${pageNo}`,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  const adPages = sortedPages.filter((p: any) => detectAdPage(p));
  for (const adPage of adPages) {
    const pageNo = Number(adPage.pageNumber);
    if (pageNo <= 1) continue;
    if (editorPage && Number(editorPage.pageNumber) === pageNo) continue;
    const adImages = extractPageImageFileNames(adPage);
    const adLogos: string[] = Array.isArray((adPage as any).logoImageFileNames) ? (adPage as any).logoImageFileNames : [];
    const adPdfs = adImages.filter((value) => /\.pdf$/i.test(value));
    const imageFileName = adImages.find((v) => imageUrls[v]) || adLogos.find((v) => imageUrls[v]) || '';
    const pdfFileName = adPdfs.find((v) => imageUrls[v]) || '';
    const firstStoryText = extractPageText(adPage, true).trim();
    const adTitle = /^advert(isement)?$/i.test(firstStoryText) ? 'Advertisement' : firstStoryText.substring(0, 80) || 'Advertisement';
    const imageUrl = imageFileName ? normalizeImageUrl(imageUrls[imageFileName]) : '';
    const pdfUrl = pdfFileName ? normalizeImageUrl(imageUrls[pdfFileName]) : '';
    extraItems.push({
      id: `idml-full-page-ad-${pageNo}`,
      title: adTitle,
      standfirst: undefined,
      text: firstStoryText,
      imageUrl: imageUrl || undefined,
      pdfUrl: pdfUrl || undefined,
      imageFileNames: Array.from(new Set([...adImages, ...adLogos])),
      includedInPremiumReader: true,
      premiumReaderPriority: 60000 + pageNo,
      premiumReaderContentType: 'ad',
      premiumReaderPlacementPreference: 'auto',
      sourceRef: `${fileName}:pages-${pageNo}-${pageNo}`,
      source: {
        type: 'idml',
        fileName,
        path: `pages-${pageNo}-${pageNo}`,
      },
      createdAt: new Date().toISOString(),
    });
  }

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
    const isEditorial = /\b(editor('?s)? note|from the editor|editorial)\b/i.test(
      `${cleanTitle} ${cleanBody.slice(0, 240)}`.toLowerCase(),
    );
    const isProfileOrSpotlight = /\b(profile|spotlight|member spotlight)\b/i.test(
      `${cleanTitle} ${cleanBody.slice(0, 240)}`.toLowerCase(),
    );
    const minBodyLength = isEditorial || isProfileOrSpotlight ? 40 : 80;

    if (!cleanTitle) return null;
    if (cleanTitle === 'YorkshireBusinessWoman' && cleanBody.length < 40) return null;
    if (/^\d+$/.test(cleanTitle)) return null;
    if (/^\<\?ace/i.test(cleanTitle)) return null;
    if (cleanBody.length < minBodyLength) return null;

    return {
      id: `idml-${article.startPage}-${article.endPage}-${index + 1}`,
      title: cleanTitle,
      standfirst: deriveStandfirst(cleanBody) || undefined,
      text: cleanBody,
      imageUrl: imageUrl ? normalizeImageUrl(imageUrls[imageUrl]) : undefined,
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

  const articleItems = items.filter((item): item is StoryLibraryItem => item !== null);
  return [...extraItems, ...articleItems];
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
    const issueDoc = await adminDb.collection('magazine_issues').doc(issueId).get();
    const existing = issueDoc.exists ? issueDoc.data() : {};
    const mergedTitle = String(rest.title ?? existing?.title ?? '').trim();
    const mergedTag = String(rest.ghostSyncTag ?? existing?.ghostSyncTag ?? '').trim();
    const mergedReaderSlug = String(rest.readerEditionSlug ?? existing?.readerEditionSlug ?? '').trim();
    const currentSlug = String(rest.slug ?? existing?.slug ?? '').trim();
    const slug = currentSlug || deriveIssueSlug({
      id: issueId,
      title: mergedTitle,
      ghostSyncTag: mergedTag,
      readerEditionSlug: mergedReaderSlug,
    }).toLowerCase();

    const validated = safeParseMagazine(
      MagazineIssueSchema,
      {
        ...existing,
        ...rest,
        id: issueId,
        slug,
        title: mergedTitle,
      },
      `updateMagazineIssueAction issueId=${issueId}`,
    );
    if (!validated.ok) {
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }

    const { id: _idFromValidated, ...cleanValidated } = validated.value as any;
    await adminDb.collection('magazine_issues').doc(issueId).update({
      ...cleanValidated,
      slug,
      updatedAt: new Date().toISOString()
    });

    safeRevalidatePath('/admin/magazine');
    safeRevalidatePath('/magazine');
    safeRevalidatePath('/new-edition');
    return { success: true, slug };
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

    const validatedItems: StoryLibraryItem[] = [];
    for (let i = 0; i < (Array.isArray(storyLibrary) ? storyLibrary.length : 0); i += 1) {
      const raw = storyLibrary[i];
      const parsed = safeParseMagazine(
        StoryLibraryItemSchema,
        raw,
        `StoryLibraryItem[${i}] title="${String((raw as any)?.title || '').slice(0, 60)}"`,
      );
      if (!parsed.ok) {
        console.error('[saveMagazineStoryLibraryAction] validation failed:\n', parsed.error);
        return { success: false, error: parsed.error, validationIssues: parsed.issues };
      }
      validatedItems.push(parsed.value as unknown as StoryLibraryItem);
    }

    const resolvedItems = await persistStoryLibraryForIssue(issueId, validatedItems);

    // NOTE: Intentionally no safeRevalidatePath('/admin/magazine/builder/${issueId}') here.
    // The builder page client already updates issue.storyLibrary state optimistically after
    // saveMagazineStoryLibraryAction resolves, and has its own page-level state for pages.
    // Triggering a Next.js revalidate here races with the next getMagazinePagesAction() read
    // and causes "deleted pages come back after 2 seconds" — the RSC payload re-serves stale
    // cached pages, and the client's "0 pages → auto-create structural spreads" useEffect
    // kicks in and regenerates cover/contents/back-cover against the admin's explicit delete.
    try { safeRevalidatePath('/admin/magazine'); } catch { /* noop */ }
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

    safeRevalidatePath('/admin/magazine');
    safeRevalidatePath('/new-edition');
    safeRevalidatePath('/magazine');
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

    safeRevalidatePath('/new-edition');
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
    const slug = deriveIssueSlug({
      id: 'new',
      title: String(rest.title || '').trim(),
      ghostSyncTag: String(rest.ghostSyncTag || '').trim(),
      readerEditionSlug: String(rest.readerEditionSlug || '').trim(),
      slug: String(rest.slug || '').trim(),
    }).toLowerCase();

    const payload = {
      ...rest,
      slug,
      title: String(rest.title || '').trim(),
    };
    const validated = safeParseMagazine(MagazineIssueSchema, payload, 'createMagazineIssueAction');
    if (!validated.ok) {
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }

    const { id: _vId, ...cleanCreate } = validated.value as any;
    const docRef = await adminDb.collection('magazine_issues').add({
      ...cleanCreate,
      slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    safeRevalidatePath('/admin/magazine');
    safeRevalidatePath('/magazine');
    safeRevalidatePath('/new-edition');
    return { success: true, id: docRef.id, slug };
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
    safeRevalidatePath('/admin/magazine');
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

    const raw: any = { docId: pageId, id: data?.id ?? 0, type: data?.type ?? 'feature-full', ...data, updatedAt: new Date().toISOString() };
    if (raw.content && typeof raw.content === 'object') {
      raw.content = normalizeMagazinePageContent(raw.content);
    }
    const validated = safeParseMagazine(MagazinePageSchema, raw, `MagazinePage pageId=${pageId} (updateMagazinePageAction)`);
    if (!validated.ok) {
      console.error('[updateMagazinePageAction] validation failed:\n', validated.error);
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }
    const payload: any = { ...validated.value };
    delete payload.docId;
    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).set(payload, { merge: true });
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

    const now = new Date().toISOString();
    const raw: any = {
      docId: `new-${Math.random().toString(36).slice(2, 10)}`,
      id: data?.id ?? 0,
      type: data?.type ?? 'feature-full',
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    if (raw.content && typeof raw.content === 'object') {
      raw.content = normalizeMagazinePageContent(raw.content);
    }
    const validated = safeParseMagazine(MagazinePageSchema, raw, 'MagazinePage (addMagazinePageAction)');
    if (!validated.ok) {
      console.error('[addMagazinePageAction] validation failed:\n', validated.error);
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }
    const payload: any = { ...validated.value };
    delete payload.docId;
    const docRef = await adminDb.collection('magazine_issues').doc(issueId).collection('pages').add(payload);
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
    // NOTE: Intentionally no safeRevalidatePath() on page-level changes.
    // Deletion-triggered revalidation was the #1 cause of "I deleted all
    // pages but 3 reappear after a couple seconds": Next.js served a stale
    // cached fullPageRSC payload of the builder page, and the useEffect on
    // tab-switch saw 0 pages and triggered auto-sync to regenerate them.
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

export async function importIdmlFromStoragePathForPublishAction(storagePath: string, fileName?: string) {
  try {
    await checkAdmin();
    if (!adminStorage) throw new Error('Firebase Admin Storage not configured');

    const { buffer, objectPath } = await downloadIdmlBufferFromStoragePath(storagePath);
    const resolvedFileName =
      String(fileName || '').trim() ||
      objectPath.split('/').pop()?.trim() ||
      'imported.idml';

    const data = await processIdmlBuffer(buffer, resolvedFileName);
    return { success: true, data };
  } catch (error: any) {
    console.error('Error importing IDML from storage path (publish route):', error);
    return { success: false, error: error.message || 'Failed to import IDML file from storage path' };
  }
}

export async function importIdmlFromUrlAction(fileUrl: string, fileName: string) {
  try {
    await checkAdmin();

    let buffer: Buffer;

    // If the URL is a Firebase Storage URL, bypass public fetch entirely and
    // download via the Admin SDK (service-account credentials). This avoids
    // the 400/403 we get from plain uncredentialed fetch against Firebase
    // Storage REST API when security rules require request.auth != null.
    const firebaseInfo = isFirebaseStorageUrl(fileUrl);
    if (firebaseInfo?.bucket && firebaseInfo?.objectPath) {
      if (!adminStorage) throw new Error('Firebase Admin Storage not configured');
      const gs = firebaseInfo.bucket && firebaseInfo.objectPath
        ? `gs://${firebaseInfo.bucket}/${firebaseInfo.objectPath}`
        : '';
      const downloaded = await downloadIdmlBufferFromStoragePath(gs);
      buffer = downloaded.buffer;
    } else {
      // Non-Firebase URL (e.g. Issuu PDF, external CDN): regular uncredentialed fetch still works.
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

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

  const designmapDocName = typeof (parsed as any).documentName === 'string'
    ? String((parsed as any).documentName).trim()
    : '';

  const imageUrls = await uploadParsedIdmlImages(parsed, fileName);

  const rawMappedPages = mapIdmlToReaderPages(parsed.pages);

  const resolve = (name: string): string =>
    normalizeImageUrl(name && imageUrls[name] ? imageUrls[name] : name);
  let pages: Array<ReaderPage & { content: Record<string, unknown> }> = rawMappedPages.map((page) => ({
    ...(page as ReaderPage),
    content: {
      ...(page.content as Record<string, unknown>),
      imageUrl: resolve(String(page.content.imageUrl || '')),
      imageUrls: (Array.isArray(page.content.imageUrls) ? page.content.imageUrls : []).map(resolve),
      backgroundImage: resolve(String(page.content.backgroundImage || '')),
      logoImage: resolve(String(page.content.logoImage || '')),
      logoImages: (Array.isArray(page.content.logoImages) ? page.content.logoImages : []).map(resolve),
      partnerLogo: resolve(String(page.content.partnerLogo || page.content.logoImage || '')),
      image: resolve(String(page.content.image || '')),
      featureImage: resolve(String(page.content.featureImage || '')),
      heroImage: resolve(String(page.content.heroImage || '')),
      mainImage: resolve(String(page.content.mainImage || '')),
      coverImage: resolve(String(page.content.coverImage || '')),
      images: (Array.isArray(page.content.images) ? page.content.images : []).map(resolve),
      gallery: (Array.isArray(page.content.gallery) ? page.content.gallery : []).map(resolve),
      additionalImages: (Array.isArray(page.content.additionalImages) ? page.content.additionalImages : []).map(resolve),
      pdfUrl: page.content.pdfUrl
        ? normalizeImageUrl(imageUrls[String(page.content.pdfUrl)] || String(page.content.pdfUrl)) || undefined
        : undefined,
    } as Record<string, unknown>,
  })) as Array<ReaderPage & { content: Record<string, unknown> }>;

  for (let i = 0; i < pages.length; i += 1) {
    const validated = safeParseMagazine<ReaderPage>(
      ReaderPageSchema,
      pages[i],
      `IDML mapped page[${i}] id="${String(pages[i].id || '')}"`,
    );
    if (!validated.ok) {
      throw new Error(validated.error);
    }
    pages[i] = validated.value;
  }

  const metadata = buildEditionMetadata(pages, fileName);

  const warnings: Array<{ code: string; level: 'warn' | 'info'; title: string; detail: string; fix?: string }> = [];
  const parsedStories = (parsed.pages || []).reduce<number>(
    (acc, p: any) => acc + Number(Array.isArray(p.stories) ? p.stories.length : 0),
    0,
  );
  const emptyStories = (parsed.pages || []).reduce<number>((acc, p: any) => {
    if (!Array.isArray(p.stories)) return acc;
    return acc + p.stories.filter((s: any) => {
      const t = typeof s?.text === 'string' ? s.text : '';
      return t.trim().length === 0;
    }).length;
  }, 0);
  const nonEmptyRatio = parsedStories === 0 ? 0 : 1 - emptyStories / parsedStories;
  if (nonEmptyRatio < 0.7) {
    warnings.push({
      code: 'idml.low-story-density',
      level: 'warn',
      title: `${Math.round(nonEmptyRatio * 100)}% of story frames are empty`,
      detail: `Found ${emptyStories} empty / ${parsedStories} total story frames. This usually means the IDML was exported from a multi-page spread InDesign file with unused frame placeholders. Reader pages may have short or blank content.`,
      fix: 'In InDesign, delete empty text frames before re-exporting, or export in 1-page-per-spread mode.',
    });
  }
  const totalFeatureLike = pages.filter((p: any) => {
    const t = String(p?.template || '').toLowerCase();
    return t.startsWith('feature') || t === 'column' || t === 'lifestyle' || t === 'spotlight' || t === 'partner';
  }).length;
  const withExplicitTitles = pages.filter((p: any) => {
    const t = String(p?.content?.title || '').trim();
    return t.length >= 3;
  }).length;
  const titleCoverage = totalFeatureLike === 0 ? 0 : withExplicitTitles / totalFeatureLike;
  if (totalFeatureLike > 4 && titleCoverage < 0.25) {
    warnings.push({
      code: 'idml.low-title-coverage',
      level: 'warn',
      title: `Only ${Math.round(titleCoverage * 100)}% of feature pages have real titles`,
      detail: `${withExplicitTitles} / ${totalFeatureLike} article pages have titles 3+ chars long. Right now most pages will show generic "Page N" headings.`,
      fix: 'In InDesign, select each article headline frame → Object → Labels → set Label to "TitleFrame". Then re-export IDML.',
    });
  }
  if (/\bUntitled\b/i.test(designmapDocName) || /^Untitled-\d+$/i.test(designmapDocName)) {
    warnings.push({
      code: 'idml.untitled-document',
      level: 'warn',
      title: 'InDesign document is still named "Untitled"',
      detail: `designmap.xml Name="${designmapDocName || 'Untitled'}". Issue URLs / slugs are derived from the document name when issue metadata is empty.`,
      fix: 'File → Save As → name the file exactly "ybw_{Month}_{Year}_DIGITAL.indd" then re-export IDML.',
    });
  }
  if (parsed.pageCount !== pages.length) {
    warnings.push({
      code: 'idml.page-count-mismatch',
      level: 'info',
      title: `IDML reports ${parsed.pageCount} physical pages but mapper produced ${pages.length} reader pages`,
      detail: 'This is normally fine (e.g. blank spread end pages get collapsed or grouped with adjacent content).',
      fix: 'If you expected exactly as many reader pages as physical IDML pages, re-check InDesign for empty/blank frames on the dropped pages.',
    });
  }

  return {
    pages,
    metadata,
    pageCount: parsed.pageCount,
    storyCount: parsedStories,
    imageCount: parsed.images.length,
    imageUrls,
    warnings,
    preflight: {
      documentName: designmapDocName || fileName,
      nonEmptyStoryRatio: Number(nonEmptyRatio.toFixed(2)),
      titleCoverageRatio: Number(titleCoverage.toFixed(2)),
      physicalPageCount: parsed.pageCount,
      readerPageCount: pages.length,
    },
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

async function importIdmlBufferToStoryLibrary(
  issueId: string,
  buffer: Buffer,
  fileName: string,
  location: string,
) {
  if (!adminDb) throw new Error('Database not initialized');

  const parsed = await parseIdml(buffer);

  if (parsed.pages.length === 0) {
    throw new Error('No readable content found in the IDML file');
  }

  // Keep Story Library ingestion fast and reliable by not blocking on
  // the full extracted-image upload pass. Upload only a single best-fit
  // image per story so imports stay lightweight while still populating
  // Story Library hero art.
  const previewItems = buildStoryLibraryItemsFromParsedIdml(parsed, fileName, {});
  const imageUrls = await uploadStoryLibraryArticleImages(parsed, fileName, previewItems);
  const importedItems = buildStoryLibraryItemsFromParsedIdml(parsed, fileName, imageUrls);

  const [issueDoc, collectionItems] = await Promise.all([
    adminDb.collection('magazine_issues').doc(issueId).get(),
    getIssueStoryLibraryCollectionItems(issueId),
  ]);

  const issueData = (issueDoc.data() || {}) as { storyLibrary?: StoryLibraryItem[] };
  const issueItems = Array.isArray(issueData.storyLibrary) ? issueData.storyLibrary : [];
  const existingItems = mergeStoryLibraryItems(collectionItems, issueItems);
  const nextLibrary = mergeStoryLibraryItems(importedItems, existingItems);
  const savedItems = await persistStoryLibraryForIssue(issueId, nextLibrary);

  // NOTE: Intentionally no safeRevalidatePath('/admin/magazine/builder/${issueId}') here.
  // The caller (builder page) already: (1) updates issue.storyLibrary state with the saved
  // library, (2) runs runSingleFlightSync on the just-persisted savedLibrary, (3) switches
  // to builder tab and updates pages state in-place. Triggering a Next.js revalidate here
  // forces a stale cached RSC reload that races with explicit deletes the admin may have
  // just performed, producing the "deleted 3 pages bounce back after 2s" symptom.
  safeRevalidatePath('/admin/magazine');

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
}

export async function importIdmlToStoryLibraryAction(issueId: string, idmlBase64: string, fileName: string) {
  try {
    await checkAdmin();
    const buffer = Buffer.from(idmlBase64, 'base64');
    return await importIdmlBufferToStoryLibrary(
      issueId,
      buffer,
      fileName,
      'magazineActions.ts:importIdmlToStoryLibraryAction',
    );
  } catch (error: any) {
    console.error('Error importing IDML into Story Library:', error);
    return { success: false, error: error.message || 'Failed to import IDML stories into Story Library' };
  }
}

export async function importIdmlToStoryLibraryFromUrlAction(issueId: string, fileUrl: string, fileName: string) {
  try {
    await checkAdmin();

    let buffer: Buffer;

    const firebaseInfo = isFirebaseStorageUrl(fileUrl);
    if (firebaseInfo?.bucket && firebaseInfo?.objectPath) {
      if (!adminStorage) throw new Error('Firebase Admin Storage not configured');
      const gs = `gs://${firebaseInfo.bucket}/${firebaseInfo.objectPath}`;
      const downloaded = await downloadIdmlBufferFromStoragePath(gs);
      buffer = downloaded.buffer;
      const resolvedFromObject = String(fileName || '').trim() || downloaded.objectPath.split('/').pop() || 'imported.idml';
      return await importIdmlBufferToStoryLibrary(
        issueId,
        buffer,
        resolvedFromObject,
        'magazineActions.ts:importIdmlToStoryLibraryFromUrlAction[firebase-url]',
      );
    }

    // Non-Firebase URL (external CDN, Issuu etc.) — plain fetch is fine.
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await importIdmlBufferToStoryLibrary(
      issueId,
      Buffer.from(arrayBuffer),
      fileName,
      'magazineActions.ts:importIdmlToStoryLibraryFromUrlAction',
    );
  } catch (error: any) {
    console.error('Error importing IDML URL into Story Library:', error);
    return { success: false, error: error.message || 'Failed to import IDML URL into Story Library' };
  }
}

export async function importIdmlToStoryLibraryFromStoragePathAction(
  issueId: string,
  storagePath: string,
  fileName?: string,
) {
  try {
    await checkAdmin();
    if (!adminStorage) {
      throw new Error('Storage not initialized');
    }

    const { buffer, objectPath } = await downloadIdmlBufferFromStoragePath(storagePath);
    const resolvedFileName =
      String(fileName || '').trim() ||
      objectPath.split('/').pop()?.trim() ||
      'imported.idml';

    return await importIdmlBufferToStoryLibrary(
      issueId,
      buffer,
      resolvedFileName,
      'magazineActions.ts:importIdmlToStoryLibraryFromStoragePathAction',
    );
  } catch (error: any) {
    console.error('Error importing IDML storage path into Story Library:', error);
    return {
      success: false,
      error: error.message || 'Failed to import IDML storage path into Story Library',
    };
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
  issueId?: string;
}) {
  try {
    await checkAdmin();
    const now = new Date().toISOString();

    // Prefer the MagazineIssue metadata (title/slug/readerEditionSlug/ghostSyncTag)
    // over the IDML-derived "title" (which can be a per-article headline pulled
    // from the cover page's title frame). Poisoning the ReaderEdition.slug +
    // issue.slug fields with article titles produced garbage public URLs like
    // /magazine/read/west-yorkshire-law-firm-achieves-...
    let issueMeta: Partial<{ title: string; slug: string; readerEditionSlug: string; ghostSyncTag: string; id: string }> | null = null;
    if (params.issueId && adminDb) {
      try {
        const d = await adminDb.collection('magazine_issues').doc(params.issueId).get();
        if (d.exists) {
          const raw = d.data() as Record<string, unknown> | undefined;
          if (raw) {
            issueMeta = {
              id: d.id,
              title: String(raw.title || ''),
              slug: String(raw.slug || ''),
              readerEditionSlug: String(raw.readerEditionSlug || ''),
              ghostSyncTag: String(raw.ghostSyncTag || ''),
            };
          }
        }
      } catch (issueLoadErr) {
        console.warn('[publishIdmlEditionAction] failed to load magazine issue metadata:', issueLoadErr);
      }
    }
    const finalTitle = String(
      issueMeta?.title || params.title || now,
    ).trim();
    const slug = deriveIssueSlug({
      id: issueMeta?.id || params.issueId,
      title: finalTitle,
      ghostSyncTag: issueMeta?.ghostSyncTag,
      readerEditionSlug: issueMeta?.readerEditionSlug,
      slug: issueMeta?.slug,
    }).toLowerCase() || slugify(finalTitle) || `edition-${Date.now()}`;

    const existingId = await getReaderEditionIdBySlug(slug);

    const rawEdition: ReaderEdition & { schemaVersion?: number } = {
      id: existingId ?? `idml-${slug}-${Date.now().toString(36)}`,
      slug,
      title: finalTitle,
      description: params.description,
      coverImage: params.coverImage,
      publishDate: params.publishDate || now,
      pageCount: params.pages.length,
      pages: params.pages,
      createdAt: now,
      issueId: params.issueId || undefined,
    };

    const validated = safeParseMagazine(ReaderEditionSchema, rawEdition, 'ReaderEdition (publishIdmlEditionAction)');
    if (!validated.ok) {
      console.error('[publishIdmlEditionAction] Zod validation failed:\n', validated.error);
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }

    const edition: ReaderEdition = hydrateReaderEditionContents(validated.value) ?? validated.value;
    await upsertReaderEdition(edition);

    if (params.issueId) {
      try {
        await syncReaderEditionsForIssue(params.issueId);
        if (adminDb) {
          const issueRef = adminDb.collection('magazine_issues').doc(params.issueId);
          await issueRef.set({
            readerEditionId: edition.id,
            readerEditionSlug: edition.slug,
            slug: edition.slug,
            readerEditionPublished: true,
            readerEditionTitle: edition.title,
            readerEditionPublishDate: edition.publishDate || now,
            readerEditionPageCount: edition.pageCount,
            schemaVersion: CURRENT_READER_SCHEMA_VERSION,
          }, { merge: true }).catch((err) => console.warn('Failed to link reader edition to magazine_issue:', err));
        }
      } catch (syncError: any) {
        console.warn('syncReaderEditionsForIssue failed after publish, edition still saved:', syncError?.message || syncError);
      }
    }

    await syncReaderEditionCoverFromIssue(edition.id).catch((error) => {
      console.error('Failed to sync edition cover with matched issue:', error);
    });

    if (params.issueId) {
      try {
        const syncStats = await syncReaderEditionToLegacyIssue(edition.id, params.issueId);
        console.info(
          `[publishIdmlEditionAction] Synced ReaderEdition → legacy: ${syncStats.storyLibraryCount} StoryLibrary items, ${syncStats.legacyPageCount} spread pages`,
        );
      } catch (legacySyncError: any) {
        console.warn(
          '[publishIdmlEditionAction] publish OK but legacy sync failed (issue,readerEdition,err):',
          params.issueId, edition.id, legacySyncError?.message || legacySyncError,
        );
      }
    }

    safeRevalidatePath('/magazine');
    safeRevalidatePath('/new-edition');
    if (params.issueId) {
      safeRevalidatePath(`/admin/magazine/builder/${params.issueId}`);
    }

    return { success: true, data: { id: edition.id, slug: edition.slug, issueId: params.issueId } };
  } catch (error: any) {
    console.error('Error publishing IDML edition:', error);
    return { success: false, error: error.message || 'Failed to publish edition' };
  }
}

export async function deleteReaderEditionAction(editionId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Firebase Admin not configured');
    if (!editionId) throw new Error('Edition ID is required');

    await deleteReaderEdition(editionId);

    if (adminDb) {
      const snapshot = await adminDb.collection('magazine_issues')
        .where('readerEditionId', '==', editionId)
        .select()
        .limit(20)
        .get();
      const unlinkPromises = snapshot.docs.map(async (doc) => {
        try {
          await adminDb!.collection('magazine_issues').doc(doc.id).update({
            readerEditionId: null,
            readerEditionSlug: null,
            readerEditionPublished: false,
            readerEditionTitle: null,
            readerEditionPublishDate: null,
            readerEditionPageCount: null,
          });
        } catch (unlinkErr) {
          console.warn(`Failed to unlink edition from issue ${doc.id}:`, unlinkErr);
        }
      });
      await Promise.all(unlinkPromises);
    }

    safeRevalidatePath('/magazine');
    safeRevalidatePath('/new-edition');
    safeRevalidatePath('/admin/magazine');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting reader edition:', error);
    return { success: false, error: error.message || 'Failed to delete edition' };
  }
}

export async function getReaderEditionByIssueIdAction(issueId: string): Promise<{ success: boolean; data?: ReaderEdition | null; error?: string }> {
  try {
    await checkAdmin();
    if (!issueId) return { success: true, data: null };
    const edition = await getReaderEditionByIssueId(issueId);
    if (!edition) return { success: true, data: null };
    const hydrated = await hydrateEditionWithLegacyPages(edition);
    return { success: true, data: hydrated };
  } catch (error: any) {
    console.error('getReaderEditionByIssueIdAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch reader edition' };
  }
}

function pickImageFromReaderPageContent(content: any): string {
  if (!content || typeof content !== 'object') return '';
  const candidates = [
    content.imageUrl,
    content.coverImage,
    content.heroImage,
    content.featureImage,
    content.mainImage,
    content.backgroundImage,
    content.image,
    Array.isArray(content.imageUrls) ? content.imageUrls[0] : undefined,
    Array.isArray(content.images) ? content.images[0] : undefined,
    Array.isArray(content.gallery) ? content.gallery[0] : undefined,
  ];
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
  }
  return '';
}

function slugifyStoryId(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `story-${Math.random().toString(36).slice(2, 8)}`;
}

function buildStoryLibraryItemsFromReaderPages(
  issueId: string,
  editionId: string,
  readerPages: any[],
): StoryLibraryItem[] {
  const now = new Date().toISOString();
  const arr = Array.isArray(readerPages) ? readerPages : [];
  const out: StoryLibraryItem[] = [];
  const usedSlugs = new Set<string>();

  for (let i = 0; i < arr.length; i++) {
    const rp = arr[i];
    const template = String(rp.template || '').toLowerCase();
    const content = rp.content || {};

    // Ads + chrome pages (cover, contents, back cover) don't get a Story Library
    // entry. The builder handles those as reserved layouts, and the auto-Contents
    // generator filters them out anyway via buildContentsItemsFromPages.
    const skipTemplates = new Set(['ad', 'full-page-ad', 'cover', 'contents', 'back-cover']);
    if (skipTemplates.has(template)) continue;

    const title = String(
      content.title || content.headline || content.name || content.brand || rp.title || '',
    ).trim();
    if (!title) continue;

    const standfirst = String(
      content.standfirst || content.subtitle || content.intro || content.description || content.kicker || '',
    ).trim() || undefined;
    const author = String(content.author || content.byline || '').trim() || undefined;
    const text = String(
      content.body || content.text || content.article || content.storyText || '',
    ).trim();
    const imageUrl = pickImageFromReaderPageContent(content) || undefined;
    const position = typeof rp.position === 'number' ? rp.position : i + 1;

    let slug = slugifyStoryId(title);
    let n = 2;
    while (usedSlugs.has(slug)) { slug = `${slugifyStoryId(title)}-${n}`; n += 1; }
    usedSlugs.add(slug);

    // premiumReaderPriority controls the ordering BOTH in Story Library dropdown
    // AND in the auto-Contents generator (sort by priority then title), so the
    // print ordinal position drives the canonical order.
    const premiumReaderPriority = position;

    const id = `${issueId}-library-reader-edition-${editionId}-${String(position).padStart(4, '0')}-${slug}`;
    out.push({
      id,
      title,
      author,
      standfirst,
      text,
      imageUrl,
      includedInPremiumReader: true,
      premiumReaderPriority,
      premiumReaderContentType:
        template === 'editor-note' ? 'editorial' :
        template === 'feature-full' || template === 'feature-left' || template === 'feature-right' ? 'feature' :
        template === 'spotlight' ? 'spotlight' :
        template === 'column' ? 'column' :
        template === 'lifestyle' ? 'lifestyle' :
        template === 'partner' ? 'partner' : 'feature',
      premiumReaderPlacementPreference: template,
      imageFileNames: Array.isArray(content.imageFileNames) ? content.imageFileNames : undefined,
      sourceRef: `reader-edition:${editionId}:page:${position}`,
      source: {
        type: 'reader-edition',
        fileName: String(rp.content?.source?.fileName || ''),
        path: `readerPages[${i}]@${editionId}`,
      },
      createdAt: rp.createdAt || rp.updatedAt || now,
    } satisfies StoryLibraryItem);
  }
  return out;
}

async function syncReaderEditionToLegacyIssue(
  editionId: string,
  issueId: string,
): Promise<{
  storyLibraryCount: number;
  legacyPageCount: number;
  removedLegacyIds: string[];
}> {
  if (!adminDb) throw new Error('Database not initialized');
  if (!editionId) throw new Error('ReaderEdition id is required');
  if (!issueId) throw new Error('Issue id is required');

  // 1. Fetch the COLLAPSED ReaderEdition (hydrateEditionWithLegacyPages
  // merges legacy overrides and runs collapseSplitStoryPages, then
  // hydrateReaderEditionContents re-applies print page numbers via id
  // regex after the collapse). The output matches exactly what the public
  // reader renders as "digital magazine pages" — so each legacy page we
  // write here corresponds 1:1 to a rendered magazine page (spread rows
  // in the Issue Builder match the rows the reader actually shows).
  const rawEdition = await getReaderEditionById(editionId);
  if (!rawEdition) throw new Error(`ReaderEdition not found: ${editionId}`);
  const edition = (await hydrateEditionWithLegacyPages(rawEdition)) || rawEdition;
  const flatPages = Array.isArray(edition.pages) ? edition.pages : [];
  if (flatPages.length === 0) throw new Error(`ReaderEdition ${editionId} has an empty pages array`);

  // 2. Build StoryLibrary items from the flat ReaderPages.
  const nextStoryLibrary = buildStoryLibraryItemsFromReaderPages(issueId, editionId, flatPages);
  await persistStoryLibraryForIssue(issueId, nextStoryLibrary);

  // 3. Build legacy MagazinePage[] docs — one per flat ReaderPage — with
  //    explicit id = ReaderPage.position (1..N, print ordinal) so the
  //    auto-Contents builder (buildContentsItemsFromPages) and builder spread
  //    list both sort into the correct print order.
  const pagesRef = adminDb.collection('magazine_issues').doc(issueId).collection('pages');
  const existingSnap = await pagesRef.orderBy('id', 'asc').get();
  const existingById = new Map<number, { docId: string; data: MagazinePage }>();
  const existingGeneratedFromReader = new Set<string>();
  for (const doc of existingSnap.docs) {
    const d = doc.data() as MagazinePage;
    const num = typeof d.id === 'number' ? d.id : Number(d.id || 0);
    existingById.set(num, { docId: doc.id, data: d });
    if (d.sourceReaderEditionId === editionId) {
      existingGeneratedFromReader.add(doc.id);
    }
  }

  const now = new Date().toISOString();
  const batch = adminDb.batch();
  const removedLegacyIds: string[] = [];

  // 3a. DELETE existing legacy pages whose numeric id falls inside 1..max(ReaderPage.position).
  //     These positions are owned by the IDML flat order now. Pages with ids outside this range
  //     (e.g. user-added spreads at id=100+) are preserved and appended in the builder merge.
  const maxPrintId = Math.max(...flatPages.map((rp: any) => typeof rp.position === 'number' ? rp.position : 0));
  for (const [idNum, info] of existingById) {
    if (idNum > 0 && idNum <= maxPrintId) {
      batch.delete(pagesRef.doc(info.docId));
      removedLegacyIds.push(info.docId);
    }
  }

  // 3b. CREATE fresh legacy page doc for each flat ReaderPage with id = position.
  // Source-template → page.type mapping (PAGE_TYPES.id values that PageEditor
  // switch() actually renders; anything not in this map falls through to the
  // "coming soon" default case so it is critical we only emit PAGE_TYPE ids).
  const SOURCE_TEMPLATE_TO_PAGE_TYPE: Record<string, string> = {
    'cover': 'cover',
    'contents': 'contents',
    'editor-note': 'editorial',
    'letter-from-editor': 'editorial',
    'masthead': 'editorial',
    'news-in-brief': 'column',
    'news-in-brief-page': 'column',
    'news-brief': 'column',
    'feature-full': 'feature-full',
    'feature-left': 'feature-left',
    'feature-right': 'feature-right',
    'two-column': 'column',
    'three-column': 'column',
    'listing-directory': 'partner',
    'directory-page': 'partner',
    'member-profile': 'spotlight',
    'gallery': 'lifestyle',
    'gallery-grid': 'lifestyle',
    'photo-essay': 'lifestyle',
    'advertisement': 'full-page-ad',
    'full-page-ad': 'full-page-ad',
    'ad': 'full-page-ad',
    'sponsor-spotlight': 'partner',
    'back-cover': 'back-cover',
  };
  const legacyPageCount = flatPages.length;
  for (let i = 0; i < flatPages.length; i++) {
    const rp: any = flatPages[i];
    const pos = typeof rp.position === 'number' ? rp.position : i + 1;
    const sourceTemplate = String(rp.template || '').toLowerCase();
    const type = SOURCE_TEMPLATE_TO_PAGE_TYPE[sourceTemplate] || 'feature-full';
    let content = rp.content && typeof rp.content === 'object' ? { ...rp.content } : {};
    const title = String(content.title || rp.title || '').trim();
    const body = String(content.body || content.text || '').trim();
    if (title) content.title = title;
    if (body) { content.body = body; content.text = body; }
    content.position = pos;
    content.template = rp.template;
    content = normalizeMagazinePageContent(content);
    const storyLibraryForPosition = nextStoryLibrary.find((s) => s.sourceRef === `reader-edition:${editionId}:page:${pos}`);
    const storyId = storyLibraryForPosition?.id || String(rp.storyId || content.storyId || '').trim() || undefined;

    const legacyDoc: any = {
      id: pos,
      type,
      pageNumber: pos,
      position: pos,
      readOnly: false,
      storyId,
      sourceReaderEditionId: editionId,
      sourceTemplate: rp.template || '',
      generatedFromStoryLibrary: true,
      sourceRef: `reader-edition:${editionId}:page:${pos}`,
      content,
      createdAt: rp.createdAt || now,
      updatedAt: now,
      name: title || `${String(rp.template || 'Page')} ${pos}`,
    };
    const docRef = pagesRef.doc();
    batch.set(docRef, legacyDoc);
  }

  await batch.commit();

  return { storyLibraryCount: nextStoryLibrary.length, legacyPageCount, removedLegacyIds };
}

export async function runSyncLegacyFromReaderEditionAction(
  issueId: string,
): Promise<{ success: boolean; data?: { storyLibraryCount: number; legacyPageCount: number; editionId: string | null } | null; error?: string }> {
  try {
    await checkAdmin();
    if (!issueId) return { success: true, data: null };
    const edition = await getReaderEditionByIssueId(issueId);
    if (!edition) return { success: false, error: 'No ReaderEdition linked to this issue. Publish via Auto-Import IDML first.' };
    const stats = await syncReaderEditionToLegacyIssue(edition.id, issueId);
    safeRevalidatePath(`/admin/magazine/builder/${issueId}`);
    safeRevalidatePath('/magazine');
    return { success: true, data: { ...stats, editionId: edition.id } };
  } catch (error: any) {
    console.error('runSyncLegacyFromReaderEditionAction error:', error);
    return { success: false, error: error.message || 'Failed to sync ReaderEdition into legacy builder systems' };
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

export async function uploadIdmlFileToStorageAction(idmlBase64: string, fileName: string) {
  try {
    await checkAdmin();

    if (!adminStorage) {
      throw new Error('Firebase Admin Storage not configured');
    }

    if (!idmlBase64 || typeof idmlBase64 !== 'string') {
      throw new Error('Invalid IDML base64 payload');
    }

    const buffer = Buffer.from(idmlBase64, 'base64');
    if (buffer.length === 0) {
      throw new Error('Empty IDML file');
    }

    const sanitizedName = String(fileName || 'import.idml')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const timestamp = Date.now().toString();
    const objectName = `magazine-import/${timestamp}-${sanitizedName}`;

    const bucket = adminStorage.bucket();
    const bucketName = bucket.name;
    const storageFile = bucket.file(objectName);

    await storageFile.save(buffer, {
      contentType: 'application/octet-stream',
      metadata: {
        contentType: 'application/octet-stream',
        metadata: {
          fileName: sanitizedName,
          uploadedAt: new Date().toISOString(),
          fileSizeBytes: String(buffer.length),
        },
      },
    });

    const gsUrl = `gs://${bucketName}/${objectName}`;
    const encodedPath = encodeURIComponent(objectName);
    const httpsUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;

    return {
      success: true,
      data: {
        gsUrl,
        httpsUrl,
        path: objectName,
        bucket: bucketName,
        sizeBytes: buffer.length,
        fileName: sanitizedName,
      },
    };
  } catch (error: any) {
    console.error('Error uploading IDML file to Storage:', error);
    return { success: false, error: error.message || 'Failed to upload IDML file' };
  }
}

export interface UnifiedEditionRow {
  key: string;
  source: 'magazine_issue' | 'reader_edition';
  id: string;
  slug?: string;
  title: string;
  description?: string;
  coverImage: string;
  publishDate: string;
  pageCount?: number;
  spreadCount?: number;
  isLatest?: boolean;
  isFeaturedFlipbook?: boolean;
  linkedIssueId?: string;
  linkedReaderEditionId?: string;
  readerEditionSlug?: string;
  readerEditionTitle?: string;
  builderPath?: string;
  viewerPath?: string;
}

export async function getEditionsListingAction(): Promise<{ success: boolean; data?: UnifiedEditionRow[]; error?: string }> {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Database not initialized');

    const [issuesSnapshot, readerEditions] = await Promise.all([
      adminDb.collection('magazine_issues').orderBy('publishDate', 'desc').limit(100).get(),
      listReaderEditions(100).catch(() => []),
    ]);

    const readerByIssueId = new Map<string, ReaderEdition>();
    for (const re of readerEditions) {
      if (re.issueId) readerByIssueId.set(re.issueId, re);
    }
    const readerByLinkedId = new Map<string, UnifiedEditionRow>();
    const seenReaderIds = new Set<string>();

    const rows: UnifiedEditionRow[] = [];

    for (const doc of issuesSnapshot.docs) {
      const raw: any = doc.data() ?? {};
      const issueId = doc.id;
      const normalizeTs = (v: any): string => {
        if (!v) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object' && 'seconds' in v) {
          return new Date(v.seconds * 1000).toISOString();
        }
        if (v instanceof Date) return v.toISOString();
        return String(v);
      };
      const tags = Array.isArray(raw.tags) ? raw.tags : [];
      const spreadCount = tags.length;
      const linkedRE = readerByIssueId.get(issueId);
      const coverImageSrc = raw.coverImage || linkedRE?.coverImage || '';

      rows.push({
        key: `issue:${issueId}`,
        source: 'magazine_issue',
        id: issueId,
        slug: raw.slug,
        title: raw.title || 'Untitled issue',
        description: raw.description || '',
        coverImage: fixMagazineImageUrl(coverImageSrc),
        publishDate: normalizeTs(raw.publishDate) || normalizeTs(raw.createdAt) || new Date().toISOString(),
        pageCount: linkedRE?.pageCount,
        spreadCount,
        isLatest: !!raw.isLatest,
        isFeaturedFlipbook: !!raw.isFeaturedFlipbook,
        linkedReaderEditionId: linkedRE?.id || raw.readerEditionId || undefined,
        readerEditionSlug: raw.readerEditionSlug || linkedRE?.slug,
        readerEditionTitle: raw.readerEditionTitle || linkedRE?.title,
        builderPath: `/admin/magazine/builder/${issueId}`,
        viewerPath: raw.readerEditionId || linkedRE
          ? `/magazine`
          : undefined,
      });
      if (linkedRE) seenReaderIds.add(linkedRE.id);
    }

    for (const re of readerEditions) {
      if (seenReaderIds.has(re.id)) continue;
      rows.push({
        key: `reader:${re.id}`,
        source: 'reader_edition',
        id: re.id,
        slug: re.slug,
        title: re.title || 'Untitled reader edition',
        description: re.description || '',
        coverImage: fixMagazineImageUrl(re.coverImage || ''),
        publishDate: re.publishDate || re.createdAt || new Date().toISOString(),
        pageCount: re.pageCount ?? (Array.isArray(re.pages) ? re.pages.length : undefined),
        linkedIssueId: re.issueId,
        viewerPath: `/new-edition`,
        builderPath: re.issueId ? `/admin/magazine/builder/${re.issueId}` : undefined,
      });
    }

    rows.sort((a, b) => {
      const ta = new Date(a.publishDate).getTime() || 0;
      const tb = new Date(b.publishDate).getTime() || 0;
      return tb - ta;
    });

    return { success: true, data: rows };
  } catch (error: any) {
    console.error('Error in getEditionsListingAction:', error);
    return { success: false, error: error.message || 'Failed to load editions listing' };
  }
}
