import type {
  ReaderPage,
  ReaderPageTemplate,
  ReaderPageContent,
} from "@/features/magazine/domain/types";
import type { ParsedIdmlPage, ParsedIdmlStory } from "./idml-parser";

function countWords(text: string | null | undefined): number {
  const clean = String(text || "").trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export interface Article {
  title: string;
  author: string;
  body: string;
  images: string[];
  startPage: number;
  endPage: number;
  pagePositions: Array<{ page: number; position: "left" | "right" | "full" }>;
  pageBodies: Record<number, string>;
  // If the article was derived from user-supplied frame-namespace tags
  // (article:<slug>:role.idx) on frames, this is the slug. Otherwise "".
  // Used downstream for slug-bucketed hero/gallery image selection.
  slug: string;
  // Per-page role-bucketed image pools derived from namespace tags (or empty).
  // Keys: hero/gallery/logo/pdf. Values: unique ordered filenames.
  roleImages: Record<number, Record<"hero" | "gallery" | "logo" | "pdf", string[]>>;
}

type OrderedPageStoryEntry = {
  frame: ParsedIdmlPage["frames"][number];
  story: ParsedIdmlStory;
};

function detectTitleFrame(
  story: ParsedIdmlStory | undefined,
  frameIndex: number,
): boolean {
  if (!story) return false;

  const text = (story.text || "").trim();
  if (!text) return false;
  if (/^\<\?ace/i.test(text)) return false;
  if (/^yorkshire\s*business\s*woman$/i.test(text.replace(/\s+/g, " "))) return false;
  if (/^yorkshirebusinesswoman$/i.test(text.replace(/\s+/g, ""))) return false;

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 20) return false;

  const hasTitleStyle = story.paragraphStyles.some((s) =>
    /article.?heading|cover.?title|headline/i.test(s),
  );

  if (hasTitleStyle) return true;
  return frameIndex === 0 && wordCount <= 12;
}

function shouldIgnoreDecorativeStory(story: ParsedIdmlStory | undefined): boolean {
  const text = String(story?.title || story?.text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return true;
  if (/^\<\?ace/i.test(text)) return true;
  if (/^yorkshire\s*business\s*woman$/i.test(text)) return true;
  if (/^yorkshirebusinesswoman$/i.test(text.replace(/\s+/g, ""))) return true;
  if (/^(contents|disclosure|bookcase|member profile)$/i.test(text)) return true;
  if (/^digital copy available/i.test(text)) return true;
  if (/^grow your business with yorkshire businesswoman/i.test(text)) return true;
  return false;
}

/**
 * True when a page should be rendered as a full-page ad (full-page-ad)
 * instead of a 2-column article feature.
 *
 * Priority order (HIGHEST → lowest):
 *   1. EXPLICIT USER LABEL: if ANY frame on the page has InDesign
 *      Script Label = "AdFrame" (case-insensitive; "Ad Frame", "adframe",
 *      "ad_frame", "ad" all match) → AD. 100% trust user. TitleFrame and
 *      BodyFrame text frames ON THE SAME PAGE do NOT cancel this out. They
 *      are common (ad slogan, sponsor caption).
 *   2. NEGATIVE OVERRIDES (early escape, never an ad): EditorsFrame /
 *      ContentsFrame on the page (special reserved templates), OR the page
 *      is clearly a multi-paragraph article (>= 120 words of body copy
 *      across page stories) → NOT AN AD. This stops continuation pages of
 *      long articles (which often have no TitleFrame frame on them) from
 *      being misclassified as ads via heuristic below.
 *   3. FALLBACK HEURISTIC (only if no explicit label, no negative override):
 *      page has >= 1 graphic frame placed, and NO story on the page looks
 *      like an article (no explicit TitleFrame-labeled frame AND every
 *      story on the page is < 30 words — e.g. one line "Advertisement" or
 *      a brand tagline with 6 words) → AD.
 */
export function detectAdPage(page: ParsedIdmlPage): boolean {
  // --- 0) Empty page = ad / blank placeholder ---
  if (page.frames.length === 0 && page.stories.length === 0) return true;

  const labelSet = new Set(
    page.labels.map((l) =>
      String(l || "")
        .trim()
        .replace(/[\s._-]+/g, "")
        .toLowerCase(),
    ),
  );
  const anyLabelMatches = (predicate: (n: string) => boolean): boolean =>
    Array.from(labelSet).some(predicate);

  // --- 1) EXPLICIT USER LABEL WINS. Always. ---
  // (matches: "AdFrame", "adframe", "Ad Frame", "ad_frame", "ad", "advert")
  if (
    labelSet.has("adframe") ||
    labelSet.has("ad") ||
    labelSet.has("advert") ||
    labelSet.has("advertisement")
  ) {
    return true;
  }

  // --- 1b) EXPLICIT NAMESPACE TAGS (frame names set by ExtendScript batch
  //        renaming script we provide: "ad:<client>:<role>") ---
  //        If ANY frame on the page has namespace="ad" → the page is a full
  //        ad page. Title/Body style pages (i.e. non-ad article continuation
  //        pages with namespace="article" frames) are never misclassified.
  const hasExplicitAdNamespace = (page as any).adFrameCount && Number((page as any).adFrameCount) >= 1;
  const hasExplicitArticleNamespaceFrames = (page as any).namespaceBuckets
    ? Object.keys((page as any).namespaceBuckets || {}).some((k) => k.startsWith("article:"))
    : false;
  if (hasExplicitAdNamespace && !hasExplicitArticleNamespaceFrames) return true;
  if (hasExplicitArticleNamespaceFrames && !hasExplicitAdNamespace) return false;

  // --- 2) NEGATIVE: reserved special pages are never ads. ---
  // Any EditorsFrame / Editors{Title,Body,Image}Frame variant on the page
  // → it's the Editor's Note page, NEVER an ad. Even if word count is low
  // or only a hero graphic is placed. Also guards against future editors
  // label variants like "EditorsHeadshotFrame" / "EditorIntro" etc.
  const isEditorsLabel = (n: string) =>
    n === "editorsframe" ||
    n === "editorstitleframe" ||
    n === "editorsbodyframe" ||
    n === "editorsimageframe" ||
    n.startsWith("editors") ||
    n.startsWith("editor");
  if (
    labelSet.has("editorsframe") ||
    labelSet.has("editorstitleframe") ||
    labelSet.has("editorsbodyframe") ||
    labelSet.has("editorsimageframe") ||
    labelSet.has("contentsframe") ||
    labelSet.has("titleframe") ||
    labelSet.has("bodyframe") ||
    anyLabelMatches(isEditorsLabel)
  ) {
    return false;
  }

  // Long article bodies are never ads. Continuation pages of long features
  // almost always have word counts of 120+ even without any title frame.
  if ((page.totalWordCount || 0) >= 120) return false;

  // --- 3) HEURISTIC fallback (forgotten AdFrame labels on pure ad pages) ---
  const hasAnyGraphic = (page.imageFileNames?.length || 0) > 0 ||
    (page.logoImageFileNames?.length || 0) > 0;
  const hasExplicitBodyFrame =
    labelSet.has("bodyframe") ||
    labelSet.has("editorsbodyframe") ||
    anyLabelMatches((n) => n.endsWith("bodyframe"));
  const hasArticleContent = page.stories.some((story) => {
    const wc = countWords(story.text || "");
    // Story with >= 30 real words = editorial, not an ad (ads have short copy)
    return wc >= 30;
  });
  if (hasExplicitBodyFrame || hasArticleContent) return false;
  return hasAnyGraphic;
}

/**
 * True when the page has Editor's Note frame labels — either the legacy
 * aggregate `EditorsFrame` OR the three-part split
 * EditorsTitleFrame/EditorsBodyFrame/EditorsImageFrame. Also catches
 * arbitrary Editors* variants so future labeling choices (EditorsQuote,
 * EditorsHeadshotFrame, etc.) still identify the page correctly.
 */
export function isEditorsPage(page: ParsedIdmlPage): boolean {
  const norm = (v: string) =>
    String(v || "").trim().replace(/[\s._-]+/g, "").toLowerCase();
  const labelSet = new Set(
    [...(page.labels || []), ...(page.frames || []).map((f) => f.label || "")]
      .map(norm),
  );
  if (
    labelSet.has("editorsframe") ||
    labelSet.has("editorstitleframe") ||
    labelSet.has("editorsbodyframe") ||
    labelSet.has("editorsimageframe")
  ) {
    return true;
  }
  return Array.from(labelSet).some(
    (n) => n.startsWith("editors") || n.startsWith("editor"),
  );
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function getOrderedPageStories(page: ParsedIdmlPage): ParsedIdmlStory[] {
  const seen = new Set<string>();
  const ordered = [...page.frames]
    .sort((a, b) => a.order - b.order)
    .map((frame) => page.stories.find((story) => story.id === frame.storyId))
    .filter((story): story is ParsedIdmlStory => Boolean(story))
    .filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    });

  if (ordered.length > 0) return ordered;

  return page.stories.filter((story) => {
    if (seen.has(story.id)) return false;
    seen.add(story.id);
    return true;
  });
}

function getOrderedPageStoryEntries(
  page: ParsedIdmlPage,
): OrderedPageStoryEntry[] {
  const seen = new Set<string>();
  const orderedEntries = [...page.frames]
    .sort((a, b) => {
      if (a.top !== b.top) return a.top - b.top;
      if (a.left !== b.left) return a.left - b.left;
      return a.order - b.order;
    })
    .map((frame) => ({
      frame,
      story: page.stories.find((story) => story.id === frame.storyId),
    }))
    .filter(
      (
        entry,
      ): entry is OrderedPageStoryEntry => Boolean(entry.story),
    )
    .filter((entry) => {
      if (seen.has(entry.story.id)) return false;
      seen.add(entry.story.id);
      return true;
    });

  if (orderedEntries.length > 0) return orderedEntries;

  return page.stories
    .filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    })
    .map((story) => ({
      frame: {
        frameSelf: `story-${story.id}`,
        storyId: story.id,
        isTitle: false,
        label: "",
        position: "right" as const,
        order: Number.MAX_SAFE_INTEGER,
        top: Number.MAX_SAFE_INTEGER,
        left: Number.MAX_SAFE_INTEGER,
        bottom: Number.MAX_SAFE_INTEGER,
        right: Number.MAX_SAFE_INTEGER,
        rawName: "",
        namespace: "",
        tags: null,
        imageFileName: null,
      },
      story,
    }));
}

function getPageTitleStoryIds(page: ParsedIdmlPage): Set<string> {
  return new Set(
    page.frames
      .filter((frame) => frame.isTitle)
      .map((frame) => frame.storyId)
      .filter(Boolean),
  );
}

function getPageBodyText(
  page: ParsedIdmlPage,
  includeTitleStories = false,
): string {
  const titleStoryIds = getPageTitleStoryIds(page);
  const stories = getOrderedPageStories(page)
    .filter((story) => Boolean(story.text?.trim()))
    .filter((story) => includeTitleStories || !titleStoryIds.has(story.id));

  const text = stories
    .map((story) => story.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (text || includeTitleStories) return text;
  return getPageBodyText(page, true);
}

function getBodyTextFromStoryEntries(
  entries: Array<{ story: ParsedIdmlStory }>,
): string {
  return entries
    .map((entry) => entry.story.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function isArticleTitleEntry(
  entry: OrderedPageStoryEntry | undefined,
  frameIndex: number,
): boolean {
  if (!entry?.frame?.isTitle) return false;
  if (shouldIgnoreDecorativeStory(entry.story)) return false;
  const isTitleish = detectTitleFrame(entry.story, frameIndex);
  if (!isTitleish) return false;
  const raw = String(entry.story?.title || entry.story?.text || "").replace(/\s+/g, " ").trim();
  if (raw.length <= 2) return false;
  if (/^[\W_]+$/.test(raw)) return false;
  return true;
}

function tokenizeArticleText(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
}

function scoreStoryAgainstTitle(story: ParsedIdmlStory | undefined, title: string): number {
  const titleTokens = new Set(tokenizeArticleText(title));
  if (titleTokens.size === 0) return 0;

  const storyTokens = new Set(
    tokenizeArticleText(
      [story?.title || "", String(story?.text || "").slice(0, 280)].join(" "),
    ),
  );

  let score = 0;
  for (const token of titleTokens) {
    if (storyTokens.has(token)) score += 1;
  }
  return score;
}

function addPagePosition(
  pagePositions: Array<{ page: number; position: "left" | "right" | "full" }>,
  page: number,
  position: "left" | "right" | "full",
) {
  if (pagePositions.some((entry) => entry.page === page)) return;
  pagePositions.push({ page, position });
}

function pushArticle(
  articles: Article[],
  article: {
    title: string;
    author: string;
    bodyParts: string[];
    images: string[];
    startPage: number;
    endPage: number;
    pagePositions: Array<{ page: number; position: "left" | "right" | "full" }>;
    pageBodies: Record<number, string>;
    storyIds?: Set<string>;
    slug?: string;
    roleImages?: Article["roleImages"];
  } | null,
) {
  if (!article) return;
  const defaultRoleImages: Article["roleImages"] = {};
  for (
    let p = article.startPage;
    p <= article.endPage;
    p++
  ) {
    if (!defaultRoleImages[p]) {
      defaultRoleImages[p] = { hero: [], gallery: [], logo: [], pdf: [] };
    }
  }
  articles.push({
    title: article.title,
    author: article.author,
    body: article.bodyParts.join("\n\n"),
    images: article.images,
    startPage: article.startPage,
    endPage: article.endPage,
    pagePositions: article.pagePositions,
    pageBodies: article.pageBodies,
    slug: article.slug || "",
    roleImages: { ...defaultRoleImages, ...(article.roleImages || {}) },
  });
}

function getPageImages(
  page: ParsedIdmlPage,
  fallbacks: string[] = [],
  options?: {
    onlySlug?: string;
    preferredRoles?: Array<"hero" | "gallery" | "logo" | "pdf">;
  },
): string[] {
  const onlySlug = options?.onlySlug || "";
  const preferredRoles = options?.preferredRoles && options.preferredRoles.length > 0
    ? options.preferredRoles
    : (["hero", "gallery", "pdf", "logo"] as const);

  const logoSet = new Set<string>(page?.logoImageFileNames || []);
  const explicitRole: ParsedIdmlPage["explicitRoleImages"] | null =
    (page as any).explicitRoleImages || null;

  // Filter slug: when onlySlug provided, restrict images to those in the
  // article bucket for that slug on this page (prevents cross-article bleed).
  let slugScopedRole: Record<"hero" | "gallery" | "logo" | "pdf", string[]> | null = null;
  if (onlySlug && (page as any).namespaceBuckets) {
    const key = `article:${onlySlug}`;
    const bucket = (page as any).namespaceBuckets[key];
    if (bucket && bucket.roleImages) {
      slugScopedRole = {
        hero: bucket.roleImages.hero || [],
        gallery: bucket.roleImages.gallery || [],
        logo: bucket.roleImages.logo || [],
        pdf: bucket.roleImages.pdf || [],
      };
    }
  }

  const fromSlugRoles: string[] = [];
  const fromPageExplicitRoles: string[] = [];
  if (slugScopedRole) {
    for (const r of preferredRoles) {
      for (const v of slugScopedRole[r] || []) fromSlugRoles.push(v);
    }
  } else if (explicitRole) {
    for (const r of preferredRoles) {
      for (const v of (explicitRole as any)[r] || []) fromPageExplicitRoles.push(v);
    }
  }

  const contentOnly = (page?.imageFileNames || []).filter(
    (name) => !logoSet.has(name),
  );
  return uniqueStrings([
    ...fromSlugRoles,
    ...fromPageExplicitRoles,
    ...contentOnly,
    ...getOrderedPageStories(page).flatMap((story) => story.imageHints).filter(
      (name) => !logoSet.has(name),
    ),
    ...(fallbacks || []).filter((name) => !logoSet.has(name)),
  ]);
}

function getLogoImages(page: ParsedIdmlPage): string[] {
  return uniqueStrings(page?.logoImageFileNames || []);
}

function isRasterImageFileName(value: string): boolean {
  // Extended list: covers the formats InDesign / design agencies typically
  // place on ad pages. Only truly binary/vector "not renderable in a browser
  // <img>" formats (ai, indd, key, pub, doc, pages, docx, rtf, zip) are
  // filtered out. SVG renders fine in <img>.
  return /\.(png|jpe?g|gif|webp|svg|tiff?|bmp|ico|avif|heic|heif|pdf)$/i.test(
    String(value || "").trim(),
  );
}

function splitRasterAndPdfImages(pageImages: string[]): {
  rasterImages: string[];
  pdfImage: string;
  otherAssets: string[];
} {
  const pdfMatches: string[] = [];
  const raster: string[] = [];
  const other: string[] = [];
  const isRasterOrPDF = /\.(png|jpe?g|gif|webp|svg|tiff?|bmp|ico|avif|heic|heif|pdf)$/i;
  for (const raw of pageImages) {
    const v = String(raw || "").trim();
    if (!v) continue;
    const isPDF = /\.pdf$/i.test(v);
    if (isPDF) {
      pdfMatches.push(v);
      // Include the PDF in raster pool too (as last element) so that pages
      // with ONLY a placed PDF file (no PNG preview) still have a hero image.
      // Chrome/Safari/Firefox can render PDFs via <img src> in some contexts
      // and the object-contain CSS will keep proportions; if the browser
      // can't render it, the PageFullPageAd template has a "📄 Open PDF"
      // fallback button anyway.
      raster.push(v);
    } else if (isRasterOrPDF.test(v)) {
      // Real raster (png/jpg/etc) goes FIRST so it wins the hero race.
      raster.unshift(v);
    } else {
      other.push(v);
    }
  }
  return {
    rasterImages: uniqueStrings(raster),
    pdfImage: pdfMatches[0] || "",
    otherAssets: other,
  };
}

function getStandfirst(text: string): string {
  const collapsed = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return "";
  const firstSentence = collapsed.split(/(?<=[.!?])\s+/)[0] || collapsed;
  return firstSentence.slice(0, 220).trim();
}

function getFeatureTemplate(
  position: "left" | "right" | "full",
  isContinuation: boolean,
): ReaderPageTemplate {
  if (!isContinuation && position === "full") return "feature-full";
  return position === "left" ? "feature-left" : "feature-right";
}

function createPageId(prefix: string, value: string | number): string {
  return `${prefix}-${String(value)
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-${Date.now().toString(36)}`;
}

function detectArticlesFromNamespaceBuckets(
  pages: ParsedIdmlPage[],
): Article[] {
  // FIRST pass: any article that has explicit user-supplied frame namespace
  // tags (article:<slug>:role.idx) is 100% deterministic: we build the
  // article directly from those bucketed frames/text bodies. Second pass
  // (legacy heuristic detectArticles) only fills in any pages NOT covered by
  // a slug bucketed article → backward compat 100% for untagged editions.

  type SlugSeed = {
    slug: string;
    pagesSeen: Set<number>;
    orderedEntriesByPage: Record<number, Array<OrderedPageStoryEntry>>;
    titleStoryIds: Set<string>;
    bodyStoryIds: Set<string>;
    storyIds: Set<string>;
    imageFileNames: Set<string>;
    positionsByPage: Record<number, "left" | "right" | "full">;
    roleImagesByPage: Record<number, Record<"hero" | "gallery" | "logo" | "pdf", string[]>>;
    pageBodies: Record<number, string>;
  };

  const seeds = new Map<string, SlugSeed>();

  for (const page of pages) {
    const buckets = (page as any).namespaceBuckets as Record<string, any>;
    if (!buckets) continue;
    for (const [key, bucket] of Object.entries(buckets)) {
      if (!key.startsWith("article:")) continue;
      const slug = key.slice("article:".length);
      if (!slug) continue;
      if (!seeds.has(slug)) {
        seeds.set(slug, {
          slug,
          pagesSeen: new Set(),
          orderedEntriesByPage: {},
          titleStoryIds: new Set(),
          bodyStoryIds: new Set(),
          storyIds: new Set(),
          imageFileNames: new Set(),
          positionsByPage: {},
          roleImagesByPage: {},
          pageBodies: {},
        });
      }
      const seed = seeds.get(slug)!;
      seed.pagesSeen.add(page.pageNumber);

      const orderedEntries: OrderedPageStoryEntry[] = getOrderedPageStoryEntries(page);
      const scopedEntries: OrderedPageStoryEntry[] = [];

      for (const entry of orderedEntries) {
        const sid = entry.story.id;
        const frameSid = entry.frame.storyId;
        const isInTitleSet = bucket.titleStoryIds?.has?.(frameSid || sid);
        const isInBodySet = bucket.bodyStoryIds?.has?.(frameSid || sid);
        const hasNs = entry.frame.namespace === "article" && entry.frame.tags?.slug === slug;
        if (hasNs || isInTitleSet || isInBodySet) {
          scopedEntries.push(entry);
          seed.storyIds.add(sid);
          if (hasNs && entry.frame.tags?.role === "title") {
            seed.titleStoryIds.add(sid);
          } else if ((hasNs && (entry.frame.tags?.role === "body" || entry.frame.tags?.role === "author")) || isInBodySet) {
            seed.bodyStoryIds.add(sid);
          }
        }
      }

      seed.orderedEntriesByPage[page.pageNumber] = scopedEntries;

      // Default position = first text frame's position; else full
      const firstTextFrame = page.frames.find(
        (f) =>
          f.storyId &&
          (f.namespace === "article" && f.tags?.slug === slug ||
            bucket.titleStoryIds?.has?.(f.storyId) ||
            bucket.bodyStoryIds?.has?.(f.storyId)),
      );
      if (firstTextFrame) {
        seed.positionsByPage[page.pageNumber] = firstTextFrame.position;
      } else {
        seed.positionsByPage[page.pageNumber] = "full";
      }

      const bucketRole = (bucket.roleImages || {}) as {
        hero?: string[];
        gallery?: string[];
        logo?: string[];
        pdf?: string[];
      };
      seed.roleImagesByPage[page.pageNumber] = {
        hero: bucketRole.hero || [],
        gallery: bucketRole.gallery || [],
        logo: bucketRole.logo || [],
        pdf: bucketRole.pdf || [],
      };
      for (const v of [...(bucketRole.hero || []), ...(bucketRole.gallery || [])]) {
        if (v) seed.imageFileNames.add(v);
      }
    }
  }

  // Exclude slugs that don't have any title story ids and also zero text bodies.
  const meaningfulSlugs = new Map<string, SlugSeed>();
  for (const [slug, seed] of seeds.entries()) {
    const hasText = Object.values(seed.orderedEntriesByPage).some((arr) => arr.length > 0);
    const hasImages = seed.imageFileNames.size > 0;
    if (!hasText && !hasImages) continue;
    meaningfulSlugs.set(slug, seed);
  }

  if (meaningfulSlugs.size === 0) return [];

  const coveredPages = new Set<number>();
  const articles: Article[] = [];

  for (const [slug, seed] of meaningfulSlugs.entries()) {
    const sortedSeen = Array.from(seed.pagesSeen).sort((a, b) => a - b);
    if (sortedSeen.length === 0) continue;
    const startPage = sortedSeen[0];
    const endPage = sortedSeen[sortedSeen.length - 1];

    // Fill in body per page, overall title/body text
    const pageBodies: Record<number, string> = {};
    let mainTitle = "";
    const allBodyParts: string[] = [];

    for (let p = startPage; p <= endPage; p++) {
      const entries = seed.orderedEntriesByPage[p] || [];
      if (!entries.length) {
        // No entries on continuation page: still add empty so positions work.
        pageBodies[p] = "";
        continue;
      }

      const titleEntry = entries.find((e) => {
        if (seed.titleStoryIds.has(e.story.id)) return true;
        if (e.frame.namespace === "article" && e.frame.tags?.slug === slug && e.frame.tags?.role === "title") {
          return true;
        }
        return false;
      }) || entries[0];

      if (!mainTitle) {
        mainTitle = String(titleEntry.story.title || titleEntry.story.text || "").trim();
      }

      const rest = entries.filter((e) => e.story.id !== titleEntry.story.id);
      const pageBody = getBodyTextFromStoryEntries(rest).trim() ||
        (titleEntry ? String(titleEntry.story.text || "").trim() : "");
      pageBodies[p] = pageBody;
      if (pageBody && p !== startPage) allBodyParts.push(pageBody);
    }

    // Make sure page 1 (if exists) body is populated even for title pages.
    if (!pageBodies[startPage]?.trim() && seed.orderedEntriesByPage[startPage]) {
      const titlePgEntries = seed.orderedEntriesByPage[startPage];
      const titleEntry =
        titlePgEntries.find((e) => seed.titleStoryIds.has(e.story.id)) || titlePgEntries[0];
      if (titleEntry) {
        const rest = titlePgEntries.filter((e) => e.story.id !== titleEntry.story.id);
        const opening = getBodyTextFromStoryEntries(rest).trim();
        if (opening) {
          pageBodies[startPage] = opening;
          allBodyParts.unshift(opening);
        } else if (!mainTitle) {
          mainTitle = String(titleEntry.story.title || titleEntry.story.text || "").trim();
        }
      }
    }

    const imageArr = Array.from(seed.imageFileNames);
    const author = "";
    const positions: Article["pagePositions"] = [];
    for (const [pStr, pos] of Object.entries(seed.positionsByPage)) {
      positions.push({ page: Number(pStr), position: pos });
    }
    positions.sort((a, b) => a.page - b.page);

    // Pages covered by this slug article (so heuristic pass doesn't
    // double-book them with extra articles).
    for (let p = startPage; p <= endPage; p++) coveredPages.add(p);

    // Fill roleImagesByPage default for any missing pages.
    const roleImagesFinal: Article["roleImages"] = {};
    for (let p = startPage; p <= endPage; p++) {
      roleImagesFinal[p] = seed.roleImagesByPage[p] || { hero: [], gallery: [], logo: [], pdf: [] };
    }

    articles.push({
      title: mainTitle,
      author,
      body: [...(pageBodies[startPage] ? [pageBodies[startPage]] : []), ...allBodyParts]
        .filter(Boolean)
        .join("\n\n"),
      images: imageArr,
      startPage,
      endPage,
      pagePositions: positions,
      pageBodies,
      slug,
      roleImages: roleImagesFinal,
    });
  }

  // Save for downstream heuristic to know which pages are already handled.
  (detectArticlesFromNamespaceBuckets as any).coveredPages = coveredPages;

  return articles.sort((a, b) => a.startPage - b.startPage);
}

export function detectArticles(pages: ParsedIdmlPage[]): Article[] {
  const slugArticles: Article[] = detectArticlesFromNamespaceBuckets(pages);
  const coveredPages: Set<number> =
    (detectArticlesFromNamespaceBuckets as any).coveredPages || new Set<number>();

  const articleTitlesByPage = new Map<number, string[]>();
  for (const page of pages) {
    const orderedEntries = getOrderedPageStoryEntries(page);
    articleTitlesByPage.set(
      page.pageNumber,
      orderedEntries
        .filter((entry, idx) => isArticleTitleEntry(entry, idx))
        .map((entry) => String(entry.story.title || entry.story.text || "").trim())
        .filter(Boolean),
    );
  }

  function storyBelongsToLaterTitle(
    story: ParsedIdmlStory | undefined,
    currentTitle: string,
    currentPage: number,
  ) {
    if (!story) return false;

    const currentScore = scoreStoryAgainstTitle(story, currentTitle);

    let bestLaterScore = 0;
    for (let pageNumber = currentPage + 1; pageNumber <= currentPage + 2; pageNumber++) {
      const titles = articleTitlesByPage.get(pageNumber) || [];
      for (const title of titles) {
        bestLaterScore = Math.max(bestLaterScore, scoreStoryAgainstTitle(story, title));
      }
    }

    return bestLaterScore >= 2 && bestLaterScore > Math.max(currentScore, 0);
  }

  let currentArticle: {
    title: string;
    author: string;
    bodyParts: string[];
    images: string[];
    startPage: number;
    endPage: number;
    pagePositions: Array<{ page: number; position: "left" | "right" | "full" }>;
    pageBodies: Record<number, string>;
    storyIds: Set<string>;
  } | null = null;

  const heuristicArticles: Article[] = [];

  for (const page of pages) {
    // Pages that were already 100% handled by slug bucket pass (user tagged
    // frames) should not be re-analyzed via heuristics → skip them entirely.
    // This prevents double-articles on pages where slug buckets exist, and
    // stops cross-bleed into untagged neighbour pages.
    if (coveredPages.has(page.pageNumber)) {
      pushArticle(heuristicArticles, currentArticle);
      currentArticle = null;
      continue;
    }

    if (detectAdPage(page)) {
      pushArticle(heuristicArticles, currentArticle);
      currentArticle = null;
      continue;
    }

    const orderedEntries: OrderedPageStoryEntry[] = getOrderedPageStoryEntries(page);
    const titleFrameIdx = orderedEntries.findIndex((entry, idx) =>
      isArticleTitleEntry(entry, idx),
    );

    if (titleFrameIdx >= 0) {
      const titleEntry: OrderedPageStoryEntry | undefined = orderedEntries[titleFrameIdx];
      const titleStory = titleEntry?.story;
      pushArticle(heuristicArticles, currentArticle);

      const priorStoryIds: Set<string> = currentArticle?.storyIds || new Set<string>();
      const openingEntries: OrderedPageStoryEntry[] = orderedEntries
        .filter((entry) => entry.story.id !== titleStory?.id)
        .filter((entry) => !priorStoryIds.has(entry.story.id))
        .filter((entry) => !shouldIgnoreDecorativeStory(entry.story))
        .filter((entry) =>
          !storyBelongsToLaterTitle(
            entry.story,
            String(titleStory?.title || titleStory?.text || ""),
            page.pageNumber,
          ),
        );
      const openingBody = getBodyTextFromStoryEntries(openingEntries);
      const openingStoryIds: Set<string> = new Set(
        openingEntries.map((entry) => entry.story.id).filter(Boolean),
      );

      currentArticle = {
        title: (() => {
          const s = titleStory?.title?.trim() || "";
          if (s.length >= 3) return s;
          let t = String(titleStory?.text || "").replace(/\s+/g, " ").trim();
          t = t
            .replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "")
            .replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "")
            .trim();
          if (!t || t.length <= 2) return "";
          const words = t.split(/\s+/).slice(0, 14);
          return words.join(" ").replace(/[.!?,;:]+$/g, "").trim();
        })(),
        author: "",
        bodyParts: (() => {
          if (openingBody) return [openingBody];
          return titleStory?.text ? [titleStory.text] : [];
        })(),
        images: getPageImages(page, titleStory ? titleStory.imageHints : []),
        startPage: page.pageNumber,
        endPage: page.pageNumber,
        pagePositions: [
          {
            page: page.pageNumber,
            position: titleEntry?.frame.position || page.frames[0]?.position || "right",
          },
        ],
        pageBodies: {
          [page.pageNumber]: openingBody || titleStory?.text || "",
        },
        storyIds: openingStoryIds,
      };
    } else if (currentArticle) {
      const freshEntries = orderedEntries.filter(
        (entry) => !currentArticle?.storyIds.has(entry.story.id),
      );
      const pageBody = getBodyTextFromStoryEntries(freshEntries);

      if (pageBody) {
        currentArticle.bodyParts.push(pageBody);
        currentArticle.pageBodies[page.pageNumber] = pageBody;
        currentArticle.endPage = page.pageNumber;
        for (const entry of freshEntries) {
          currentArticle.storyIds.add(entry.story.id);
        }
        currentArticle.images.push(...getPageImages(page));
        for (const frame of page.frames) {
          addPagePosition(currentArticle.pagePositions, page.pageNumber, frame.position);
        }
      } else if (
        page.pageNumber === currentArticle.endPage + 1 &&
        !detectAdPage(page)
      ) {
        const meaningfulEntries = orderedEntries.filter(
          (entry) => !shouldIgnoreDecorativeStory(entry.story),
        );
        if (meaningfulEntries.length > 0) {
          currentArticle.endPage = page.pageNumber;
          currentArticle.pageBodies[page.pageNumber] =
            getBodyTextFromStoryEntries(meaningfulEntries);
          currentArticle.images.push(...getPageImages(page));
          for (const frame of page.frames) {
            addPagePosition(currentArticle.pagePositions, page.pageNumber, frame.position);
          }
        }
      }
    }
  }

  pushArticle(heuristicArticles, currentArticle);

  const combined = [...slugArticles, ...heuristicArticles].sort(
    (a, b) => a.startPage - b.startPage,
  );
  return combined;
}

function buildFeatureContent(
  article: Article,
  page: ParsedIdmlPage,
  pageNum: number,
  position: "left" | "right" | "full",
): ReaderPageContent {
  const isFirstPage = pageNum === article.startPage;
  const bodyText = article.pageBodies[pageNum] || getPageBodyText(page);
  const slug = article.slug || "";

  // Role images from article.roleImages[pageNum] (set by slug bucket pass).
  // If user tagged frames: hero wins unconditionally (the exact frame they
  // marked `article:<slug>:hero`), gallery = roleImages.gallery, rest = legacy.
  const rolesOnPage: Record<"hero" | "gallery" | "logo" | "pdf", string[]> =
    article.roleImages?.[pageNum] || { hero: [], gallery: [], logo: [], pdf: [] };
  const pageImages = slug
    ? getPageImages(page, article.images, { onlySlug: slug })
    : getPageImages(page, article.images);

  const heroPool = uniqueStrings([...(rolesOnPage.hero || []), ...pageImages]);
  const galleryPool = uniqueStrings([
    ...(rolesOnPage.gallery || []),
    ...pageImages.slice(1),
    ...(rolesOnPage.pdf || []),
  ]);
  const hero = heroPool[0] || pageImages[0] || article.images[0] || "";

  const logos = uniqueStrings([
    ...(rolesOnPage.logo || []),
    ...getLogoImages(page),
  ]);
  const logoHero = logos[0] || "";
  const standfirst = isFirstPage ? getStandfirst(bodyText || article.body) : "";
  const isContinuation = !isFirstPage;

  return {
    title: article.title,
    author: article.author || undefined,
    name: article.author || undefined,
    body: bodyText,
    standfirst: isFirstPage ? standfirst : undefined,
    imageUrl: hero,
    imageUrls: uniqueStrings([hero, ...galleryPool]),
    image: hero,
    featureImage: hero,
    heroImage: hero,
    mainImage: hero,
    images: galleryPool,
    gallery: galleryPool,
    additionalImages: galleryPool.slice(1),
    logoImage: logoHero,
    logoImages: logos,
    partnerLogo: logoHero,
    pullQuotes: [],
    kicker: isFirstPage ? "Feature" : "Continued Feature",
    mediaLayout:
      !isContinuation && position === "full" ? "background" : "standard",
    weight: isFirstPage ? 3 : 2,
    isContinuation,
    continuationLabel: isContinuation ? article.title : undefined,
  };
}

function buildContentsPage(articles: Article[]): ReaderPageContent {
  const items = articles
    .filter((a) => a.title && !/advert|ad\b/i.test(a.title))
    .map((a) => ({
      title: a.title,
      page: String(a.startPage).padStart(2, "0"),
    }));

  return {
    title: "In This Issue",
    body: "",
    items,
  };
}

export function mapIdmlToReaderPages(pages: ParsedIdmlPage[]): ReaderPage[] {
  const result: ReaderPage[] = [];

  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  const articles = detectArticles(sortedPages);

  const coverSourcePage = sortedPages[0];
  const coverSourceArticle =
    articles.find((article) => (article.title || "").trim().length >= 3) || null;
  const coverBody = coverSourcePage
    ? getPageBodyText(coverSourcePage, true)
    : "";
  const coverImages = coverSourcePage
    ? getPageImages(coverSourcePage, coverSourceArticle?.images || [])
    : [];
  const coverLogos = coverSourcePage ? getLogoImages(coverSourcePage) : [];
  const coverLogo = coverLogos[0] || "";
  const fallbackCoverTitle = (() => {
    const firstStory = coverSourcePage?.stories[0];
    const candidates = [
      coverSourceArticle?.title,
      firstStory?.title,
      String(firstStory?.text || "").replace(/\s+/g, " ").trim(),
    ];
    for (const raw of candidates) {
      const clean = String(raw || "")
        .replace(/\s+/g, " ")
        .replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "")
        .replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "")
        .trim();
      if (clean.length >= 3) return clean;
    }
    return "";
  })();

  if (coverSourcePage) {
    result.push({
      id: createPageId("page-cover", coverSourcePage.pageNumber),
      position: 0,
      template: "cover",
      content: {
        title: fallbackCoverTitle,
        body: coverBody,
        standfirst: getStandfirst(coverSourceArticle?.body || coverBody),
        imageUrl: coverImages[0] || "",
        imageUrls: coverImages,
        image: coverImages[0] || "",
        featureImage: coverImages[0] || "",
        heroImage: coverImages[0] || "",
        coverImage: coverImages[0] || "",
        mainImage: coverImages[0] || "",
        images: coverImages,
        gallery: coverImages,
        logoImage: coverLogo,
        logoImages: coverLogos,
        partnerLogo: coverLogo,
        kicker: "Digital Edition",
      },
    });
  }

  if (articles.length > 0) {
    result.push({
      id: createPageId("page-contents", "issue"),
      position: 0,
      template: "contents",
      content: buildContentsPage(articles),
    });
  }

  const lastMeaningfulPage = [...sortedPages]
    .reverse()
    .find(
      (page) =>
        page.pageNumber > 5 &&
        !detectAdPage(page) &&
        (page.stories.length > 0 || page.imageFileNames.length > 0),
    );

  const editorNotePage =
    sortedPages.find((p) => isEditorsPage(p)) ||
    sortedPages.find((p) => p.labels.includes("EditorsFrame")) ||
    sortedPages.find((p) => p.pageNumber === 5);

  const reservedPageNumbers = new Set<number>([1]);
  for (const page of sortedPages) {
    if (
      page.labels.includes("ContentsFrame") ||
      (page.frames || []).some((f) =>
        /^\s*contents\s*frame\s*$/i.test(String(f.label || "").replace(/[\s._-]+/g, "")),
      )
    ) {
      reservedPageNumbers.add(page.pageNumber);
    }
    if (isEditorsPage(page)) reservedPageNumbers.add(page.pageNumber);
    if (detectAdPage(page)) {
      reservedPageNumbers.add(page.pageNumber);
    }
  }
  if (editorNotePage) reservedPageNumbers.add(editorNotePage.pageNumber);
  if (lastMeaningfulPage) reservedPageNumbers.add(lastMeaningfulPage.pageNumber);

  if (editorNotePage) {
    // Priority order: the frame with label EditorsTitleFrame → the story it
    // links to → becomes the standalone title; then EditorsBodyFrame → the
    // main body; then any remaining stories from getOrderedPageStories fill
    // in the rest. This way, even if the user labeled their frames
    // separately (EditorsTitleFrame / EditorsBodyFrame) instead of using the
    // aggregate "EditorsFrame" tag, the content is extracted in the right
    // semantic order.
    const norm = (v: unknown): string =>
      String(v || "").trim().replace(/[\s._-]+/g, "").toLowerCase();
    const findFrameByLabel = (labelNorm: string) =>
      editorNotePage.frames.find((f) => norm(f.label) === labelNorm);
    const findStoryByFrame = (frame: ReturnType<typeof findFrameByLabel>) =>
      frame && frame.storyId
        ? editorNotePage.stories.find((s) => s.id === frame.storyId)
        : undefined;

    const titleFrame = findFrameByLabel("editorstitleframe");
    const bodyFrame = findFrameByLabel("editorsbodyframe");
    const imageFrame = findFrameByLabel("editorsimageframe");
    const explicitTitleStory = findStoryByFrame(titleFrame);
    const explicitBodyStory = findStoryByFrame(bodyFrame);

    const baseOrdered = getOrderedPageStories(editorNotePage).filter(
      (story) => !shouldIgnoreDecorativeStory(story),
    );
    const mergedParts: string[] = [];
    if (explicitBodyStory?.text?.trim()) mergedParts.push(explicitBodyStory.text.trim());
    for (const story of baseOrdered) {
      if (explicitTitleStory && story.id === explicitTitleStory.id) continue;
      if (explicitBodyStory && story.id === explicitBodyStory.id) continue;
      if (story.text?.trim()) mergedParts.push(story.text.trim());
    }
    const combinedText = mergedParts.join("\n\n");
    const allPageImages = getPageImages(editorNotePage);
    const imageHintSet = new Set<string>(
      (explicitTitleStory?.imageHints || []).concat(
        (explicitBodyStory?.imageHints || []),
      ).map((v) => String(v || "").trim()).filter(Boolean),
    );
    const explicitHeroImages = allPageImages.filter((url) => {
      if (!url) return false;
      const base = url.split("/").pop()?.split("?")[0] || "";
      return imageHintSet.has(base);
    });
    const editorsImageFirst = imageFrame
      ? allPageImages.slice(0, 1).concat(allPageImages)
      : allPageImages;
    const editorImages =
      explicitHeroImages.length > 0
        ? explicitHeroImages.concat(allPageImages)
        : editorsImageFirst;
    const editorHero = editorImages[0] || "";
    const editorLogos = getLogoImages(editorNotePage);
    const editorLogo = editorLogos[0] || "";
    const editorTitleRaw = explicitTitleStory
      ? explicitTitleStory.title?.trim() || explicitTitleStory.text?.trim() || ""
      : "";
    const finalEditorTitle = editorTitleRaw || "Editor's Note";

    result.push({
      id: createPageId("page-editor", editorNotePage.pageNumber),
      position: 0,
      template: "editor-note",
      content: {
        title: finalEditorTitle,
        author: "",
        body: combinedText,
        imageUrl: editorHero,
        imageUrls: editorImages,
        image: editorHero,
        featureImage: editorHero,
        heroImage: editorHero,
        mainImage: editorHero,
        photo: editorHero,
        headshot: editorHero,
        portrait: editorHero,
        images: editorImages,
        gallery: editorImages,
        logoImage: editorLogo,
        logoImages: editorLogos,
        partnerLogo: editorLogo,
      },
    });
  }

  const articleByPage = new Map<number, Article>();
  for (const article of articles) {
    if (article.title && /^\d+$/.test(article.title.trim())) {
      continue;
    }
    for (
      let pageNum = article.startPage;
      pageNum <= article.endPage;
      pageNum++
    ) {
      if (!articleByPage.has(pageNum)) articleByPage.set(pageNum, article);
    }
  }

  // --- Pre-compute title fallback for every article that has title="" (a
  // common parser case when story.title is empty but story.text has the 4-14
  // word headline). Ensures Contents page entries are non-empty AND avoids
  // running the per-page title lookup twice. ---
  const articleTitleFallbacks = new Map<number, string>();
  {
    const byStartPage = new Map<number, Article>();
    for (const a of articles) byStartPage.set(a.startPage, a);
    for (const sourcePage of sortedPages) {
      const art = byStartPage.get(sourcePage.pageNumber);
      if (!art || (art.title || "").trim().length >= 2) continue;
      const explicitTitleFrame = sourcePage.frames.find(
        (f) =>
          /^\s*title\s*frame\s*$/i.test(
            String(f.label || "").replace(/[\s._-]+/g, ""),
          ),
      );
      const titleStory =
        (explicitTitleFrame
          ? sourcePage.stories.find((s) => s.id === explicitTitleFrame.storyId)
          : undefined) ||
        getOrderedPageStories(sourcePage).find((s) => {
          const txt = s.text?.trim() || "";
          const wc = countWords(txt);
          return wc >= 2 && wc <= 20;
        }) ||
        sourcePage.stories.find((s) => Boolean((s.title || s.text || "").trim()));
      const explicitRaw = explicitTitleFrame
        ? titleStory?.title?.trim() || titleStory?.text?.trim()
        : undefined;
      const raw =
        explicitRaw ||
        titleStory?.title?.trim() ||
        titleStory?.text?.trim() ||
        art.title?.trim() ||
        sourcePage.stories[0]?.title?.trim() ||
        sourcePage.stories[0]?.text?.trim() ||
        "";
      let clean = String(raw).replace(/\s+/g, " ").trim();
      clean = clean
        .replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "")
        .replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "")
        .trim();
      if (!clean) continue;
      const words = clean.split(/\s+/).slice(0, 16);
      let fallbackTitle = words.join(" ").replace(/[.!?,;:]+$/g, "").trim();
      fallbackTitle = fallbackTitle
        .replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "")
        .replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "")
        .trim();
      if (!fallbackTitle) continue;
      art.title = fallbackTitle;
      articleTitleFallbacks.set(sourcePage.pageNumber, fallbackTitle);
    }
  }

  for (const sourcePage of sortedPages) {
    const pageNum = sourcePage.pageNumber;
    if (reservedPageNumbers.has(pageNum)) continue;

    if (detectAdPage(sourcePage)) {
      const pageImages = getPageImages(sourcePage);
      const adLogos = getLogoImages(sourcePage);
      const adLogo = adLogos[0] || "";
      const { rasterImages, pdfImage } = splitRasterAndPdfImages(pageImages);
      const adHero = rasterImages[0] || adLogo; // Fallback: if ONLY logo on page, use it as ad
      result.push({
        id: createPageId(`page-${pageNum}`, "ad"),
        position: 0,
        template: "ad",
        content: {
          title: "Advertisement",
          label: "Advertisement",
          body: "",
          imageUrl: adHero,
          imageUrls: rasterImages,
          image: adHero,
          featureImage: adHero,
          heroImage: adHero,
          mainImage: adHero,
          backgroundImage: adHero,
          images: rasterImages,
          gallery: rasterImages,
          logoImage: adLogo,
          logoImages: adLogos,
          partnerLogo: adLogo,
          pdfUrl: pdfImage || undefined,
        },
      });
      continue;
    }

    const article = articleByPage.get(pageNum);
    const pageImages = getPageImages(sourcePage);
    const pageLogos = getLogoImages(sourcePage);
    const detectPageTitle = (fallbackWordMax = 14): string => {
      const articleTitle = String(article?.title || "").trim();
      if (articleTitle.length >= 3) return articleTitle;
      const explicitTitleFrame = sourcePage.frames.find(
        (f) =>
          /^\s*title\s*frame\s*$/i.test(
            String(f.label || "").replace(/[\s._-]+/g, ""),
          ),
      );
      const titleStory =
        (explicitTitleFrame
          ? sourcePage.stories.find((s) => s.id === explicitTitleFrame.storyId)
          : undefined) ||
        getOrderedPageStories(sourcePage).find((s) => {
          const txt = s.text?.trim() || "";
          const wc = countWords(txt);
          return wc >= 3 && wc <= 20;
        }) ||
        sourcePage.stories.find((s) => {
          const candidate = String(s.title || s.text || "").replace(/\s+/g, " ").trim();
          return candidate.length >= 3;
        });
      const explicitRaw = explicitTitleFrame
        ? titleStory?.title?.trim() || titleStory?.text?.trim()
        : undefined;
      const raw =
        explicitRaw ||
        (articleTitle.length >= 3 ? articleTitle : "") ||
        titleStory?.title?.trim() ||
        titleStory?.text?.trim() ||
        (sourcePage.stories[0]?.title?.trim() ??
          sourcePage.stories[0]?.text?.trim() ??
          "");
      let clean = String(raw).replace(/\s+/g, " ").trim();
      clean = clean.replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "").trim();
      clean = clean.replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "").trim();
      if (!clean || clean.length <= 2) return "";
      const words = clean.split(/\s+/).slice(0, fallbackWordMax);
      let joined = words.join(" ").replace(/[.!?,;:]+$/g, "").trim();
      joined = joined
        .replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "")
        .replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "")
        .trim();
      return joined;
    };
    const pageTitle = detectPageTitle(14);
    const pageBodyRaw = article?.pageBodies?.[pageNum] || getPageBodyText(sourcePage);
    const pageBody = (() => {
      const lines = String(pageBodyRaw || "").split("\n");
      const kept = lines
        .map((l) => l.trim())
        .filter((l) => {
          if (!l) return false;
          if (/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g.test(l)) return false;
          return true;
        });
      return kept.join("\n").trim();
    })();
    const pageWordCount = pageBody ? countWords(pageBody) : sourcePage.totalWordCount || 0;
    const hasAnyArticleFrames = sourcePage.frames.some((f) =>
      /^\s*(bodyframe|titleframe|textframe)\s*$/i.test(
        String(f.label || "").replace(/[\s._-]+/g, ""),
      ),
    );
    const lookslikeAd = (() => {
      if (article && article.title.trim().length > 3) return false;
      if (hasAnyArticleFrames) return false;
      if (pageWordCount >= 90) return false;
      const hasPdf = pageImages.some((u) => /\.pdf($|\?)/i.test(u || ""));
      const hasShortAdWords =
        /(advertisement|sponsored|©|all rights reserved|terms and conditions|registered office|tel\.|www\.|email:|t: ?\+?\d|e: ?[a-z0-9.]+@)/i.test(
          pageBody,
        );
      return (
        (pageImages.length >= 1 && pageWordCount < 55) ||
        (pageImages.length >= 1 && pageLogos.length >= 1) ||
        hasPdf ||
        hasShortAdWords
      );
    })();

    // --- Special case: 6 of the 9 pure-image ad pages have NO stories, NO
    // title, NO article body detected (0 words) but DO have 1+ image. These
    // are "Advertisement" pages by definition, not feature-full with empty
    // title. Force them into ad so the reader renders the PDF tap-to-open
    // card (PR #341) instead of a blank "article" shell. ---
    const isImageOnlyNoStory =
      !pageTitle &&
      (pageBody || "").trim().length < 25 &&
      pageWordCount < 12 &&
      pageImages.length > 0 &&
      (sourcePage.stories.length === 0 ||
        !sourcePage.stories.some((s) => String(s.text || s.title || "").trim().length > 40));
    if (isImageOnlyNoStory && !article) {
      const pageLogo = pageLogos[0] || "";
      const { rasterImages, pdfImage } = splitRasterAndPdfImages(pageImages);
      const adHero = rasterImages[0] || pageLogo;
      result.push({
        id: createPageId(`page-${pageNum}`, "ad"),
        position: 0,
        template: "ad",
        content: {
          title: "Advertisement",
          label: "Advertisement",
          body: pageBody || "",
          imageUrl: adHero,
          imageUrls: rasterImages,
          image: adHero,
          featureImage: adHero,
          heroImage: adHero,
          mainImage: adHero,
          backgroundImage: adHero,
          images: rasterImages,
          gallery: rasterImages,
          logoImage: pageLogo,
          logoImages: pageLogos,
          partnerLogo: pageLogo,
          pdfUrl: pdfImage || undefined,
        },
      });
      continue;
    }

    // --- No article mapped to this page? NEVER drop the page (was the
    // "only 5 pages created" bug — 52 pages skipped in v1). Decide by
    // ad-look heuristic → ad page, else standalone feature page from
    // the page's OWN stories/images. ---
    if (!article) {
      if (lookslikeAd) {
        const pageLogo = pageLogos[0] || "";
        const { rasterImages, pdfImage } = splitRasterAndPdfImages(pageImages);
        const adHero = rasterImages[0] || pageLogo;
        result.push({
          id: createPageId(`page-${pageNum}`, "ad"),
          position: 0,
          template: "ad",
          content: {
            title: "Advertisement",
            label: "Advertisement",
            body: pageBody || "",
            imageUrl: adHero,
            imageUrls: rasterImages,
            image: adHero,
            featureImage: adHero,
            heroImage: adHero,
            mainImage: adHero,
            backgroundImage: adHero,
            images: rasterImages,
            gallery: rasterImages,
            logoImage: pageLogo,
            logoImages: pageLogos,
            partnerLogo: pageLogo,
            pdfUrl: pdfImage || undefined,
          },
        });
        continue;
      }

      const standalonePosition = sourcePage.frames[0]?.position || "right";
      const standaloneTemplate = getFeatureTemplate(standalonePosition, false);
      const standFirst = getStandfirst(pageBody);
      const standaloneTitleRaw = (() => {
        const t = pageTitle || `Page ${pageNum}`;
        return String(t)
          .replace(/\s+/g, " ")
          .trim();
      })();
      const standaloneTitleClean = standaloneTitleRaw
        .replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "")
        .replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "")
        .trim();
      const standaloneTitleFellBack =
        !standaloneTitleClean ||
        /^Page\s+\d+$/i.test(standaloneTitleClean) ||
        /^\d+$/g.test(standaloneTitleClean);
      if (
        standaloneTitleFellBack &&
        pageBody.length < 55 &&
        pageImages.length > 0 &&
        !hasAnyArticleFrames
      ) {
        const pageLogo = pageLogos[0] || "";
        const { rasterImages, pdfImage } = splitRasterAndPdfImages(pageImages);
        const adHero = rasterImages[0] || pageLogo;
        result.push({
          id: createPageId(`page-${pageNum}`, "ad-fallback"),
          position: 0,
          template: "ad",
          content: {
            title: "Advertisement",
            label: "Advertisement",
            body: pageBody || "",
            imageUrl: adHero,
            imageUrls: rasterImages,
            image: adHero,
            featureImage: adHero,
            heroImage: adHero,
            mainImage: adHero,
            backgroundImage: adHero,
            images: rasterImages,
            gallery: rasterImages,
            logoImage: pageLogo,
            logoImages: pageLogos,
            partnerLogo: pageLogo,
            pdfUrl: pdfImage || undefined,
          },
        });
        continue;
      }
      result.push({
        id: createPageId(
          `page-${pageNum}`,
          standaloneTitleClean.slice(0, 24) || pageNum,
        ),
        position: 0,
        template: standaloneTemplate as ReaderPageTemplate,
        content: {
          title: standaloneTitleClean || `Page ${pageNum}`,
          body: pageBody,
          standfirst: standFirst,
          imageUrl: pageImages[0] || "",
          imageUrls: pageImages,
          image: pageImages[0] || "",
          featureImage: pageImages[0] || "",
          heroImage: pageImages[0] || "",
          mainImage: pageImages[0] || "",
          coverImage: pageImages[0] || "",
          images: pageImages.slice(1),
          gallery: pageImages.slice(1),
          additionalImages: pageImages.slice(1),
          logoImage: pageLogos[0] || "",
          logoImages: pageLogos,
          partnerLogo: pageLogos[0] || "",
          pullQuotes: [],
          kicker: "Feature",
          weight: 3,
        },
      });
      continue;
    }

    const pagePosition = article.pagePositions.find(
      (p) => p.page === pageNum,
    );
    const position =
      pagePosition?.position || sourcePage.frames[0]?.position || "right";
    const template = getFeatureTemplate(
      position,
      pageNum !== article.startPage,
    );
    const isContinuation = pageNum !== article.startPage;
    const articleTitleClean = (() => {
      const t = String(article.title || "").trim();
      return t
        .replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "")
        .replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "")
        .trim();
    })();
    const pageLocalClean = (() => {
      const t = detectPageTitle(16);
      return t
        .replace(/^<\?[A-Za-z_:][\w:.-]*\s*.*?\?>/g, "")
        .replace(/<\?[A-Za-z_:][\w:.-]*\s*.*?\?>$/g, "")
        .trim();
    })();
    const finalTitle = (isContinuation
      ? articleTitleClean || pageLocalClean || String(pageNum)
      : articleTitleClean || pageLocalClean || String(pageNum)
    ).trim();
    const finalTitleFellBack =
      !finalTitle ||
      /^Page\s+\d+$/i.test(finalTitle) ||
      /^\d+$/g.test(finalTitle);

    // --- Final safety: if an article "wrapped" this page but in reality it's
    // an image-only ad (no title, no body text, only images) → force to ad
    // template instead of writing a blank feature-full page. ---
    if (
      finalTitleFellBack &&
      ((article.body || "").trim().length < 55 ||
        (pageBody || "").trim().length < 55) &&
      pageImages.length > 0
    ) {
      const pageLogo = pageLogos[0] || "";
      const { rasterImages, pdfImage } = splitRasterAndPdfImages(pageImages);
      const adHero = rasterImages[0] || pageLogo;
      result.push({
        id: createPageId(`page-${pageNum}`, "ad"),
        position: 0,
        template: "ad",
        content: {
          title: "Advertisement",
          label: "Advertisement",
          body: pageBody || "",
          imageUrl: adHero,
          imageUrls: rasterImages,
          image: adHero,
          featureImage: adHero,
          heroImage: adHero,
          mainImage: adHero,
          backgroundImage: adHero,
          images: rasterImages,
          gallery: rasterImages,
          logoImage: pageLogo,
          logoImages: pageLogos,
          partnerLogo: pageLogo,
          pdfUrl: pdfImage || undefined,
        },
      });
      continue;
    }

    result.push({
      id: createPageId(
        `page-${pageNum}`,
        finalTitle.slice(0, 24) || pageNum,
      ),
      position: 0,
      template,
      content: buildFeatureContent(
        { ...article, title: finalTitle },
        sourcePage,
        pageNum,
        position,
      ),
    });
  }

  if (lastMeaningfulPage) {
    const lastImages = getPageImages(lastMeaningfulPage);
    const lastLogos = getLogoImages(lastMeaningfulPage);
    const lastLogo = lastLogos[0] || "";
    const { rasterImages, pdfImage } = splitRasterAndPdfImages(lastImages);
    const lastArticle = [...articles]
      .reverse()
      .find((article) => article.endPage <= lastMeaningfulPage.pageNumber);
    const backHero = rasterImages[0] || "";

    result.push({
      id: createPageId("page-back-cover", lastMeaningfulPage.pageNumber),
      position: 0,
      template: "back-cover",
      content: {
        title: "See You Next Issue",
        body: "Thank you for reading Yorkshire BusinessWoman in our digital reader. Browse the archive for more editions and return soon for the next issue.",
        imageUrl: backHero,
        imageUrls: rasterImages,
        image: backHero,
        featureImage: backHero,
        heroImage: backHero,
        mainImage: backHero,
        coverImage: backHero,
        images: rasterImages,
        gallery: rasterImages,
        logoImage: lastLogo,
        logoImages: lastLogos,
        partnerLogo: lastLogo,
        pdfUrl: pdfImage || undefined,
        kicker: "Until Next Time",
        ctaLabel: "Browse Archive",
        ctaHref: "/new-edition",
        nextIssue: lastArticle?.title || "",
      },
    });
  }

  return result.map((page, index) => ({
    ...page,
    position: index + 1,
  }));
}

export function buildEditionMetadata(
  pages: ReaderPage[],
  idmlFileName: string,
): { title: string; description: string; coverImage: string } {
  const coverPage = pages.find((p) => p.template === "cover");
  const title =
    coverPage?.content.title ||
    idmlFileName.replace(/\.idml$/i, "") ||
    "Untitled Edition";
  const description = coverPage?.content.standfirst || "";
  const coverImage = coverPage?.content.imageUrl || "";

  return { title, description, coverImage };
}
