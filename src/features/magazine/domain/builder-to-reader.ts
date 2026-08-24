import slugify from '@sindresorhus/slugify';
import type {
  MagazineIssue,
  MagazinePage,
} from '@/components/admin/magazine-builder/types';
import type {
  ReaderEdition,
  ReaderPage,
  ReaderPageContent,
  ReaderPageTemplate,
} from '@/features/magazine/domain/types';
import {
  CURRENT_READER_SCHEMA_VERSION,
  fixMagazineImageUrl,
  hydrateReaderEditionContents,
  normalizeMagazinePageContent,
} from '@/lib/magazine-utils';

/**
 * Builder PAGE_TYPES.id → ReaderPageTemplate mapping. The builder has a
 * superset of the reader's template union (e.g. "lifestyle", "spotlight",
 * "partner", "column", "full-page-ad"). Anything the reader does not have a
 * dedicated renderer for gets collapsed into the closest match so
 * MagazineShell always has a renderer key it recognises.
 */
export function extractPrintPageNumberFromBuilderPage(
  page: MagazinePage | any | null | undefined,
): number | null {
  if (!page) return null;
  if (typeof page.pageNumber === 'number' && Number.isFinite(page.pageNumber) && page.pageNumber > 0) {
    return page.pageNumber;
  }
  const contentPos = Number(page?.content?.position || page?.content?.pageNumber || 0);
  if (Number.isFinite(contentPos) && contentPos > 0) return contentPos;
  const idStr = String(page?.sourceRef || page?.id || '');
  let m = idStr.match(/^page[-_](\d+)[-_]/);
  if (m) return Number(m[1]);
  const numericId = typeof page.id === 'number' ? page.id : Number(page.id || 0);
  if (Number.isFinite(numericId) && numericId > 0 && numericId < 10_000) return numericId;
  const pos = typeof page.position === 'number' ? page.position : Number(page.position || 0);
  if (Number.isFinite(pos) && pos > 0) return pos;
  return null;
}

export const BUILDER_TYPE_TO_READER_TEMPLATE: Record<string, ReaderPageTemplate> = {
  cover: 'cover',
  editorial: 'editor-note',
  contents: 'contents',
  'feature-full': 'feature-full',
  'feature-left': 'feature-left',
  'feature-right': 'feature-right',
  column: 'feature-full',
  lifestyle: 'feature-full',
  spotlight: 'feature-full',
  partner: 'feature-full',
  'full-page-ad': 'ad',
  'back-cover': 'back-cover',
  ad: 'ad',
};

function resolveImageForPage(content: Record<string, unknown>): string {
  const candidates: unknown[] = [
    content.imageUrl,
    content.coverImage,
    content.heroImage,
    content.featureImage,
    content.mainImage,
    content.image,
    content.photo,
    content.headshot,
    content.portrait,
    Array.isArray(content.imageUrls) ? content.imageUrls[0] : undefined,
    Array.isArray(content.images) ? content.images[0] : undefined,
    Array.isArray(content.gallery) ? content.gallery[0] : undefined,
    Array.isArray(content.additionalImages) ? content.additionalImages[0] : undefined,
    content.backgroundImage,
  ];
  for (const raw of candidates) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (s.length > 0) return fixMagazineImageUrl(s);
  }
  return '';
}

function resolveAllImages(content: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const rawArrays: unknown[] = [
    content.imageUrls,
    content.images,
    content.gallery,
    content.additionalImages,
  ];
  for (const arr of rawArrays) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const s = typeof entry === 'string' ? fixMagazineImageUrl(entry) : '';
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  const single = resolveImageForPage(content);
  if (single && !seen.has(single)) {
    seen.add(single);
    out.unshift(single);
  }
  return out;
}

export function deriveIssueSlug(input: {
  id?: string;
  title?: string;
  ghostSyncTag?: string;
  readerEditionSlug?: string;
  slug?: string;
}): string {
  const explicit = String(input.slug || '').trim();
  if (explicit) return explicit.toLowerCase();
  const legacy = String(input.readerEditionSlug || '').trim();
  if (legacy) return legacy.toLowerCase();
  const tag = String(input.ghostSyncTag || '').trim();
  if (tag) return slugify(tag).toLowerCase();
  const title = String(input.title || '').trim();
  if (title) return slugify(title).toLowerCase();
  const id = String(input.id || '').trim();
  if (id) return slugify(id).toLowerCase();
  return `issue-${Date.now().toString(36)}`;
}

/**
 * Convert a builder MagazineIssue (plus its pages sub-collection loaded into
 * an array of MagazinePage with docId fields) into the ReaderEdition shape
 * that MagazineShell consumes.
 *
 * This is the single bridge that makes "builder save → immediately visible in
 * reader" work. The reader route now calls this on the builder document
 * instead of reading the legacy magazine_reader_editions collection.
 *
 * Page order is the canonical array index of `pages[]` (sorted by
 * MagazinePage.id ascending, which matches getMagazinePagesAction's
 * `.orderBy('id', 'asc')`). Print page numbers are extracted from id strings
 * using the same page-7-title → 7 algorithm as buildReaderContentsItemsFromPages.
 */
export function mapBuilderIssueToReaderEdition(
  issue: MagazineIssue & {
    schemaVersion?: number;
    readerEditionSlug?: string;
    slug?: string;
  },
  builderPages: MagazinePage[],
): ReaderEdition & { schemaVersion: number } {
  const sorted = [...builderPages].sort((a, b) => {
    const la = typeof a.id === 'number' ? a.id : Number(a.id || 0);
    const lb = typeof b.id === 'number' ? b.id : Number(b.id || 0);
    if (Number.isFinite(la) && Number.isFinite(lb) && la !== lb) return la - lb;
    return 0;
  });

  const pagePrintNumberFrom = (page: MagazinePage, idx: number): number => {
    if (typeof (page as any).pageNumber === 'number' && Number.isFinite((page as any).pageNumber)) {
      return (page as any).pageNumber;
    }
    const idStr = String(page.sourceRef || page.id || '');
    let m = idStr.match(/^page[-_](\d+)[-_]/);
    if (m) return Number(m[1]);
    m = idStr.match(/[-_](\d+)[-_]?[^-_]*$/);
    if (m) return Number(m[1]);
    const numeric = typeof page.id === 'number' ? page.id : Number(page.id || 0);
    if (Number.isFinite(numeric) && numeric > 0 && numeric < 10_000) return numeric;
    return idx + 1;
  };

  const pages: ReaderPage[] = sorted.map((builderPage, idx): ReaderPage => {
    const template =
      BUILDER_TYPE_TO_READER_TEMPLATE[String(builderPage.type || '').trim().toLowerCase()] ||
      'feature-full';
    const rawContent: Record<string, unknown> =
      builderPage.content && typeof builderPage.content === 'object'
        ? { ...(builderPage.content as Record<string, unknown>) }
        : {};
    const normalized = normalizeMagazinePageContent(rawContent) as Record<string, unknown>;

    const title = String(
      normalized.title ||
        normalized.headline ||
        normalized.name ||
        normalized.brand ||
        (builderPage.type === 'cover' ? issue.title : '') ||
        '',
    ).trim();

    const body = String(
      normalized.body ||
        normalized.text ||
        normalized.article ||
        normalized.storyText ||
        '',
    ).trim();
    const standfirst = String(
      normalized.standfirst ||
        normalized.intro ||
        normalized.subtitle ||
        normalized.description ||
        normalized.kicker ||
        '',
    ).trim();

    const hero = resolveImageForPage(normalized);
    const gallery = resolveAllImages(normalized);
    const backgroundImage = fixMagazineImageUrl(String(normalized.backgroundImage || ''));
    const logoImage = fixMagazineImageUrl(
      String(normalized.logoImage || normalized.logo || normalized.partnerLogo || ''),
    );
    const pdfUrlRaw = String(normalized.pdfUrl || '').trim();
    const pdfUrl = pdfUrlRaw ? fixMagazineImageUrl(pdfUrlRaw) : undefined;

    const position = idx + 1;
    const printNumber = pagePrintNumberFrom(builderPage, idx);

    const baseContent: ReaderPageContent = {
      title,
      body,
      text: body,
      standfirst,
      intro: standfirst,
      author: String(normalized.author || normalized.byline || '').trim() || undefined,
      name: String(normalized.name || '').trim() || undefined,
      kicker: String(normalized.kicker || '').trim() || undefined,
      quote: String(normalized.quote || '').trim() || undefined,
      pullQuotes: Array.isArray(normalized.pullQuotes)
        ? normalized.pullQuotes.map((q: unknown) => String(q || '').trim()).filter(Boolean)
        : undefined,
      imageUrl: hero,
      imageUrls: gallery,
      image: hero,
      featureImage: hero,
      heroImage: hero,
      mainImage: hero,
      coverImage: hero,
      photo: hero,
      headshot: hero,
      portrait: hero,
      images: gallery,
      gallery,
      additionalImages: gallery,
      backgroundImage,
      logoImage,
      logoImages: Array.isArray(normalized.logoImages)
        ? normalized.logoImages.map((l: unknown) => fixMagazineImageUrl(String(l || ''))).filter(Boolean)
        : logoImage
          ? [logoImage]
          : undefined,
      partnerLogo: fixMagazineImageUrl(String(normalized.partnerLogo || logoImage || '')) || undefined,
      pdfUrl,
      ctaLabel: String(normalized.ctaLabel || '').trim() || undefined,
      ctaHref: String(normalized.ctaHref || '').trim() || undefined,
      label: String(normalized.label || '').trim() || undefined,
      mediaLayout: String(normalized.mediaLayout || '').trim() || undefined,
      items: Array.isArray(normalized.items) ? (normalized.items as Array<{ title: string; page: string }>) : undefined,
    };

    const id = String(builderPage.sourceRef || builderPage.docId || `page-${position}`);
    return {
      id,
      position,
      template,
      content: {
        ...baseContent,
        pageNumber: printNumber,
      } as ReaderPageContent,
    };
  });

  const slug = deriveIssueSlug({
    id: issue.id,
    title: issue.title,
    ghostSyncTag: issue.ghostSyncTag,
    readerEditionSlug: (issue as any).readerEditionSlug,
    slug: issue.slug,
  });

  const coverImageFromPages = pages.find((p) => p.template === 'cover')?.content.imageUrl || '';
  const coverImage =
    fixMagazineImageUrl(coverImageFromPages) ||
    fixMagazineImageUrl(String(issue.coverImage || ''));

  const edition: ReaderEdition & { schemaVersion: number } = {
    id: String(issue.id),
    slug,
    title: String(issue.title || '').trim(),
    description: String(issue.description || '').trim(),
    coverImage,
    publishDate: String(issue.publishDate || new Date().toISOString()),
    pageCount: pages.length,
    pages,
    createdAt: String((issue as any).createdAt || new Date().toISOString()),
    issueId: issue.id,
    schemaVersion: CURRENT_READER_SCHEMA_VERSION,
  };

  const hydrated = hydrateReaderEditionContents(edition);
  return (hydrated as (ReaderEdition & { schemaVersion: number }) | null) ?? edition;
}
