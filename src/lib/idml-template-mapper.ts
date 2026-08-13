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
function detectAdPage(page: ParsedIdmlPage): boolean {
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

  // --- 2) NEGATIVE: reserved special pages are never ads. ---
  if (
    labelSet.has("editorsframe") ||
    labelSet.has("contentsframe") ||
    labelSet.has("titleframe") // explicit TitleFrame means the page was authored as an article
  ) {
    return false;
  }

  // Long article bodies are never ads. Continuation pages of long features
  // almost always have word counts of 120+ even without any title frame.
  if ((page.totalWordCount || 0) >= 120) return false;

  // --- 3) HEURISTIC fallback (forgotten AdFrame labels on pure ad pages) ---
  const hasAnyGraphic = (page.imageFileNames?.length || 0) > 0 ||
    (page.logoImageFileNames?.length || 0) > 0;
  const hasExplicitBodyFrame = labelSet.has("bodyframe");
  const hasArticleContent = page.stories.some((story) => {
    const wc = countWords(story.text || "");
    // Story with >= 30 real words = editorial, not an ad (ads have short copy)
    return wc >= 30;
  });
  if (hasExplicitBodyFrame || hasArticleContent) return false;
  // If we reach here: no explicit label, no special page, low word count,
  // no long story, no explicit body frame. If there are graphics placed → AD.
  return hasAnyGraphic;
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
  return detectTitleFrame(entry.story, frameIndex);
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
  } | null,
) {
  if (!article) return;
  articles.push({
    title: article.title,
    author: article.author,
    body: article.bodyParts.join("\n\n"),
    images: article.images,
    startPage: article.startPage,
    endPage: article.endPage,
    pagePositions: article.pagePositions,
    pageBodies: article.pageBodies,
  });
}

function getPageImages(
  page: ParsedIdmlPage,
  fallbacks: string[] = [],
): string[] {
  const logoSet = new Set<string>(page?.logoImageFileNames || []);
  const contentOnly = (page?.imageFileNames || []).filter(
    (name) => !logoSet.has(name),
  );
  return uniqueStrings([
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

export function detectArticles(pages: ParsedIdmlPage[]): Article[] {
  const articles: Article[] = [];
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

  for (const page of pages) {
    if (detectAdPage(page)) {
      pushArticle(articles, currentArticle);
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
      pushArticle(articles, currentArticle);

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
        title: titleStory?.title || "",
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

  pushArticle(articles, currentArticle);

  return articles;
}

function buildFeatureContent(
  article: Article,
  page: ParsedIdmlPage,
  pageNum: number,
  position: "left" | "right" | "full",
): ReaderPageContent {
  const isFirstPage = pageNum === article.startPage;
  const bodyText = article.pageBodies[pageNum] || getPageBodyText(page);
  const pageImages = getPageImages(page, article.images);
  const imageUrl = pageImages[0] || article.images[0] || "";
  const logos = getLogoImages(page);
  const logoHero = logos[0] || "";
  const standfirst = isFirstPage ? getStandfirst(bodyText || article.body) : "";
  const isContinuation = !isFirstPage;

  return {
    title: article.title,
    author: article.author || undefined,
    name: article.author || undefined,
    body: bodyText,
    standfirst: isFirstPage ? standfirst : undefined,
    imageUrl,
    imageUrls: pageImages,
    image: imageUrl,
    featureImage: imageUrl,
    heroImage: imageUrl,
    mainImage: imageUrl,
    images: pageImages,
    gallery: pageImages,
    additionalImages: pageImages.slice(1),
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
    articles.find((article) => article.title.trim()) || null;
  const coverBody = coverSourcePage
    ? getPageBodyText(coverSourcePage, true)
    : "";
  const coverImages = coverSourcePage
    ? getPageImages(coverSourcePage, coverSourceArticle?.images || [])
    : [];
  const coverLogos = coverSourcePage ? getLogoImages(coverSourcePage) : [];
  const coverLogo = coverLogos[0] || "";

  if (coverSourcePage) {
    result.push({
      id: createPageId("page-cover", coverSourcePage.pageNumber),
      position: 0,
      template: "cover",
      content: {
        title:
          coverSourceArticle?.title || coverSourcePage.stories[0]?.title || "",
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
        (page.stories.length > 0 || page.imageFileNames.length > 0),
    );

  const editorNotePage =
    sortedPages.find((p) => p.labels.includes("EditorsFrame")) ||
    sortedPages.find((p) => p.pageNumber === 5);

  const reservedPageNumbers = new Set<number>([1]);
  for (const page of sortedPages) {
    if (page.labels.includes("ContentsFrame")) {
      reservedPageNumbers.add(page.pageNumber);
    }
  }
  if (editorNotePage) reservedPageNumbers.add(editorNotePage.pageNumber);
  if (lastMeaningfulPage) reservedPageNumbers.add(lastMeaningfulPage.pageNumber);

  if (editorNotePage) {
    const editorStories = getOrderedPageStories(editorNotePage).filter(
      (story) => !shouldIgnoreDecorativeStory(story),
    );
    const combinedText = editorStories
      .map((story) => story.text.trim())
      .filter(Boolean)
      .join("\n\n");
    const editorImages = getPageImages(editorNotePage);
    const editorHero = editorImages[0] || "";
    const editorLogos = getLogoImages(editorNotePage);
    const editorLogo = editorLogos[0] || "";

    result.push({
      id: createPageId("page-editor", editorNotePage.pageNumber),
      position: 0,
      template: "editor-note",
      content: {
        title: "Editor's Note",
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
    if (!article) continue;

    const pagePosition = article.pagePositions.find(
      (p) => p.page === pageNum,
    );
    const position =
      pagePosition?.position || sourcePage.frames[0]?.position || "right";
    const template = getFeatureTemplate(
      position,
      pageNum !== article.startPage,
    );

    result.push({
      id: createPageId(
        `page-${pageNum}`,
        article.title.slice(0, 24) || pageNum,
      ),
      position: 0,
      template,
      content: buildFeatureContent(article, sourcePage, pageNum, position),
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
