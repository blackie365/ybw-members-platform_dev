import { adminDb } from '@/lib/firebase-admin';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';
import type { ReaderEdition, ReaderPage } from '../domain/types';
import { editionRecordsMatch } from '../domain/edition-match';

const COLLECTION = 'magazine_reader_editions';
const LEGACY_ISSUES_COLLECTION = 'magazine_issues';
const STRUCTURAL_TEMPLATES = new Set<ReaderPage['template']>([
  'cover',
  'contents',
  'editor-note',
  'back-cover',
]);

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

function isRenderableImageUrl(value: unknown): value is string {
  const url = String(value || '').trim();
  if (!url) return false;
  const lower = url.toLowerCase();
  const looksLikeUrl =
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('gs://') ||
    lower.startsWith('/') ||
    lower.startsWith('./') ||
    lower.startsWith('../') ||
    lower.startsWith('data:');

  if (!looksLikeUrl) return false;
  if (/\.(?:ai|eps|indd|pdf|psd)(?:$|[?#])/i.test(lower)) return false;
  return true;
}

function sanitizeImageUrl(value: unknown): string {
  const url = String(value || '').trim();
  if (!isRenderableImageUrl(url)) return '';
  return fixMagazineImageUrl(url);
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
  const backgroundImage = sanitizeImageUrl(page.content?.backgroundImage);
  const rawImageUrls = sanitizeUrlList(page.content?.imageUrls);
  const imageUrl = sanitizeImageUrl(page.content?.imageUrl) || rawImageUrls[0] || '';
  const imageUrls = rawImageUrls.filter(
    (url) => url !== imageUrl && url !== backgroundImage,
  );
  const standfirst = String(page.content?.standfirst || '').trim();
  const quote = String(page.content?.quote || '').trim();
  const body = dedupeTextParts(
    splitTextIntoParagraphs(page.content?.body),
    [standfirst],
  ).join('\n\n');
  const pullQuotes = dedupeTextParts(page.content?.pullQuotes || [], [
    standfirst,
    quote,
    body,
  ]);

  return {
    ...page,
    content: {
      ...page.content,
      title: String(page.content?.title || '').trim(),
      body,
      standfirst: standfirst || undefined,
      author: String(page.content?.author || '').trim() || undefined,
      name: String(page.content?.name || '').trim() || undefined,
      kicker: String(page.content?.kicker || '').trim() || undefined,
      imageUrl: imageUrl || undefined,
      backgroundImage: backgroundImage || undefined,
      imageUrls,
      quote: quote || undefined,
      pullQuotes,
      continuationLabel: String(page.content?.continuationLabel || '').trim() || undefined,
      snapshotLabel: String(page.content?.snapshotLabel || '').trim() || undefined,
      nextIssue: String(page.content?.nextIssue || '').trim() || undefined,
      ctaLabel: String(page.content?.ctaLabel || '').trim() || undefined,
      ctaHref: String(page.content?.ctaHref || '').trim() || undefined,
      label: String(page.content?.label || '').trim() || undefined,
      videoUrl: String(page.content?.videoUrl || '').trim() || undefined,
      items: Array.isArray(page.content?.items)
        ? page.content.items
            .map((item) => ({
              title: String(item?.title || '').trim(),
              page: String(item?.page || '').trim(),
            }))
            .filter((item) => item.title)
        : [],
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

  const preferLegacy = STRUCTURAL_TEMPLATES.has(base.template);
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

  return sanitizeReaderPage({
    ...base,
    template: preferLegacy ? legacyPage.template || base.template : base.template,
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
      items:
        Array.isArray(base.content.items) && base.content.items.length > 0
          ? base.content.items
          : legacyPage.content.items,
      ctaLabel: base.content.ctaLabel || legacyPage.content.ctaLabel,
      ctaHref: base.content.ctaHref || legacyPage.content.ctaHref,
      label: base.content.label || legacyPage.content.label,
      mediaLayout: base.content.mediaLayout || legacyPage.content.mediaLayout,
      nextIssue: base.content.nextIssue || legacyPage.content.nextIssue,
    },
  });
}

async function hydrateEditionWithLegacyPages(edition: ReaderEdition): Promise<ReaderEdition> {
  const db = adminDb;
  if (!db) return edition;

  const issues = await getMagazineIssuesServer().catch(() => []);
  const matchingIssue = issues.find((issue) => editionMatchesIssue(edition, issue));
  if (!matchingIssue) {
    return {
      ...edition,
      pages: (edition.pages || []).map(sanitizeReaderPage),
      pageCount: Array.isArray(edition.pages) ? edition.pages.length : 0,
    };
  }

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

  const legacyPages = pagesSnapshot.docs
    .map((doc, index) =>
      mapLegacyPageToReaderPage(
        { docId: doc.id, ...serializeData(doc.data()) },
        matchingIssue,
        index,
      ),
    )
    .filter(Boolean) as ReaderPage[];

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
    .sort((left, right) => left.position - right.position);
  const collapsedPages = collapseSplitStoryPages(pages);

  return {
    ...edition,
    coverImage:
      collapsedPages.find((page) => page.template === 'cover')?.content.imageUrl ||
      sanitizeImageUrl(edition.coverImage) ||
      matchingIssue.coverImage ||
      '',
    pages: collapsedPages,
    pageCount: collapsedPages.length,
  };
}

export async function listReaderEditions(limit = 24): Promise<ReaderEdition[]> {
  if (!adminDb) return [];
  const snapshot = await adminDb
    .collection(COLLECTION)
    .orderBy('publishDate', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map(doc => serializeData({ id: doc.id, ...doc.data() }) as ReaderEdition);
}

export async function getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null> {
  if (!adminDb) return null;
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where('slug', '==', slug)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return hydrateEditionWithLegacyPages(serializeData({ id: doc.id, ...doc.data() }) as ReaderEdition);
}

export async function getReaderEditionById(id: string): Promise<ReaderEdition | null> {
  if (!adminDb) return null;
  const doc = await adminDb.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return hydrateEditionWithLegacyPages(serializeData({ id: doc.id, ...doc.data() }) as ReaderEdition);
}

export async function upsertReaderEdition(edition: ReaderEdition): Promise<void> {
  if (!adminDb) throw new Error('Firebase Admin not configured');
  await adminDb.collection(COLLECTION).doc(edition.id).set(edition, { merge: true });
}

export async function syncReaderEditionCoverFromIssue(editionId: string): Promise<ReaderEdition | null> {
  if (!adminDb) return null;

  const editionDoc = await adminDb.collection(COLLECTION).doc(editionId).get();
  if (!editionDoc.exists) return null;
  const edition = serializeData({ id: editionDoc.id, ...editionDoc.data() }) as ReaderEdition;

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
  if (!adminDb) return 0;

  const issueDoc = await adminDb.collection(LEGACY_ISSUES_COLLECTION).doc(issueId).get();
  if (!issueDoc.exists) return 0;
  const issue = {
    id: issueDoc.id,
    ...serializeData(issueDoc.data()),
  } as { title?: string; coverImage?: string; publishDate?: string };
  const issueCover = sanitizeImageUrl(issue.coverImage) || '';
  if (!issueCover) return 0;

  const editions = await listReaderEditions(100);
  const matches = editions.filter((edition) => editionRecordsMatch(issue, edition));
  if (matches.length === 0) return 0;

  let syncedCount = 0;
  for (const edition of matches) {
    if (edition.coverImage === issueCover) continue;
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
