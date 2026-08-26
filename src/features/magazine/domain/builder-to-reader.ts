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
  isPlaceholderImageUrl,
  filterNonPlaceholderUrls,
  firstNonPlaceholderImage,
  normalizeMagazinePageContent,
} from '@/lib/magazine-utils';

/**
 * Builder PAGE_TYPES.id → ReaderPageTemplate mapping. The builder has a
 * superset of the reader's template union (e.g. "lifestyle", "spotlight",
 * "partner", "column", "full-page-ad"). Anything the reader does not have a
 * dedicated renderer for gets collapsed into the closest match so
 * MagazineShell always has a renderer key it recognises.
 */
/**
 * Extract a sortable print page number from a builder MagazinePage.
 *
 * SORT AUTHORITATIVE KEY = `page.position` (simple integer, 1-based).
 * Everything after that is a BACKWARDS-COMPAT FALLBACK for pre-cleanup
 * legacy Firestore pages where `position` might be 0 / undefined / never
 * set. The goal: once a user drags any page to reorder, persistPageOrder
 * will write `position` to every row and this cascade stops being hit.
 */
export function extractPrintPageNumberFromBuilderPage(
  page: MagazinePage | any | null | undefined,
): number | null {
  if (!page) return null;
  const pos = typeof page.position === 'number' ? page.position : Number(page.position || 0);
  if (Number.isFinite(pos) && pos > 0) return pos;
  if (typeof page.pageNumber === 'number' && Number.isFinite(page.pageNumber) && page.pageNumber > 0) {
    return page.pageNumber;
  }
  const contentPos = Number(page?.content?.pageNumber || page?.content?.position || 0);
  if (Number.isFinite(contentPos) && contentPos > 0) return contentPos;
  const idStr = String(page?.sourceRef || page?.id || '');
  let m = idStr.match(/^page[-_](\d+)[-_]/);
  if (m) return Number(m[1]);
  const numericId = typeof page.id === 'number' ? page.id : Number(page.id || 0);
  if (Number.isFinite(numericId) && numericId > 0 && numericId < 10_000) return numericId;
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
  const coerced = candidates.map((raw) => {
    const s = typeof raw === 'string' ? raw.trim() : typeof raw && typeof raw === 'object'
      ? String((raw as any)?.src || (raw as any)?.url || (raw as any)?.image || '').trim()
      : '';
    return s;
  });
  const first = firstNonPlaceholderImage(coerced);
  if (first) return fixMagazineImageUrl(first);
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
  const coerceOne = (entry: unknown): string => {
    if (typeof entry === 'string') return fixMagazineImageUrl(entry);
    if (entry && typeof entry === 'object') {
      const raw = String((entry as any)?.src || (entry as any)?.url || (entry as any)?.image || '').trim();
      return raw ? fixMagazineImageUrl(raw) : '';
    }
    return '';
  };
  for (const arr of rawArrays) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const s = coerceOne(entry);
      if (!s || seen.has(s) || isPlaceholderImageUrl(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  const single = resolveImageForPage(content);
  if (single && !seen.has(single)) {
    seen.add(single);
    out.unshift(single);
  }
  return filterNonPlaceholderUrls(out);
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
      items: Array.isArray(normalized.items)
        ? (normalized.items as Array<Record<string, unknown>>)
            .map((raw: Record<string, unknown>) => ({
              title: String(raw.title || '').trim(),
              page: String(raw.page ?? '').trim(),
            }))
            .filter((it) => it.title.length > 0 && it.page.length > 0)
        : [],
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

export const IDML_PAGINATION_THRESHOLD = 15;

export type MergePagesMode = 'builder' | 'reader';

export interface MergedPageAnnotations {
  _shadowDocId?: string;
  _legacyDocId?: string;
  readOnly?: boolean;
}

/**
 * ONE CANONICAL MERGE between IDML-imported shadow pages (reader edition) and
 * editable Builder legacy Firestore pages. Used by BOTH:
 *   - The Spread Builder client page (mode = 'builder') — annotates rows with
 *     _shadowDocId / _legacyDocId so PageList handlers know the delete path,
 *     and marks IDML-only rows readOnly.
 *   - The server ReaderEdition hydration (mode = 'reader') — pure, no
 *     synthetic annotations, used for render.
 *
 * Merge rules (same for both modes, no drift between builder list and reader):
 *
 *   1. Enumerate every print-number key present in EITHER set.
 *        printNumber comes from extractPrintPageNumberFromBuilderPage (which
 *        uses page.position as the new top-level sort authority with legacy
 *        fallbacks). See that function for cascade definition.
 *
 *   2. For keys where BOTH shadow + legacy exist:
 *        a. If legacy pages came from Sync ReaderEdition → Builder (fresh
 *           sourceReaderEditionId match), push the LEGACY page — editable
 *           copies own the slot after Sync.
 *        b. If legacy is an old manual import clobbering a larger IDML
 *           edition (no source stamp, inside shadow print range), prefer
 *           the SHADOW / IDML to preserve the original layout.
 *        c. Otherwise push the COMBINED page: legacy edits override base
 *           content where defined, with _shadowDocId / _legacyDocId markers
 *           in builder mode so individual row handlers can route delete.
 *
 *   3. For keys where ONLY legacy exists → push legacy with annotations.
 *
 *   4. For keys where ONLY shadow exists → push shadow (IDML, readOnly in
 *      builder mode).
 *
 *   5. ORPHAN CATCH-ALL (keys not matched by print number):
 *        a. For IDML-dominant imports (shadowCount >= IDML_PAGINATION_THRESHOLD
 *           = 15 pages): do NOT append orphan shadow rows, and for legacy
 *           pages do NOT append orphan builder rows. IDML is the source of
 *           truth for pagination in these editions, unmatched rows are
 *           stale/abandoned Firestore noise from prior builder work.
 *        b. For small builder-only editions (< 15 shadow pages, likely no
 *           IDML import): append unmatched legacy pages but only if they
 *           carry real content (title ≥ 2 chars OR body ≥ 40 chars OR any
 *           image) to filter blank scaffold tests.
 *
 * Outputs a fresh-sorted array by printNumber / position, no duplicates.
 */
export function mergeDisplayedPages(
  inputShadowPages: MagazinePage[] | null | undefined,
  inputLegacyPages: MagazinePage[] | null | undefined,
  mode: MergePagesMode,
): MagazinePage[] {
  const shadowPages = Array.isArray(inputShadowPages) ? inputShadowPages : [];
  const legacyPages = Array.isArray(inputLegacyPages) ? inputLegacyPages : [];

  if (shadowPages.length === 0) {
    return [...legacyPages].sort((a, b) => {
      const la = extractPrintPageNumberFromBuilderPage(a) ?? (Number((a as any).id || 0) || 0);
      const lb = extractPrintPageNumberFromBuilderPage(b) ?? (Number((b as any).id || 0) || 0);
      return la - lb;
    });
  }

  const legacyByPrint = new Map<number, MagazinePage>();
  for (const lp of legacyPages) {
    const pn = extractPrintPageNumberFromBuilderPage(lp);
    if (pn && pn > 0) legacyByPrint.set(pn, lp);
  }
  const shadowByPrint = new Map<number, MagazinePage>();
  for (const sp of shadowPages) {
    const pn = extractPrintPageNumberFromBuilderPage(sp);
    if (pn && pn > 0) shadowByPrint.set(pn, sp);
  }
  const allPrintNumbers = new Set<number>([
    ...legacyByPrint.keys(),
    ...shadowByPrint.keys(),
  ]);

  const maxShadowPrint = shadowByPrint.size > 0 ? Math.max(...shadowByPrint.keys()) : 0;
  const shadowReaderEditionsPresent = shadowPages.length > 0;
  const isIdmlPublished = shadowPages.length >= IDML_PAGINATION_THRESHOLD;
  const sharedSourceStamp = String(
    (shadowPages[0] as any)?.sourceReaderEditionId || '',
  ).trim();

  const merged: MagazinePage[] = [];

  const identityOf = (p: any): string => String((p as any).docId ?? (p as any).id ?? '');
  const applyBuilderAnnotations = (out: MagazinePage, opts: {
    shadowDocId?: string;
    legacyDocId?: string;
    forceEditableLegacy?: boolean;
  }): MagazinePage => {
    if (mode !== 'builder') return out;
    const any = out as MagazinePage & MergedPageAnnotations;
    any._shadowDocId = opts.shadowDocId ?? '';
    any._legacyDocId = opts.legacyDocId ?? '';
    if (opts.forceEditableLegacy && (any as any).readOnly === true) {
      (any as any).readOnly = false;
    }
    return out;
  };

  for (const printNum of Array.from(allPrintNumbers).sort((a, b) => a - b)) {
    const legacy = legacyByPrint.get(printNum);
    const shadow = shadowByPrint.get(printNum);
    if (legacy && shadow) {
      const legacyIsFresh =
        typeof (legacy as any).sourceReaderEditionId === 'string' &&
        sharedSourceStamp !== '' &&
        (legacy as any).sourceReaderEditionId === sharedSourceStamp;
      const legacyIsSmallerImportClobberingLarger =
        shadowReaderEditionsPresent &&
        maxShadowPrint > printNum &&
        legacy &&
        !(legacy as any).sourceReaderEditionId &&
        !(legacy as any).generatedFromStoryLibrary;
      if (legacyIsSmallerImportClobberingLarger) {
        merged.push(applyBuilderAnnotations(shadow, { shadowDocId: identityOf(shadow), legacyDocId: '' }));
      } else if (legacyIsFresh) {
        merged.push(applyBuilderAnnotations(legacy, { shadowDocId: '', legacyDocId: identityOf(legacy), forceEditableLegacy: true }));
      } else {
        const combined: MagazinePage = { ...shadow, ...legacy };
        if (mode === 'builder') {
          if (typeof (legacy as any).readOnly === 'boolean' && !(legacy as any).readOnly) {
            (combined as any).readOnly = false;
          }
        }
        applyBuilderAnnotations(combined, {
          shadowDocId: identityOf(shadow),
          legacyDocId: identityOf(legacy),
        });
        // Prefer legacy docId for firestore edits:
        const legId = identityOf(legacy);
        const shdId = identityOf(shadow);
        (combined as any).docId = legId || shdId;
        (combined as any).id = (legacy as any).id ?? (shadow as any).id ?? (combined as any).id;
        merged.push(combined);
      }
    } else if (legacy) {
      merged.push(applyBuilderAnnotations(legacy, { legacyDocId: identityOf(legacy), shadowDocId: '', forceEditableLegacy: true }));
    } else if (shadow) {
      merged.push(applyBuilderAnnotations(shadow, { legacyDocId: '', shadowDocId: identityOf(shadow) }));
    }
  }

  const seenDocIds = new Set<string>();
  for (const p of merged) {
    const key = identityOf(p);
    if (key) seenDocIds.add(key);
  }

  if (!isIdmlPublished) {
    for (const lp of legacyPages) {
      const key = identityOf(lp);
      if (key && seenDocIds.has(key)) continue;
      const title = String((lp as any).content?.title || '').trim();
      const body = String((lp as any).content?.body || (lp as any).content?.text || '').trim();
      const hasImage = Boolean(
        (lp as any).content?.imageUrl ||
        (lp as any).content?.backgroundImage ||
        ((lp as any).content?.imageUrls || []).length > 0,
      );
      if (!(title.length >= 2 || body.length >= 40 || hasImage)) continue;
      merged.push(applyBuilderAnnotations(lp, { legacyDocId: key, shadowDocId: '', forceEditableLegacy: true }));
      if (key) seenDocIds.add(key);
    }
  }

  return merged.sort((a, b) => {
    const la = extractPrintPageNumberFromBuilderPage(a) ?? (Number((a as any).id ?? (a as any).position ?? 0) || 0);
    const lb = extractPrintPageNumberFromBuilderPage(b) ?? (Number((b as any).id ?? (b as any).position ?? 0) || 0);
    if (la !== lb) return la - lb;
    const aIdx = shadowPages.findIndex(p => identityOf(p) === identityOf(a));
    const bIdx = shadowPages.findIndex(p => identityOf(p) === identityOf(b));
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    return 0;
  });
}
