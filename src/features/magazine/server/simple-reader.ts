import { adminDb } from '@/lib/firebase-admin';
import { db as clientFirestoreDb } from '@/lib/firebase';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';
import { fixMagazineImageUrl, normalizeImageUrl } from '@/lib/magazine-utils';
import type { ReaderEdition, ReaderPage } from '../domain/types';
import { editionRecordsMatch } from '../domain/edition-match';

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

function collapseSplitStoryPages(pages: ReaderPage[]): ReaderPage[] {
  const collapsed: ReaderPage[] = [];

  for (const rawPage of pages) {
    const page = sanitizeReaderPage(rawPage);
    const previousPage = collapsed[collapsed.length - 1];
    const pageTitle = normalizeText(page.content?.continuationLabel || page.content?.title);
    const previousTitle = normalizeText(
      previousPage?.content?.continuationLabel || previousPage?.content?.title,
    );
    const shouldMergeWithPrevious =
      Boolean(pageTitle) &&
      pageTitle === previousTitle &&
      isStoryPage(page) &&
      isStoryPage(previousPage) &&
      (Boolean(page.content?.isContinuation) || Boolean(previousPage?.content?.isContinuation));

    if (!shouldMergeWithPrevious || !previousPage) {
      collapsed.push({
        ...page,
        content: {
          ...page.content,
          isContinuation: false,
          continuationLabel: undefined,
        },
      });
      continue;
    }

    const previousImageUrls = sanitizeUrlList(previousPage.content.imageUrls);
    const mergedImageUrl = previousPage.content.imageUrl || page.content.imageUrl || '';
    const mergedBackgroundImage =
      previousPage.content.backgroundImage || page.content.backgroundImage || '';
    const mergedImageUrls = [
      ...previousImageUrls,
      ...(previousPage.content.imageUrl ? [previousPage.content.imageUrl] : []),
      ...(page.content.imageUrl ? [page.content.imageUrl] : []),
      ...sanitizeUrlList(page.content.imageUrls),
    ].filter(
      (url, index, all) =>
        url &&
        url !== mergedImageUrl &&
        url !== mergedBackgroundImage &&
        all.indexOf(url) === index,
    );

    collapsed[collapsed.length - 1] = sanitizeReaderPage({
      ...previousPage,
      content: {
        ...previousPage.content,
        body: joinBodyText(previousPage.content.body, page.content.body),
        standfirst: previousPage.content.standfirst || page.content.standfirst,
        imageUrl: mergedImageUrl || undefined,
        backgroundImage: mergedBackgroundImage || undefined,
        imageUrls: mergedImageUrls,
        videoUrl: previousPage.content.videoUrl || page.content.videoUrl,
        quote: previousPage.content.quote || page.content.quote,
        pullQuotes: [
          ...(previousPage.content.pullQuotes || []),
          ...(page.content.pullQuotes || []),
        ].filter((quote, index, all) => quote && all.indexOf(quote) === index),
        items:
          Array.isArray(previousPage.content.items) && previousPage.content.items.length > 0
            ? previousPage.content.items
            : page.content.items,
        mediaLayout:
          previousPage.content.mediaLayout === 'background'
            ? previousPage.content.mediaLayout
            : previousPage.content.mediaLayout || page.content.mediaLayout,
        isContinuation: false,
        continuationLabel: undefined,
      },
    });
  }

  return collapsed.map((page, index) => ({
    ...page,
    position: index + 1,
    content: {
      ...page.content,
      isContinuation: false,
      continuationLabel: undefined,
    },
  }));
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

  // Structural templates (cover/contents/editor-note/back-cover) are PINNED to
  // their original base template. Even if a legacy page had a corrupted template
  // field (e.g. editor-note stored with type=contents due to a prior build bug),
  // we keep the base structural template so the correct renderer always runs.
  const isStructural = STRUCTURAL_TEMPLATES.has(base.template);
  const preferLegacy = isStructural;
  const pinnedTemplate: ReaderPage['template'] = isStructural
    ? STRUCTURAL_TEMPLATE_PINNED[base.template as keyof typeof STRUCTURAL_TEMPLATE_PINNED] ?? base.template
    : base.template;
  const baseImages = sanitizeUrlList(base.content.imageUrls);
  const legacyImages = sanitizeUrlList(legacyPage.content.imageUrls);
  const imageUrl = preferLegacy
    ? legacyPage.content.imageUrl || base.content.imageUrl || ''
    : base.content.imageUrl || legacyPage.content.imageUrl || '';
  const backgroundImage = preferLegacy
    ? legacyPage.content.backgroundImage || base.content.backgroundImage || ''
    : base.content.backgroundImage || legacyPage.content.backgroundImage || '';
  const imageUrls = [...baseImages, ...legacyImages].filter(
    (url, index, all) => url !== imageUrl && url !== backgroundImage && all.indexOf(url) === index,
  );

  // Contents items (the grid of cards with categories + page numbers) ONLY
  // belong on the `contents` template. Never let them bleed into other
  // templates — that produces the "rik-rak of contents pages" symptom on the
  // Editorial or Cover pages.
  const baseHasItems = Array.isArray(base.content.items) && base.content.items.length > 0;
  const mergedItems = baseHasItems
    ? base.content.items
    : (pinnedTemplate === 'contents' ? (legacyPage.content.items ?? []) : []);

  return sanitizeReaderPage({
    ...base,
    template: isStructural
      ? pinnedTemplate
      : (preferLegacy ? legacyPage.template || base.template : base.template),
    content: {
      ...base.content,
      title: preferLegacy
        ? legacyPage.content.title || base.content.title
        : base.content.title || legacyPage.content.title,
      body: preferLegacy
        ? legacyPage.content.body || base.content.body
        : base.content.body || legacyPage.content.body,
      standfirst: preferLegacy
        ? legacyPage.content.standfirst || base.content.standfirst
        : base.content.standfirst || legacyPage.content.standfirst,
      author: base.content.author || legacyPage.content.author,
      name: base.content.name || legacyPage.content.name,
      kicker: preferLegacy
        ? legacyPage.content.kicker || base.content.kicker
        : base.content.kicker || legacyPage.content.kicker,
      imageUrl: imageUrl || undefined,
      backgroundImage: backgroundImage || undefined,
      imageUrls,
      videoUrl: base.content.videoUrl || legacyPage.content.videoUrl,
      quote: base.content.quote || legacyPage.content.quote,
      pullQuotes: [...(base.content.pullQuotes || []), ...(legacyPage.content.pullQuotes || [])].filter(
        (quote, index, all) => quote && all.indexOf(quote) === index,
      ),
      items: mergedItems,
      ctaLabel: base.content.ctaLabel || legacyPage.content.ctaLabel,
      ctaHref: base.content.ctaHref || legacyPage.content.ctaHref,
      label: base.content.label || legacyPage.content.label,
      mediaLayout: base.content.mediaLayout || legacyPage.content.mediaLayout,
      nextIssue: base.content.nextIssue || legacyPage.content.nextIssue,
    },
  });
}

async function hydrateEditionWithLegacyPages(edition: ReaderEdition): Promise<ReaderEdition> {
  const db = getFirestore();
  if (!db) {
    return {
      ...edition,
      pages: (edition.pages || []).map(sanitizeReaderPage),
      pageCount: Array.isArray(edition.pages) ? edition.pages.length : 0,
      coverImage: sanitizeImageUrl(edition.coverImage) || '',
    };
  }

  const issues = await getMagazineIssuesServer().catch(() => []);
  const matchingIssue = issues.find((issue) => editionMatchesIssue(edition, issue)) ?? null;
  const issueCover = matchingIssue ? sanitizeImageUrl(matchingIssue.coverImage) || '' : '';
  let legacyPages: ReaderPage[] = [];
  if (matchingIssue) {
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

  const mergedPages = (edition.pages || []).map((page) =>
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

  const pages = [...mergedPages, ...appendedLegacyPages]
    .map(sanitizeReaderPage)
    .map((page) => {
      // FINAL READ-SIDE DEFENSE: Never let a page that reads like an
      // Editor's Note (title / body contain "Editor's Note" / "From the
      // Editor" / "Editorial") be rendered as template=contents, even if
      // a legacy publish bug (pre-2026-08-14) wrote that template field
      // into the ReaderEdition pages[] doc. This is the user-reported
      // issue for `ybw_August_2026.idml pages-5-5` (storyId
      // ...library-idml-editorial-5) which showed the rik-rak Contents
      // grid instead of PageEditorial.
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
      // Canonical structural role order before position sort. This
      // guarantees Cover → Contents → Editor's Note → Articles → Back
      // Cover regardless of whether legacy pages had position=0 for all
      // structural pages or conflicting numeric pageNumber values due
      // to prior build bugs.
      const ROLE: Record<string, number> = {
        cover: 0,
        contents: 1,
        'editor-note': 2,
        'feature-left': 10,
        'feature-right': 11,
        ad: 20,
        'full-page-ad': 20,
        'back-cover': 99,
      };
      const lRole = ROLE[String(left.template || '').trim().toLowerCase()] ?? 100;
      const rRole = ROLE[String(right.template || '').trim().toLowerCase()] ?? 100;
      if (lRole !== rRole) return lRole - rRole;
      const lPos = typeof left.position === 'number' ? left.position : 0;
      const rPos = typeof right.position === 'number' ? right.position : 0;
      return lPos - rPos;
    });
  const collapsedPages = collapseSplitStoryPages(pages);

  return {
    ...edition,
    coverImage:
      collapsedPages.find((page) => page.template === 'cover')?.content.imageUrl ||
      sanitizeImageUrl(edition.coverImage) ||
      issueCover ||
      '',
    pages: collapsedPages,
    pageCount: collapsedPages.length,
  };
}

export async function listReaderEditions(limit = 24): Promise<ReaderEdition[]> {
  const firestore = getFirestore();
  if (!firestore) return [];
  const snapshot = await firestore
    .collection(COLLECTION)
    .orderBy('publishDate', 'desc')
    .limit(limit)
    .get();
  const docs = snapshot?.docs ?? [];
  return Promise.all(docs.map(async (doc: any) =>
    hydrateEditionWithLegacyPages(serializeData({ id: doc.id, ...(doc.data ? doc.data() : doc) }) as ReaderEdition),
  ));
}

export async function getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null> {
  const firestore = getFirestore();
  if (!firestore) return null;
  const snapshot = await firestore
    .collection(COLLECTION)
    .where('slug', '==', slug)
    .limit(1)
    .get();
  const docs = snapshot?.docs ?? [];
  if (docs.length === 0) return null;
  const doc = docs[0];
  return hydrateEditionWithLegacyPages(serializeData({ id: doc.id, ...(doc.data ? doc.data() : doc) }) as ReaderEdition);
}

export async function getReaderEditionIdBySlug(slug: string): Promise<string | null> {
  const firestore = getFirestore();
  if (!firestore) return null;
  const snapshot = await firestore
    .collection(COLLECTION)
    .where('slug', '==', slug)
    .limit(1)
    .get();
  const docs = snapshot?.docs ?? [];
  return docs.length === 0 ? null : docs[0].id;
}

export async function getReaderEditionById(id: string): Promise<ReaderEdition | null> {
  const firestore = getFirestore();
  if (!firestore) return null;
  const doc = await firestore.collection(COLLECTION).doc(id).get();
  const exists = typeof doc?.exists === 'boolean' ? doc.exists : Boolean(doc);
  if (!exists) return null;
  return hydrateEditionWithLegacyPages(serializeData({ id, ...(doc.data ? doc.data() : doc) }) as ReaderEdition);
}

export async function upsertReaderEdition(edition: ReaderEdition): Promise<void> {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firebase not configured for server writes');
  await firestore.collection(COLLECTION).doc(edition.id).set(edition, { merge: true });
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
