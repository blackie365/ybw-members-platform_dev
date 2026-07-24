import type {
  ReaderPage,
  ReaderPageTemplate,
  ReaderPageContent,
} from "@/features/magazine/domain/types";
import type { ParsedIdmlPage, ParsedIdmlStory } from "./idml-parser";

export interface Article {
  title: string;
  author: string;
  body: string;
  images: string[];
  startPage: number;
  endPage: number;
  pagePositions: Array<{ page: number; position: "left" | "right" | "full" }>;
}

function detectTitleFrame(
  story: ParsedIdmlStory | undefined,
  frameIndex: number,
): boolean {
  if (!story) return false;
  if (frameIndex !== 0) return false;

  const text = (story.text || "").trim();
  if (!text) return false;

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 20) return false;

  const hasTitleStyle = story.paragraphStyles.some((s) =>
    /article.?heading|title|heading|cover.?title|headline/i.test(s),
  );

  return hasTitleStyle || wordCount <= 12;
}

function detectAdPage(page: ParsedIdmlPage): boolean {
  return page.frames.length === 0 && page.stories.length === 0;
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

function getPageImages(
  page: ParsedIdmlPage,
  fallbacks: string[] = [],
): string[] {
  return uniqueStrings([
    ...page.imageFileNames,
    ...getOrderedPageStories(page).flatMap((story) => story.imageHints),
    ...fallbacks,
  ]);
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
  let currentArticle: {
    title: string;
    author: string;
    bodyParts: string[];
    images: string[];
    startPage: number;
    endPage: number;
    pagePositions: Array<{ page: number; position: "left" | "right" | "full" }>;
  } | null = null;

  for (const page of pages) {
    if (detectAdPage(page)) {
      if (currentArticle) {
        articles.push({
          title: currentArticle.title,
          author: currentArticle.author,
          body: currentArticle.bodyParts.join("\n\n"),
          images: currentArticle.images,
          startPage: currentArticle.startPage,
          endPage: currentArticle.endPage,
          pagePositions: currentArticle.pagePositions,
        });
        currentArticle = null;
      }
      continue;
    }

    const titleFrameIdx = page.frames.findIndex((f, idx) => {
      const story = page.stories.find((s) => s.id === f.storyId);
      return detectTitleFrame(story, idx);
    });

    if (titleFrameIdx >= 0) {
      if (currentArticle) {
        articles.push({
          title: currentArticle.title,
          author: currentArticle.author,
          body: currentArticle.bodyParts.join("\n\n"),
          images: currentArticle.images,
          startPage: currentArticle.startPage,
          endPage: currentArticle.endPage,
          pagePositions: currentArticle.pagePositions,
        });
      }

      const titleStory = page.stories.find(
        (s) => s.id === page.frames[titleFrameIdx].storyId,
      );

      currentArticle = {
        title: titleStory?.title || "",
        author: "",
        bodyParts: titleStory ? [titleStory.text] : [],
        images: getPageImages(page, titleStory ? titleStory.imageHints : []),
        startPage: page.pageNumber,
        endPage: page.pageNumber,
        pagePositions: [
          {
            page: page.pageNumber,
            position: page.frames[titleFrameIdx].position,
          },
        ],
      };
    } else if (currentArticle) {
      currentArticle.endPage = page.pageNumber;

      for (const story of page.stories) {
        currentArticle.bodyParts.push(story.text);
      }

      currentArticle.images.push(...getPageImages(page));

      for (const frame of page.frames) {
        const existing = currentArticle.pagePositions.find(
          (p) => p.page === page.pageNumber,
        );
        if (!existing) {
          currentArticle.pagePositions.push({
            page: page.pageNumber,
            position: frame.position,
          });
        }
      }
    }
  }

  if (currentArticle) {
    articles.push({
      title: currentArticle.title,
      author: currentArticle.author,
      body: currentArticle.bodyParts.join("\n\n"),
      images: currentArticle.images,
      startPage: currentArticle.startPage,
      endPage: currentArticle.endPage,
      pagePositions: currentArticle.pagePositions,
    });
  }

  return articles;
}

function buildFeatureContent(
  article: Article,
  page: ParsedIdmlPage,
  pageNum: number,
  position: "left" | "right" | "full",
): ReaderPageContent {
  const isFirstPage = pageNum === article.startPage;
  const bodyText = getPageBodyText(page);
  const pageImages = getPageImages(page, article.images);
  const imageUrl = pageImages[0] || article.images[0] || "";
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
  const pageByNumber = new Map(
    sortedPages.map((page) => [page.pageNumber, page]),
  );

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

  const editorNotePage = sortedPages.find((p) => p.pageNumber === 5);
  if (editorNotePage) {
    const combinedText = getPageBodyText(editorNotePage, true);
    const firstTitle = editorNotePage.stories[0]?.title || "";

    result.push({
      id: createPageId("page-editor", editorNotePage.pageNumber),
      position: 0,
      template: "editor-note",
      content: {
        title: firstTitle || "Editor's Note",
        author: "",
        body: combinedText,
        imageUrl: getPageImages(editorNotePage)[0] || "",
        imageUrls: getPageImages(editorNotePage),
      },
    });
  }

  for (const article of articles) {
    if (article.title && /^\d+$/.test(article.title.trim())) {
      continue;
    }

    for (
      let pageNum = article.startPage;
      pageNum <= article.endPage;
      pageNum++
    ) {
      if (pageNum === 4 || pageNum === 5) continue;
      if (pageNum === 1 && coverSourcePage?.pageNumber === 1) continue;

      const sourcePage = pageByNumber.get(pageNum);
      if (!sourcePage) continue;

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
  }

  const lastMeaningfulPage = [...sortedPages]
    .reverse()
    .find(
      (page) =>
        page.pageNumber > 5 &&
        (page.stories.length > 0 || page.imageFileNames.length > 0),
    );

  if (lastMeaningfulPage) {
    const lastImages = getPageImages(lastMeaningfulPage);
    const lastArticle = [...articles]
      .reverse()
      .find((article) => article.endPage <= lastMeaningfulPage.pageNumber);

    result.push({
      id: createPageId("page-back-cover", lastMeaningfulPage.pageNumber),
      position: 0,
      template: "back-cover",
      content: {
        title: "See You Next Issue",
        body: "Thank you for reading Yorkshire BusinessWoman in our digital reader. Browse the archive for more editions and return soon for the next issue.",
        imageUrl: lastImages[0] || "",
        imageUrls: lastImages,
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
