'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin';
import type { StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { checkAdmin } from '@/lib/server/auth-utils';
import { parseIdml } from '@/lib/idml-parser';
import { mapIdmlToReaderPages, buildEditionMetadata, detectArticles, detectAdPage } from '@/lib/idml-template-mapper';
import type { ReaderPage, ReaderEdition } from '@/features/magazine/domain/types';
import {
  upsertReaderEdition,
  syncReaderEditionCoverFromIssue,
  syncReaderEditionsForIssue,
  getReaderEditionIdBySlug,
  getReaderEditionById,
  getReaderEditionByIssueId,
  hydrateEditionWithLegacyPages,
  CURRENT_READER_SCHEMA_VERSION,
} from '@/features/magazine/server/simple-reader';
import { deriveIssueSlug } from '@/features/magazine/domain/builder-to-reader';
import {
  hydrateReaderEditionContents,
  normalizeImageUrl,
  normalizeMagazinePageContent,
  normalizeStoryLibraryImageFields,
} from '@/lib/magazine-utils';
import {
  ReaderEditionSchema,
  ReaderPageSchema,
  safeParseMagazine,
} from '@/features/magazine/domain/validation-schemas';
import {
  safeRevalidatePath,
  normalizeStoryText,
  deriveStandfirst,
  mergeStoryLibraryItems,
  getIssueStoryLibraryCollectionItems,
  persistStoryLibraryForIssue,
} from './_helpers';
import { syncReaderEditionToLegacyIssue } from './reader-edition-actions';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDML_DRAFT_COLLECTION = 'magazine_idml_drafts';

// ---------------------------------------------------------------------------
// Exported actions
// ---------------------------------------------------------------------------

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
