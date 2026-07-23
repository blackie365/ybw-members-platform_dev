import type { ReaderPage, ReaderPageTemplate, ReaderPageContent } from '@/features/magazine/domain/types';
import type { ParsedIdmlPage, ParsedIdmlStory, ParsedFrame } from './idml-parser';

export interface Article {
  title: string;
  author: string;
  body: string;
  images: string[];
  startPage: number;
  endPage: number;
  pagePositions: Array<{ page: number; position: 'left' | 'right' | 'full' }>;
}

function detectTitleFrame(
  story: ParsedIdmlStory | undefined,
  frameIndex: number,
): boolean {
  if (!story) return false;
  if (frameIndex !== 0) return false;

  const text = (story.text || '').trim();
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

function extractArticleContent(stories: ParsedIdmlStory[]): {
  title: string;
  author: string;
  body: string;
  images: string[];
} {
  if (stories.length === 0) {
    return { title: '', author: '', body: '', images: [] };
  }

  const firstStory = stories[0];
  const title = firstStory.title || '';
  const allImages = stories.flatMap((s) => s.imageHints);

  const bodyParts = stories.map((s) => s.text).filter(Boolean);
  const body = bodyParts.join('\n\n');

  let author = '';
  const authorMatch = body.match(/(?:by|written by|authored by)\s+([A-Z][a-z]+ [A-Z][a-z]+)/i);
  if (authorMatch) {
    author = authorMatch[1];
  }

  return { title, author, body, images: allImages };
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
    pagePositions: Array<{ page: number; position: 'left' | 'right' | 'full' }>;
  } | null = null;

  for (const page of pages) {
    if (detectAdPage(page)) {
      if (currentArticle) {
        articles.push({
          title: currentArticle.title,
          author: currentArticle.author,
          body: currentArticle.bodyParts.join('\n\n'),
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
          body: currentArticle.bodyParts.join('\n\n'),
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
        title: titleStory?.title || '',
        author: '',
        bodyParts: titleStory ? [titleStory.text] : [],
        images: titleStory ? [...titleStory.imageHints] : [],
        startPage: page.pageNumber,
        endPage: page.pageNumber,
        pagePositions: [{
          page: page.pageNumber,
          position: page.frames[titleFrameIdx].position,
        }],
      };
    } else if (currentArticle) {
      currentArticle.endPage = page.pageNumber;

      for (const story of page.stories) {
        currentArticle.bodyParts.push(story.text);
        currentArticle.images.push(...story.imageHints);
      }

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
      body: currentArticle.bodyParts.join('\n\n'),
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
  pageNum: number,
  position: 'left' | 'right' | 'full',
): ReaderPageContent {
  const isFirstPage = pageNum === article.startPage;
  const bodyText = article.body;
  const standfirst = bodyText.split(/\n{2,}/)[0]?.split(/(?<=[.!?])\s+/)[0]?.slice(0, 180) || '';
  const imageUrl = article.images[0] || '';

  return {
    title: isFirstPage ? article.title : `${article.title} (continued)`,
    author: isFirstPage ? article.author : undefined,
    body: bodyText,
    standfirst: isFirstPage ? standfirst : undefined,
    imageUrl,
    imageUrls: article.images,
    pullQuotes: [],
  };
}

function buildContentsPage(articles: Article[]): ReaderPageContent {
  const items = articles
    .filter((a) => a.title && !/advert|ad\b/i.test(a.title))
    .map((a) => ({
      title: a.title,
      page: String(a.startPage).padStart(2, '0'),
    }));

  return {
    title: 'In This Issue',
    body: '',
    items,
  };
}

export function mapIdmlToReaderPages(pages: ParsedIdmlPage[]): ReaderPage[] {
  const result: ReaderPage[] = [];
  let positionToggle = false;

  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  const articles = detectArticles(sortedPages);

  const contentsPage = sortedPages.find((p) => p.pageNumber === 4);
  if (contentsPage) {
    result.push({
      id: `page-contents-${Date.now().toString(36)}`,
      position: 2,
      template: 'contents',
      content: buildContentsPage(articles),
    });
  }

  const editorNotePage = sortedPages.find((p) => p.pageNumber === 5);
  if (editorNotePage) {
    const combinedText = editorNotePage.stories.map((s) => s.text).join('\n\n');
    const firstTitle = editorNotePage.stories[0]?.title || '';

    result.push({
      id: `page-editor-${Date.now().toString(36)}`,
      position: 3,
      template: 'editor-note',
      content: {
        title: firstTitle || "Editor's Note",
        author: '',
        body: combinedText,
        imageUrl: editorNotePage.imageFileNames[0] || '',
        imageUrls: editorNotePage.imageFileNames,
      },
    });
  }

  for (const article of articles) {
    if (article.title && /^\d+$/.test(article.title.trim())) {
      continue;
    }

    for (let pageNum = article.startPage; pageNum <= article.endPage; pageNum++) {
      if (pageNum === 4 || pageNum === 5) continue;

      const pagePosition = article.pagePositions.find((p) => p.page === pageNum);
      const position = pagePosition?.position || (positionToggle ? 'left' : 'right');
      positionToggle = !positionToggle;

      const template: ReaderPageTemplate = 'feature-left';

      result.push({
        id: `page-${pageNum}-${article.title.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}-${Date.now().toString(36)}`,
        position: pageNum - 1,
        template,
        content: buildFeatureContent(article, pageNum, position),
      });
    }
  }

  result.sort((a, b) => a.position - b.position);

  return result;
}

export function buildEditionMetadata(
  pages: ReaderPage[],
  idmlFileName: string,
): { title: string; description: string; coverImage: string } {
  const coverPage = pages.find((p) => p.template === 'cover');
  const title = coverPage?.content.title || idmlFileName.replace(/\.idml$/i, '') || 'Untitled Edition';
  const description = coverPage?.content.standfirst || '';
  const coverImage = coverPage?.content.imageUrl || '';

  return { title, description, coverImage };
}
