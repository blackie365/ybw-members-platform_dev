import { adminDb } from '@/lib/firebase-admin';
import { db as clientFirestoreDb } from '@/lib/firebase';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';
import {
  CURRENT_READER_SCHEMA_VERSION,
  fixMagazineImageUrl,
  hydrateReaderEditionContents,
  isReaderSchemaCurrent,
  normalizeImageUrl,
} from '@/lib/magazine-utils';
export { CURRENT_READER_SCHEMA_VERSION, normalizeReaderEditionStructural };
import type { ReaderEdition, ReaderPage } from '../domain/types';
import { editionRecordsMatch } from '../domain/edition-match';
import {
  mapBuilderIssueToReaderEdition,
  deriveIssueSlug,
  extractPrintPageNumberFromBuilderPage,
  BUILDER_TYPE_TO_READER_TEMPLATE,
} from '../domain/builder-to-reader';
import type { MagazineIssue, MagazinePage } from '@/components/admin/magazine-builder/types';

/**
 * Pick a working Firestore instance.
 *
 * Order of preference:
 *   1. Admin SDK (`adminDb`) — available when FIREBASE_PRIVATE_KEY +
 *      FIREBASE_CLIENT_EMAIL are set (local dev, CI, some serverless envs).
 *   2. Client SDK (`clientFirestoreDb`) — always available on Vercel because
 *      it only needs NEXT_PUBLIC_FIREBASE_* env vars (already set there).
 *
 * Both Admin + Client SDKs expose the same collection/doc/where/orderBy/
 * limit/get surface used in this file. serializeData() already handles both
 * Timestamp variants (_seconds / seconds) so read results are identical.
 */
function getFirestore(): any {
  if (adminDb) return adminDb;
  if (clientFirestoreDb) return clientFirestoreDb as unknown as any;
  return null;
}

const COLLECTION = 'magazine_reader_editions';
const LEGACY_ISSUES_COLLECTION = 'magazine_issues';

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  PUBLISHED MAGAZINE READER — SINGLE SOURCE OF TRUTH AUTHORITY               ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                              ║
 * ║  AUTHORITY #1 — FAST PATH (99.9% of post-IDML-publish traffic):             ║
 * ║  Issue doc (magazine_issues/<issueId>) carries a TOP-LEVEL                  ║
 * ║  readerEditionId field, written by syncReaderEditionToLegacyIssue at the    ║
 * ║  end of ManualImporter Auto-Import publish. That id points at the ONE       ║
 * ║  published ReaderEdition doc in magazine_reader_editions/<id>.pages[]       ║
 * ║  (55 pages after a TEST.idml publish).                                      ║
 * ║                                                                              ║
 * ║  WE RETURN THIS. FULL STOP. NO RECONSTRUCTIONS, NO FALLBACKS, NO MERGES.    ║
 * ║  getReaderEditionById() checks COLLECTION/<id> FIRST and ONLY returns the   ║
 * ║  hydration of that exact doc.                                                ║
 * ║                                                                              ║
 * ║  AUTHORITY #2 — LEGACY-EMERGENCY ONLY paths                                 ║
 * ║  (a) where('issueId' == issueId) on COLLECTION — only used if               ║
 * ║      magazine_issues/<issueId>.readerEditionId field is empty (pre-2026     ║
 * ║      Auto-Import old issues that were never re-published).                  ║
 * ║  (b) Builder reconstruction from magazine_issues/<issueId>/pages/*          ║
 * ║      sub-collection (legacy 3-6 structural firestore rows, pre-IDML).       ║
 * ║      Path (b) IS STILL run with buildMergedBuilderPagesWithLinkedReader so  ║
 * ║      we merge shadow pages if there IS a readerEditionId available for      ║
 * ║      older issues that have been post-hoc linked to a ReaderEdition doc.    ║
 * ║                                                                              ║
 * ║  WHY THIS BLOCK EXISTS: Every previous "fix" added another dual-source      ║
 * ║  merge layer on top of the last one — which caused "cover repeated 3x"      ║
 * ║  bugs when legacy builder firestore rows (3-6 structural) accidentally      ║
 * ║  won the lookup order and shadow pages (55 IDML pages) were never used.     ║
 * ║  This comment block is EXECUTABLE DOCUMENTATION of the intent so nobody     ║
 * ║  ever re-shuffles the priority again.                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

const STRUCTURAL_TEMPLATES = new Set<ReaderPage['template']>([
  'cover',
  'contents',
  'editor-note',
  'back-cover',
]);
// When merging a STRUCTURAL base page (cover/contents/editor-note/back-cover)
// with its legacy counterpart, the template is only allowed to remain in this
// set. If the legacy page somehow had a different template (due to a corrupted
// Firestore write or a prior bug), we force the base structural template so we
// never, for example, end up rendering an editor-note page with a contents grid.
const STRUCTURAL_TEMPLATE_PINNED: Record<string, ReaderPage['template']> = {
  cover: 'cover',
  contents: 'contents',
  'editor-note': 'editor-note',
  'back-cover': 'back-cover',
};

function serializeData(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(serializeData);
  if (typeof data !== 'object') return data;

  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && '_seconds' in value) {
      result[key] = new Date((value as any)._seconds * 1000).toISOString();
    } else if (value && typeof value === 'object' && 'seconds' in value) {
      result[key] = new Date((value as any).seconds * 1000).toISOString();
    } else if (value && typeof value === 'object') {
      result[key] = serializeData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getMonthKey(value: unknown): string {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function editionMatchesIssue(edition: ReaderEdition, issue: { title?: string; publishDate?: string }) {
  const editionTitle = normalizeText(edition.title);
  const issueTitle = normalizeText(issue.title);
  const sameTitle =
    Boolean(editionTitle && issueTitle) &&
    (editionTitle === issueTitle ||
      editionTitle.includes(issueTitle) ||
      issueTitle.includes(editionTitle));

  const sameMonth = Boolean(getMonthKey(edition.publishDate)) && getMonthKey(edition.publishDate) === getMonthKey(issue.publishDate);

  return sameTitle || sameMonth;
}

function sanitizeImageUrl(value: unknown): string {
  const normalized = normalizeImageUrl(value);
  if (!normalized) return '';
  return fixMagazineImageUrl(normalized);
}

function sanitizeUrlList(values: unknown): string[] {
  const rawValues = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values
          .split(/\r?\n|,\s*(?=https?:\/\/|gs:\/\/|\/|\.\.?\/|data:)/g)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const entry of rawValues) {
    const source =
      typeof entry === 'string'
        ? entry
        : typeof entry === 'object' && entry
          ? String((entry as any).src || (entry as any).url || (entry as any).image || '')
          : '';
    const url = sanitizeImageUrl(source);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    cleaned.push(url);
  }
  return cleaned;
}

function normalizeRichTextForCompare(value: unknown): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitTextIntoParagraphs(input: unknown): string[] {
  const normalized = String(input || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  if (normalized.includes('<')) {
    return normalized
      .split(/\n{2,}/g)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const explicitParagraphs = normalized
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean);
  if (explicitParagraphs.length > 1) return explicitParagraphs;

  const lines = normalized
    .split(/\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return lines;

  const paragraphs: string[] = [];
  let current = '';

  const endsParagraph = (line: string) => /[.!?:"'”’)\]]$/.test(line.trim());
  const startsNewSentence = (line: string) => /^[A-Z0-9"'“‘(\[]/.test(line.trim());

  for (const line of lines) {
    if (!current) {
      current = line;
      continue;
    }

    if (endsParagraph(current) && startsNewSentence(line)) {
      paragraphs.push(current.trim());
      current = line;
      continue;
    }

    current = `${current} ${line}`.replace(/\s+/g, ' ').trim();
  }

  if (current) paragraphs.push(current.trim());
  return paragraphs;
}

function dedupeTextParts(parts: Array<unknown>, exclusions: Array<unknown> = []): string[] {
  const excluded = new Set(
    exclusions
      .map((value) => normalizeRichTextForCompare(value))
      .filter(Boolean),
  );
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const part of parts) {
    const normalized = normalizeRichTextForCompare(part);
    if (!normalized || excluded.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(String(part || '').trim());
  }

  return deduped;
}
function sanitizeReaderPage(page: ReaderPage): ReaderPage {
  const c: Record<string, unknown> = (page?.content && typeof page.content === 'object')
    ? (page.content as Record<string, unknown>)
    : {};

  const backgroundImage = sanitizeImageUrl(
    c.backgroundImage || (c as any).coverImage || ''
  );

  const cascadeMain = [
    c.imageUrl,
    c.featureImage,
    c.image,
    c.heroImage,
    c.mainImage,
    c.primaryImage,
    c.secondaryImage,
    c.topImage,
    c.leftImage,
    c.rightImage,
    c.bottomImage,
    c.coverImage,
    c.logoImage,
    c.partnerLogo,
    c.logo,
  ].map((v) => sanitizeImageUrl(v)).filter(Boolean);

  const urlListsConcat = [
    c.imageUrls,
    c.images,
    c.gallery,
    c.additionalImages,
    c.mediaItems,
    c.galleryItems,
    c.logoImages,
  ];

  const rawList: string[] = [];
  for (const listEntry of urlListsConcat) {
    rawList.push(...sanitizeUrlList(listEntry));
  }

  const seen = new Set<string>();
  const mergedList: string[] = [];
  for (const u of [...cascadeMain, ...rawList]) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    mergedList.push(u);
  }

  const imageUrl = cascadeMain[0] || mergedList[0] || '';
  const imageUrls = mergedList.filter(
    (url) => url && url !== imageUrl && url !== backgroundImage,
  );

  const standfirst = String(c.standfirst || c.intro || c.headline || '').trim();
  const quote = String(c.quote || '').trim();
  const body = dedupeTextParts(
    splitTextIntoParagraphs(c.body || c.text || c.article || c.content),
    [standfirst],
  ).join('\n\n');
  const pullQuotes = dedupeTextParts(Array.isArray(c.pullQuotes) ? (c.pullQuotes as unknown[]) : [], [
    standfirst,
    quote,
    body,
  ]);

  return {
    ...page,
    content: {
      ...(page.content as any),
      title: String(c.title || c.headline || '').trim(),
      body,
      standfirst: standfirst || undefined,
      author: String(c.author || c.name || c.byline || '').trim() || undefined,
      name: String(c.name || c.author || '').trim() || undefined,
      kicker: String(c.kicker || c.section || c.category || '').trim() || undefined,
      imageUrl: imageUrl || undefined,
      backgroundImage: backgroundImage || undefined,
      imageUrls,
      featureImage: imageUrl || undefined,
      image: imageUrl || undefined,
      quote: quote || undefined,
      pullQuotes,
      continuationLabel: String(c.continuationLabel || '').trim() || undefined,
      snapshotLabel: String(c.snapshotLabel || '').trim() || undefined,
      nextIssue: String(c.nextIssue || '').trim() || undefined,
      ctaLabel: String(c.ctaLabel || c.callToAction || '').trim() || undefined,
      ctaHref: String(c.ctaHref || c.linkUrl || c.url || '').trim() || undefined,
      label: String(c.label || c.brand || c.sponsor || '').trim() || undefined,
      videoUrl: String(c.videoUrl || '').trim() || undefined,
      pdfUrl: String(c.pdfUrl || '').trim() || undefined,
      partnerLogo: sanitizeImageUrl(c.partnerLogo || c.logoImage || '') || undefined,
      logoImage: sanitizeImageUrl(c.logoImage || c.partnerLogo || c.logo || '') || undefined,
      items: Array.isArray(c.items)
        ? (c.items as Array<any>)
            .map((item) => ({
              title: String(item?.title || item?.name || item?.headline || '').trim(),
              page: String(item?.page || item?.pageNumber || '').trim(),
            }))
            .filter((item) => item.title)
        : (Array.isArray(c.contents) ? (c.contents as Array<any>).map((x: any)=>({
            title: String(x?.title || x?.name || '').trim(),
            page: String(x?.page || '').trim(),
          })).filter((x:any)=>x.title) : []),
    },
  };
}

function isStoryPage(page: ReaderPage | undefined): page is ReaderPage {
  if (!page) return false;
  return (
    page.template === 'feature-left' ||
    page.template === 'feature-right' ||
    page.template === 'feature-full'
  );
}

function joinBodyText(...parts: Array<unknown>): string {
  return dedupeTextParts(
    parts.flatMap((part) => splitTextIntoParagraphs(part)),
  ).join('\n\n');
}

function mergeStoryPage(target: ReaderPage, source: ReaderPage): ReaderPage {
  const previousImageUrls = sanitizeUrlList(target.content.imageUrls);
  const mergedImageUrl = target.content.imageUrl || source.content.imageUrl || '';
  const mergedBackgroundImage = target.content.backgroundImage || source.content.backgroundImage || '';
  const mergedImageUrls = [
    ...previousImageUrls,
    ...(target.content.imageUrl ? [target.content.imageUrl] : []),
    ...(source.content.imageUrl ? [source.content.imageUrl] : []),
    ...sanitizeUrlList(source.content.imageUrls),
  ].filter(
    (url, index, all) =>
      url &&
      url !== mergedImageUrl &&
      url !== mergedBackgroundImage &&
      all.indexOf(url) === index,
  );
  const mergedPullQuotes = [
    ...(target.content.pullQuotes || []),
    ...(source.content.pullQuotes || []),
  ].filter((quote, index, all) => quote && all.indexOf(quote) === index);
  return sanitizeReaderPage({
    ...target,
    content: {
      ...target.content,
      body: joinBodyText(target.content.body, source.content.body),
      standfirst: target.content.standfirst || source.content.standfirst,
      imageUrl: mergedImageUrl || undefined,
      backgroundImage: mergedBackgroundImage || undefined,
      imageUrls: mergedImageUrls,
      videoUrl: target.content.videoUrl || source.content.videoUrl,
      quote: target.content.quote || source.content.quote,
      pullQuotes: mergedPullQuotes,
      items:
        Array.isArray(target.content.items) && target.content.items.length > 0
          ? target.content.items
          : source.content.items,
      mediaLayout:
        target.content.mediaLayout === 'background'
          ? target.content.mediaLayout
          : target.content.mediaLayout || source.content.mediaLayout,
      isContinuation: false,
      continuationLabel: undefined,
    },
  });
}

function collapseSplitStoryPages(pages: ReaderPage[]): ReaderPage[] {
  // Pass 1: sanitize and build story-key lookup. Non-story pages are not merged.
  const sanitized = pages.map(sanitizeReaderPage);
  const storyKeyOf = (page: ReaderPage): string => {
    if (!isStoryPage(page)) return '';
    return normalizeText(page.content?.continuationLabel || page.content?.title);
  };

  // Pass 2: first occurrence merges all subsequent same-key pages (non-adjacent A/B/C/D halves).
  // This handles the builder pattern where a feature has a left-page 36 then right-page 46/47/48
  // later in document order due to print-spread layout constraints.
  const firstOccurrence = new Map<string, number>();
  const collapsed: ReaderPage[] = [];
  for (const rawPage of sanitized) {
    const page: ReaderPage = {
      ...rawPage,
      content: {
        ...rawPage.content,
        isContinuation: false,
        continuationLabel: undefined,
      },
    };
    const key = storyKeyOf(page);
    if (!key) {
      // Structural page or ad or no title: keep as-is, not merged
      collapsed.push(page);
      continue;
    }
    if (!firstOccurrence.has(key)) {
      // First occurrence of this story: keep it
      firstOccurrence.set(key, collapsed.length);
      collapsed.push(page);
      continue;
    }
    // Duplicate title story page: merge into first occurrence
    const firstIdx = firstOccurrence.get(key)!;
    const prev = collapsed[firstIdx];
    const prevKey = storyKeyOf(prev);
    const eitherMarked = Boolean(prev.content?.isContinuation) || Boolean(page.content?.isContinuation);
    const bothHaveBody = Boolean(prev.content?.body) && Boolean(page.content?.body);
    if (prevKey === key && (eitherMarked || bothHaveBody)) {
      collapsed[firstIdx] = mergeStoryPage(prev, page);
    } else {
      // Unexpected mismatch: keep second page separate
      collapsed.push(page);
    }
  }
  return collapsed.map((page) => ({
    ...page,
    content: {
      ...page.content,
      isContinuation: false,
      continuationLabel: undefined,
    },
  }));
}

/**
 * Deterministic read-side structural normalization pipeline.
 *
 * This MUST run on BOTH:
 *   1. Legacy magazine_reader_editions doc path (hydrateEditionWithLegacyPages)
 *   2. Builder-primary magazine_issues → pages subcollection path
 *      (mapBuilderIssueToReaderEdition output)
 *
 * Without this, split-story A/B halves are not collapsed → 62 raw pages
 * instead of 46 logical pages, stored non-contiguous positions break
 * pages.sort(), and pre-2026-08 template misassignments (contents page labelled
 * editor-note due to "editorial" text in intro) leak through into the reader.
 *
 * Pipeline order (idempotent):
 *   1. sanitizeReaderPage per page (dedupe body, alias body/text, URL fix)
 *   2. read-side template defense (editorial-vs-contents-vs-ad classification)
 *   3. position ASC sort (guarantees pages.sort is stable)
 *   4. collapseSplitStoryPages (A/B halves → single logical story)
 *   5. renumber position 1..N (guarantees findPageIndexByClickHint works)
 *   6. cover image derivation (from first template=cover page)
 */
function normalizeReaderEditionStructural<T extends ReaderEdition>(
  edition: T,
  pagesIn: ReaderPage[],
  issueCoverFallback: string = '',
): T & { pages: ReaderPage[]; pageCount: number; schemaVersion: number } {
  const pagesStructural = pagesIn
    .map(sanitizeReaderPage)
    .map((page) => {
      const template = String(page.template || '').trim().toLowerCase();
      const ct = page.content?.title && typeof page.content.title === 'string'
        ? page.content.title.trim().toLowerCase()
        : '';
      const cb = page.content?.body && typeof page.content.body === 'string'
        ? page.content.body.trim().slice(0, 320).toLowerCase()
        : (page.content?.text && typeof page.content.text === 'string'
          ? page.content.text.trim().slice(0, 320).toLowerCase()
          : '');
      const looksLikeEditorial = /\b(editor('?s)? note|from the editor|editorial)\b/.test(`${ct} ${cb}`);
      const looksLikeAd = /\b(advertisement|advert|ad page|sponsor|sponsored by)\b/.test(`${ct} ${cb}`) &&
        !Array.isArray(page.content?.items);
      const hasItems = Array.isArray(page.content?.items) && page.content.items.length > 0;
      let nextTemplate = page.template;
      if (template === 'editor-note') nextTemplate = 'editor-note';
      else if (template === 'contents' && looksLikeEditorial) nextTemplate = 'editor-note';
      else if (looksLikeEditorial && !hasItems) nextTemplate = 'editor-note';
      else if (template === 'ad' || template === 'full-page-ad') nextTemplate = 'ad';
      else if (looksLikeAd && !looksLikeEditorial) nextTemplate = 'ad';
      let content = page.content;
      if (nextTemplate === 'editor-note') {
        content = { ...(content || {}), items: [] };
      } else if (nextTemplate === 'ad') {
        content = { ...(content || {}), items: [] };
      } else if (nextTemplate === 'contents') {
        content = { ...(content || {}) };
      }
      return sanitizeReaderPage({ ...page, template: nextTemplate, content });
    })
    .sort((left, right) => {
      const lPos = typeof left.position === 'number' ? left.position : 0;
      const rPos = typeof right.position === 'number' ? right.position : 0;
      return lPos - rPos;
    });
  const collapsedPages = collapseSplitStoryPages(pagesStructural);
  const collapsedPagesRenumbered = collapsedPages.map((page, index) => ({
    ...page,
    position: index + 1,
  }));
  return {
    ...edition,
    coverImage:
      collapsedPages.find((page) => page.template === 'cover')?.content.imageUrl ||
      sanitizeImageUrl(edition.coverImage) ||
      issueCoverFallback ||
      '',
    pages: collapsedPagesRenumbered,
    pageCount: collapsedPagesRenumbered.length,
    schemaVersion: CURRENT_READER_SCHEMA_VERSION,
  };
}

function mapLegacyTypeToTemplate(type: unknown): ReaderPage['template'] | null {
  switch (String(type || '').trim()) {
    case 'cover':
      return 'cover';
    case 'contents':
      return 'contents';
    case 'editorial':
      return 'editor-note';
    case 'feature-left':
      return 'feature-left';
    case 'feature-right':
    case 'column':
      return 'feature-right';
    case 'lifestyle':
    case 'spotlight':
    case 'partner':
      return 'feature-left';
    case 'full-page-ad':
      return 'ad';
    case 'back-cover':
      return 'back-cover';
    default:
      return null;
  }
}

function buildLegacyLookupKey(page: ReaderPage): string {
  if (STRUCTURAL_TEMPLATES.has(page.template)) return `template:${page.template}`;
  const title = normalizeText(page.content?.title);
  return title ? `title:${title}` : `fallback:${page.template}:${page.id}`;
}

function mapLegacyPageToReaderPage(
  page: Record<string, any>,
  issue: { id: string; title?: string; coverImage?: string; publishDate?: string; description?: string },
  index: number,
): ReaderPage | null {
  const template = mapLegacyTypeToTemplate(page.type);
  if (!template) return null;

  const content = page.content && typeof page.content === 'object' ? page.content : {};
  const imageUrl =
    sanitizeImageUrl(content.featureImage) ||
    sanitizeImageUrl(content.image) ||
    (template === 'cover' ? sanitizeImageUrl(issue.coverImage) : '') ||
    sanitizeImageUrl(content.backgroundImage);
  const backgroundImage = sanitizeImageUrl(content.backgroundImage);
  const imageUrls = [
    ...sanitizeUrlList(content.images),
    ...sanitizeUrlList(content.gallery),
    ...sanitizeUrlList(content.additionalImages),
  ].filter((url, urlIndex, all) => url !== imageUrl && url !== backgroundImage && all.indexOf(url) === urlIndex);

  const title =
    String(
      content.title ||
        content.headline ||
        (template === 'cover' ? issue.title : ''),
    ).trim() || (template === 'contents' ? 'In This Issue' : '');

  const body =
    String(
      content.text ||
        content.body ||
        content.message ||
        content.bio ||
        (template === 'back-cover' ? issue.description : ''),
    ).trim();

  return sanitizeReaderPage({
    id: `legacy-${issue.id}-${String(page.id ?? index)}-${page.docId || index}`,
    position: Number(page.id ?? page.pageNumber ?? index + 1),
    template,
    content: {
      title,
      body,
      author: String(content.author || '').trim() || undefined,
      name: String(content.name || content.role || '').trim() || undefined,
      kicker: String(content.kicker || content.label || '').trim() || undefined,
      standfirst: String(content.intro || content.subheadline || content.headline || '').trim() || undefined,
      imageUrl: imageUrl || undefined,
      imageUrls,
      backgroundImage: backgroundImage || undefined,
      videoUrl: String(content.videoUrl || '').trim() || undefined,
      quote: String(content.quote || '').trim() || undefined,
      pullQuotes: Array.isArray(content.pullQuotes)
        ? content.pullQuotes.map((item: unknown) => String(item || '').trim()).filter(Boolean)
        : [],
      items: Array.isArray(content.items)
        ? content.items
            .map((item: any) => ({
              title: String(item?.title || '').trim(),
              page: String(item?.page || '').trim(),
            }))
            .filter((item: { title: string }) => item.title)
        : [],
      ctaLabel: String(content.ctaLabel || content.label || '').trim() || undefined,
      ctaHref: String(content.linkUrl || content.ctaHref || '').trim() || undefined,
      label: String(content.label || '').trim() || undefined,
      mediaLayout: String(content.mediaLayout || '').trim() || undefined,
      nextIssue: String(content.nextIssue || '').trim() || undefined,
    },
  });
}

function mergeReaderPageWithLegacy(basePage: ReaderPage, legacyPage: ReaderPage | undefined): ReaderPage {
  const base = sanitizeReaderPage(basePage);
  if (!legacyPage) return base;

  // Structural templates (cover/contents/editor-note/back-cover) keep their
  // original base template PINNED. If a legacy page somehow had a corrupted
  // template field (editor-note stored with type=contents due to prior bug),
  // we keep the base structural template so the correct renderer always runs.
  //
  // CONTENT PRIORITY: Legacy (Spread Builder) edits ALWAYS win over IDML-
  // published ReaderEdition content. The user explicitly typed/edited those
  // fields in the builder UI; the base ReaderEdition content is only used
  // as a fallback if the builder never wrote anything for that slot.
  const isStructural = STRUCTURAL_TEMPLATES.has(base.template);
  const pinnedTemplate: ReaderPage['template'] = isStructural
    ? STRUCTURAL_TEMPLATE_PINNED[base.template as keyof typeof STRUCTURAL_TEMPLATE_PINNED] ?? base.template
    : base.template;
  const baseImages = sanitizeUrlList(base.content.imageUrls);
  const legacyImages = sanitizeUrlList(legacyPage.content.imageUrls);
  const imageUrl =
    legacyPage.content.imageUrl || base.content.imageUrl || '';
  const backgroundImage =
    legacyPage.content.backgroundImage || base.content.backgroundImage || '';
  const imageUrls = [...legacyImages, ...baseImages].filter(
    (url, index, all) => url !== imageUrl && url !== backgroundImage && all.indexOf(url) === index,
  );

  // Contents items grid ONLY belongs on contents template. Never bleed items
  // into other templates (produces the "rik-rak of contents pages" symptom).
  const legacyHasItems = Array.isArray(legacyPage.content.items) && legacyPage.content.items.length > 0;
  const mergedItems = pinnedTemplate === 'contents'
    ? (legacyHasItems ? legacyPage.content.items : base.content.items ?? [])
    : [];

  return sanitizeReaderPage({
    ...base,
    template: isStructural
      ? pinnedTemplate
      : (legacyPage.template || base.template),
    content: {
      ...base.content,
      ...legacyPage.content,
      title: legacyPage.content.title || base.content.title,
      body: legacyPage.content.body || base.content.body,
      standfirst: legacyPage.content.standfirst || base.content.standfirst,
      author: legacyPage.content.author || base.content.author,
      name: legacyPage.content.name || base.content.name,
      kicker: legacyPage.content.kicker || base.content.kicker,
      imageUrl: imageUrl || undefined,
      backgroundImage: backgroundImage || undefined,
      imageUrls,
      videoUrl: legacyPage.content.videoUrl || base.content.videoUrl,
      quote: legacyPage.content.quote || base.content.quote,
      pullQuotes: [...(legacyPage.content.pullQuotes || []), ...(base.content.pullQuotes || [])].filter(
        (quote, index, all) => quote && all.indexOf(quote) === index,
      ),
      items: mergedItems,
      ctaLabel: legacyPage.content.ctaLabel || base.content.ctaLabel,
      ctaHref: legacyPage.content.ctaHref || base.content.ctaHref,
      label: legacyPage.content.label || base.content.label,
      mediaLayout: legacyPage.content.mediaLayout || base.content.mediaLayout,
      nextIssue: legacyPage.content.nextIssue || base.content.nextIssue,
    },
  });
}

export async function hydrateEditionWithLegacyPages(edition: ReaderEdition): Promise<ReaderEdition> {
  const db = getFirestore();

  // ── Schema-version fast path scope ──────────────────────────────────────
  // CURRENT_READER_SCHEMA_VERSION only means we can SKIP the expensive
  // per-page async content hydration step (fetching StoryLibrary matches,
  // InDesign frame lookups, etc.). We MUST STILL ALWAYS perform the
  // deterministic read-side normalization pipeline:
  //   1. position ASC sort        (legacy stored positions are non-contiguous
  //                                after old split-story publish writes)
  //   2. read-side template defense (editor-note vs contents vs ad cleanup
  //                                for pre-2026-08-14 publish bugs)
  //   3. collapseSplitStoryPages  (A/B split halves → one logical story)
  //   4. renumber position 1..N   (guarantees MagazineShell pages.sort is
  //                                stable and "page 1" is actually the cover)
  //   5. cover image derivation    (from template=cover page content)
  // Without these, a legacy doc stamped schemaVersion=1 is returned raw and
  // the reader shows mid-edition articles on page 1 (garbage stored order)
  // and split-story duplicates with blank A/B halves.
  const schemaCurrent = isReaderSchemaCurrent(edition) && typeof (edition as any).pageCount === 'number';

  const issues = db ? await getMagazineIssuesServer().catch(() => []) : [];
  const matchingIssue = issues.find((issue) => editionMatchesIssue(edition, issue)) ?? null;
  const issueCover = matchingIssue ? sanitizeImageUrl(matchingIssue.coverImage) || '' : '';
  let legacyPages: ReaderPage[] = [];
  if (db && matchingIssue) {
    const pagesSnapshot = await db
      .collection(LEGACY_ISSUES_COLLECTION)
      .doc(matchingIssue.id)
      .collection('pages')
      .orderBy('id', 'asc')
      .get()
      .catch(async () =>
        db
          .collection(LEGACY_ISSUES_COLLECTION)
          .doc(matchingIssue.id)
          .collection('pages')
          .get(),
      );

    const docs = pagesSnapshot?.docs ?? [];
    legacyPages = docs
      .map((doc: any, index: number) =>
        mapLegacyPageToReaderPage(
          { docId: doc.id, ...serializeData(doc.data ? doc.data() : doc) },
          matchingIssue,
          index,
        ),
      )
      .filter(Boolean) as ReaderPage[];
  }

  const legacyByKey = new Map<string, ReaderPage>();
  for (const page of legacyPages) {
    const key = buildLegacyLookupKey(page);
    if (!legacyByKey.has(key)) {
      legacyByKey.set(key, page);
    }
  }

  const rawPages: ReaderPage[] = Array.isArray(edition.pages) ? [...edition.pages] : [];
  let pages: ReaderPage[];

  if (legacyPages.length > 0) {
    const mergedPages = rawPages.map((page) =>
      mergeReaderPageWithLegacy(page, legacyByKey.get(buildLegacyLookupKey(page))),
    );
    const existingKeys = new Set(mergedPages.map((page) => buildLegacyLookupKey(page)));
    const maxPosition = mergedPages.reduce((max, page) => Math.max(max, Number(page.position) || 0), 0);
    const appendedLegacyPages = legacyPages
      .filter((page) => !existingKeys.has(buildLegacyLookupKey(page)))
      .map((page, index) => ({
        ...page,
        position: maxPosition + index + 1,
      }));
    pages = [...mergedPages, ...appendedLegacyPages];
  } else {
    pages = rawPages;
  }

  const rebuilt = normalizeReaderEditionStructural(edition, pages, issueCover);

  // Only skip the expensive per-page content hydration pipeline when the
  // schema already matches the current version; otherwise run it to pick up
  // any content-field aliases / URL fixes written by newer import code.
  let out: ReaderEdition;
  if (schemaCurrent) {
    out = rebuilt;
  } else {
    const hydrated = hydrateReaderEditionContents(rebuilt);
    out = (hydrated as ReaderEdition | null) ?? rebuilt;
  }
  if (typeof (out as any).schemaVersion !== 'number') {
    (out as any).schemaVersion = CURRENT_READER_SCHEMA_VERSION;
  }
  return out;
}

async function loadBuilderPages(firestore: any, issueId: string): Promise<MagazinePage[]> {
  const snap = await firestore
    .collection(LEGACY_ISSUES_COLLECTION)
    .doc(issueId)
    .collection('pages')
    .orderBy('id', 'asc')
    .get()
    .catch(async () =>
      firestore.collection(LEGACY_ISSUES_COLLECTION).doc(issueId).collection('pages').get(),
    );
  const docs = snap?.docs ?? [];
  return docs.map((doc: any) => {
    const raw = doc.data ? doc.data() : doc;
    const serialized = serializeData(raw);
    return {
      docId: doc.id,
      ...serialized,
    } as MagazinePage;
  });
}

async function buildMergedBuilderPagesWithLinkedReader(
  firestore: any,
  issueId: string,
  issueRaw: Record<string, unknown>,
  legacyPages: MagazinePage[],
): Promise<MagazinePage[]> {
  const base = Array.isArray(legacyPages) ? [...legacyPages] : [];
  const linkedReaderId = String(issueRaw.readerEditionId || '').trim();
  if (!linkedReaderId) return base;
  try {
    const linkedDoc = await firestore.collection(COLLECTION).doc(linkedReaderId).get();
    const exists = typeof linkedDoc?.exists === 'boolean' ? linkedDoc.exists : Boolean(linkedDoc);
    if (!exists) return base;
    const raw = (linkedDoc.data ? linkedDoc.data() : linkedDoc) as Record<string, unknown>;
    const linkedPagesRaw = Array.isArray(raw.pages) ? raw.pages : [];
    const shadowPages = (linkedPagesRaw as unknown[])
      .map((rawPage) => {
        const page = serializeData(rawPage) as Record<string, unknown>;
        const positionRaw = (page as any).position;
        const position =
          typeof positionRaw === 'number' ? positionRaw : Number(positionRaw || 0);
        const content = (page.content || {}) as Record<string, unknown>;
        const template = String(page.template || '').trim() || 'feature-full';
        const builderType = Object.entries(BUILDER_TYPE_TO_READER_TEMPLATE).find(
          ([, t]) => t === template,
        )?.[0];
        return {
          docId: String(page.id || `reader:${linkedReaderId}:${position}`),
          sourceRef: String(page.id || `reader:${linkedReaderId}:${position}`),
          sourceReaderEditionId: linkedReaderId,
          generatedFromStoryLibrary: true,
          readOnly: false,
          id: position,
          type: builderType || template,
          position,
          pageNumber: Number(content.pageNumber || position) || position,
          title: String(content.title || '').trim(),
          content,
        } as unknown as MagazinePage;
      })
      .filter((p): p is MagazinePage => Boolean(p));
    if (shadowPages.length === 0) return base;

    const legacyByPrint = new Map<number, MagazinePage>();
    for (const lp of base) {
      const pn = extractPrintPageNumberFromBuilderPage(lp);
      if (pn && pn > 0) legacyByPrint.set(pn, lp);
    }
    const merged: MagazinePage[] = [];
    const allPrints = new Set<number>();
    for (const sp of shadowPages) {
      const pn = extractPrintPageNumberFromBuilderPage(sp);
      if (pn && pn > 0) allPrints.add(pn);
    }
    for (const lp of base) {
      const pn = extractPrintPageNumberFromBuilderPage(lp);
      if (pn && pn > 0) allPrints.add(pn);
    }
    for (const printNum of [...allPrints].sort((a, b) => a - b)) {
      const legacy = legacyByPrint.get(printNum);
      const shadow = shadowPages.find(
        (sp) => extractPrintPageNumberFromBuilderPage(sp) === printNum,
      );
      if (legacy && shadow) merged.push(legacy);
      else if (legacy) merged.push(legacy);
      else if (shadow) merged.push(shadow);
    }
    const seen = new Set(merged.map((p) => p.docId));
    for (const lp of base) if (!seen.has(lp.docId)) { merged.push(lp); seen.add(lp.docId); }
    for (const sp of shadowPages) if (!seen.has(sp.docId)) { merged.push(sp); seen.add(sp.docId); }
    merged.sort((a, b) => {
      const la = extractPrintPageNumberFromBuilderPage(a) ?? (a.id || 0);
      const lb = extractPrintPageNumberFromBuilderPage(b) ?? (b.id || 0);
      return Number(la) - Number(lb);
    });
    return merged;
  } catch (err) {
    console.warn('[buildMergedBuilderPagesWithLinkedReader] merge failed:', err);
    return base;
  }
}

async function getReaderEditionFromBuilderIssue(
  firestore: any,
  issueId: string,
  issueRaw: Record<string, unknown>,
): Promise<ReaderEdition | null> {
  const issue: MagazineIssue & {
    id: string;
    schemaVersion?: number;
    readerEditionSlug?: string;
    slug?: string;
    coverImage?: string;
  } = {
    ...(serializeData(issueRaw) as any),
    id: issueId,
  };
  const legacyPages = await loadBuilderPages(firestore, issueId);
  if (legacyPages.length === 0) return null;
  const pages = await buildMergedBuilderPagesWithLinkedReader(
    firestore,
    issueId,
    issueRaw,
    legacyPages,
  );
  const mapped = mapBuilderIssueToReaderEdition(issue, pages);
  const issueCover = sanitizeImageUrl(issue.coverImage) || '';
  const structural = normalizeReaderEditionStructural(mapped, mapped.pages, issueCover);
  const hydrated = hydrateReaderEditionContents(structural);
  return (hydrated as ReaderEdition | null) ?? structural;
}

async function findBuilderIssueBySlug(
  firestore: any,
  slug: string,
): Promise<{ issueId: string; issueRaw: Record<string, unknown> } | null> {
  const slugLower = String(slug || '').trim().toLowerCase();
  if (!slugLower) return null;

  // 1. Direct equality on `slug` / `readerEditionSlug`
  const slugSnap = await firestore
    .collection(LEGACY_ISSUES_COLLECTION)
    .where('slug', '==', slugLower)
    .limit(2)
    .get()
    .catch(() => ({ empty: true, docs: [] }));
  if (slugSnap && !slugSnap.empty && slugSnap.docs?.length > 0) {
    const d = slugSnap.docs[0];
    return { issueId: d.id, issueRaw: (d.data ? d.data() : d) as Record<string, unknown> };
  }
  const resnap = await firestore
    .collection(LEGACY_ISSUES_COLLECTION)
    .where('readerEditionSlug', '==', slugLower)
    .limit(2)
    .get()
    .catch(() => ({ empty: true, docs: [] }));
  if (resnap && !resnap.empty && resnap.docs?.length > 0) {
    const d = resnap.docs[0];
    return { issueId: d.id, issueRaw: (d.data ? d.data() : d) as Record<string, unknown> };
  }

  // 2. Derive slug from issue and match — handles old issues without slug field
  const allSnap = await firestore
    .collection(LEGACY_ISSUES_COLLECTION)
    .orderBy('publishDate', 'desc')
    .limit(50)
    .get()
    .catch(() => ({ empty: true, docs: [] }));
  const docs = allSnap?.docs ?? [];
  for (const d of docs) {
    const raw = (d.data ? d.data() : d) as Record<string, unknown>;
    const derived = deriveIssueSlug({
      id: d.id,
      title: String(raw.title || ''),
      ghostSyncTag: String(raw.ghostSyncTag || ''),
      readerEditionSlug: String(raw.readerEditionSlug || ''),
      slug: String(raw.slug || ''),
    }).toLowerCase();
    if (derived === slugLower) {
      return { issueId: d.id, issueRaw: raw };
    }
  }
  return null;
}

export async function getReaderEditionByIssueId(issueId: string): Promise<ReaderEdition | null> {
  const firestore = getFirestore();
  if (!firestore) return null;

  const issueDoc = await firestore.collection(LEGACY_ISSUES_COLLECTION).doc(issueId).get();
  const issueExists = typeof issueDoc?.exists === 'boolean' ? issueDoc.exists : Boolean(issueDoc);
  const issueRaw =
    issueExists && issueDoc.data ? (issueDoc.data() as Record<string, unknown>) : null;

  /**
   * AUTHORITY #1 — FAST PATH (see block comment at top of file):
   * magazine_issues.readerEditionId → hydrate EXACT reader edition doc → return NOW.
   * No merges, no reconstructions, no where() fallback races.
   */
  const linkedId = issueRaw ? String(issueRaw.readerEditionId || '').trim() : '';
  if (linkedId) {
    try {
      const direct = await getReaderEditionById(linkedId);
      if (direct && Array.isArray(direct.pages) && direct.pages.length > 0) return direct;
    } catch (err) {
      console.warn(
        '[getReaderEditionByIssueId] AUTHORITY#1 readerEditionId direct fetch failed (falling back):',
        err,
      );
    }
  }

  /**
   * AUTHORITY #2a — LEGACY EMERGENCY: try where(issueId == id) on COLLECTION.
   */
  try {
    const explicitSnapshot = await firestore
      .collection(COLLECTION)
      .where('issueId', '==', issueId)
      .orderBy('publishDate', 'desc')
      .limit(1)
      .get();
    const explicitDocs = explicitSnapshot?.docs ?? [];
    if (explicitDocs.length > 0) {
      const doc = explicitDocs[0];
      const hydrated = await hydrateEditionWithLegacyPages(
        serializeData({ id: doc.id, ...(doc.data ? doc.data() : doc) }) as ReaderEdition,
      );
      if (hydrated && Array.isArray(hydrated.pages) && hydrated.pages.length > 0) return hydrated;
    }
  } catch (err) {
    console.warn(
      '[getReaderEditionByIssueId] AUTHORITY#2a where(issueId) query failed (index?):',
      err,
    );
  }

  /**
   * AUTHORITY #2b — LEGACY EMERGENCY: rebuild from builder firestore pages.
   * Uses buildMergedBuilderPagesWithLinkedReader so even legacy reconstruction
   * merges linked readerEdition shadow pages (55) if available.
   */
  if (issueExists && issueRaw) {
    try {
      const ed = await getReaderEditionFromBuilderIssue(firestore, issueId, issueRaw);
      if (ed) return ed;
    } catch (err) {
      console.warn(
        '[getReaderEditionByIssueId] AUTHORITY#2b builder reconstruction failed:',
        err,
      );
    }
  }
  return null;
}

export async function getReaderEditionById(id: string): Promise<ReaderEdition | null> {
  const firestore = getFirestore();
  if (!firestore) return null;

  /**
   * AUTHORITY #1 (see file-level comment):
   * magazine_reader_editions/<id> — THE actual ReaderEdition produced by IDML publish.
   * We look this up FIRST. Only if it's missing/empty do we try the builder-doc
   * reconstruction as legacy emergency fallback.
   */
  const readerDoc = await firestore.collection(COLLECTION).doc(id).get();
  const readerExists =
    typeof readerDoc?.exists === 'boolean' ? readerDoc.exists : Boolean(readerDoc);
  if (readerExists) {
    try {
      const reader = await hydrateEditionWithLegacyPages(
        serializeData({ id, ...(readerDoc.data ? readerDoc.data() : readerDoc) }) as ReaderEdition,
      );
      if (reader && Array.isArray(reader.pages) && reader.pages.length > 0) {
        return reader;
      }
    } catch (err) {
      console.warn('[getReaderEditionById] AUTHORITY#1 hydration failed:', err);
    }
  }

  // LEGACY EMERGENCY FALLBACK — id is a builder issue id, rebuild from builder firestore.
  const builderDoc = await firestore.collection(LEGACY_ISSUES_COLLECTION).doc(id).get();
  const builderExists =
    typeof builderDoc?.exists === 'boolean' ? builderDoc.exists : Boolean(builderDoc);
  if (builderExists) {
    try {
      const raw = (builderDoc.data ? builderDoc.data() : builderDoc) as Record<string, unknown>;
      const legacyPages = await loadBuilderPages(firestore, id);
      if (legacyPages.length > 0) {
        const issue = {
          ...(serializeData(raw) as any),
          id,
        } as MagazineIssue & { id: string; coverImage?: string };
        const mergedPages = await buildMergedBuilderPagesWithLinkedReader(
          firestore,
          id,
          raw,
          legacyPages,
        );
        const mapped = mapBuilderIssueToReaderEdition(issue, mergedPages);
        const issueCover = sanitizeImageUrl(issue.coverImage) || '';
        const structural = normalizeReaderEditionStructural(mapped, mapped.pages, issueCover);
        const hydrated = hydrateReaderEditionContents(structural);
        return (hydrated as ReaderEdition | null) ?? structural;
      }
    } catch (err) {
      console.warn('[getReaderEditionById] LEGACY builder reconstruction fallback failed:', err);
    }
  }

  // LAST RESORT: return the reader doc even with empty pages.
  if (readerExists) {
    return hydrateEditionWithLegacyPages(
      serializeData({ id, ...(readerDoc.data ? readerDoc.data() : readerDoc) }) as ReaderEdition,
    );
  }
  return null;
}

export async function listReaderEditions(limit = 24): Promise<ReaderEdition[]> {
  const firestore = getFirestore();
  if (!firestore) return [];

  /**
   * AUTHORITY #1 (see file-level comment):
   * magazine_reader_editions ordered by publishDate DESC → hydrate each → return NOW.
   * No builder-issue reconstruction in the hot listing path.
   */
  try {
    const snapshot = await firestore
      .collection(COLLECTION)
      .orderBy('publishDate', 'desc')
      .limit(limit)
      .get()
      .catch(() => null);
    const docs = snapshot?.docs ?? [];
    if (docs.length > 0) {
      return Promise.all(
        docs.map(async (doc: any) =>
          hydrateEditionWithLegacyPages(
            serializeData({ id: doc.id, ...(doc.data ? doc.data() : doc) }) as ReaderEdition,
          ),
        ),
      );
    }
  } catch (err) {
    console.warn('[listReaderEditions] AUTHORITY#1 listing failed (builder fallback):', err);
  }

  /**
   * AUTHORITY #2 (LEGACY EMERGENCY):
   * Builder issues listing. Only runs if COLLECTION has 0 docs.
   */
  const builderSnap = await firestore
    .collection(LEGACY_ISSUES_COLLECTION)
    .orderBy('publishDate', 'desc')
    .limit(limit)
    .get()
    .catch(() => ({ empty: true, docs: [] }));
  const builderDocs = builderSnap?.docs ?? [];
  const out: ReaderEdition[] = [];
  for (const doc of builderDocs) {
    try {
      const raw = (doc.data ? doc.data() : doc) as Record<string, unknown>;
      const ed = await getReaderEditionFromBuilderIssue(firestore, doc.id, raw);
      if (ed) out.push(ed);
    } catch (err) {
      console.warn(`[listReaderEditions] builder issue ${doc.id} failed:`, err);
    }
  }
  return out;
}

export async function getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null> {
  const firestore = getFirestore();
  if (!firestore) return null;

  /**
   * AUTHORITY #1 (see file-level comment): direct COLLECTION slug match.
   */
  try {
    const snapshot = await firestore
      .collection(COLLECTION)
      .where('slug', '==', slug)
      .limit(1)
      .get();
    const docs = snapshot?.docs ?? [];
    if (docs.length > 0) {
      const doc = docs[0];
      const reader = await hydrateEditionWithLegacyPages(
        serializeData({ id: doc.id, ...(doc.data ? doc.data() : doc) }) as ReaderEdition,
      );
      if (reader && Array.isArray(reader.pages) && reader.pages.length > 0) return reader;
    }
  } catch (err) {
    console.warn('[getReaderEditionBySlug] AUTHORITY#1 direct slug query failed (builder fallback):', err);
  }

  /**
   * AUTHORITY #2 (LEGACY EMERGENCY): builder issue slug match.
   * Uses buildMergedBuilderPagesWithLinkedReader inside getReaderEditionFromBuilderIssue.
   */
  const builderMatch = await findBuilderIssueBySlug(firestore, slug);
  if (builderMatch) {
    try {
      const ed = await getReaderEditionFromBuilderIssue(
        firestore,
        builderMatch.issueId,
        builderMatch.issueRaw,
      );
      if (ed) return ed;
    } catch (err) {
      console.warn('[getReaderEditionBySlug] AUTHORITY#2 builder slug fallback failed:', err);
    }
  }
  return null;
}

export async function getReaderEditionIdBySlug(slug: string): Promise<string | null> {
  const firestore = getFirestore();
  if (!firestore) return null;

  /** AUTHORITY #1: COLLECTION slug match. */
  try {
    const snapshot = await firestore
      .collection(COLLECTION)
      .where('slug', '==', slug)
      .limit(1)
      .get();
    const docs = snapshot?.docs ?? [];
    if (docs.length > 0) return docs[0].id;
  } catch {
    /* ignored */
  }

  /** AUTHORITY #2 (LEGACY EMERGENCY): builder issue slug match. */
  const builderMatch = await findBuilderIssueBySlug(firestore, slug);
  if (builderMatch) return builderMatch.issueId;
  return null;
}

export async function upsertReaderEdition(edition: ReaderEdition): Promise<void> {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firebase not configured for server writes');
  const stamped: ReaderEdition & { schemaVersion: number } = {
    ...edition,
    schemaVersion: CURRENT_READER_SCHEMA_VERSION,
  };
  await firestore.collection(COLLECTION).doc(edition.id).set(stamped, { merge: true });
}

export async function syncReaderEditionCoverFromIssue(editionId: string): Promise<ReaderEdition | null> {
  const firestore = getFirestore();
  if (!firestore) return null;

  const editionDoc = await firestore.collection(COLLECTION).doc(editionId).get();
  const exists = typeof editionDoc?.exists === 'boolean' ? editionDoc.exists : Boolean(editionDoc);
  if (!exists) return null;
  const edition = serializeData({ id: editionId, ...(editionDoc.data ? editionDoc.data() : editionDoc) }) as ReaderEdition;

  const issues = await getMagazineIssuesServer();
  const matchingIssue = issues.find((issue) => editionRecordsMatch(issue, edition)) ?? null;
  const issueCover = matchingIssue ? sanitizeImageUrl(matchingIssue.coverImage) || '' : '';
  if (!issueCover || issueCover === edition.coverImage) return edition;

  const synced: ReaderEdition = {
    ...edition,
    coverImage: issueCover,
    pages: (edition.pages || []).map((page) =>
      page.template === 'cover'
        ? {
            ...page,
            content: {
              ...page.content,
              imageUrl: issueCover,
              imageUrls: issueCover ? [issueCover] : page.content.imageUrls || [],
            },
          }
        : page,
    ),
  };

  await upsertReaderEdition(synced);
  return synced;
}

export async function syncReaderEditionsForIssue(issueId: string): Promise<number> {
  const firestore = getFirestore();
  if (!firestore) return 0;

  const issueDoc = await firestore.collection(LEGACY_ISSUES_COLLECTION).doc(issueId).get();
  const exists = typeof issueDoc?.exists === 'boolean' ? issueDoc.exists : Boolean(issueDoc);
  if (!exists) return 0;
  const issue = {
    id: issueDoc.id,
    ...serializeData(issueDoc.data ? issueDoc.data() : issueDoc),
  } as { title?: string; coverImage?: string; publishDate?: string };
  const issueCover = sanitizeImageUrl(issue.coverImage) || '';
  if (!issueCover) return 0;

  const editions = await listReaderEditions(100);
  const matches = editions.filter((edition) => editionRecordsMatch(issue, edition));
  if (matches.length === 0) return 0;

  let syncedCount = 0;
  for (const edition of matches) {
    if (edition.coverImage === issueCover) continue;
    // cover sync is a write; requires Admin SDK. If adminDb missing, skip silently.
    if (!adminDb) break;
    await upsertReaderEdition({
      ...edition,
      coverImage: issueCover,
      pages: (edition.pages || []).map((page) =>
        page.template === 'cover'
          ? {
              ...page,
              content: {
                ...page.content,
                imageUrl: issueCover,
                imageUrls: issueCover ? [issueCover] : page.content.imageUrls || [],
              },
            }
          : page,
      ),
    });
    syncedCount += 1;
  }
  return syncedCount;
}

export async function deleteReaderEdition(id: string): Promise<void> {
  if (!adminDb) throw new Error('Firebase Admin not configured');
  await adminDb.collection(COLLECTION).doc(id).delete();
}
