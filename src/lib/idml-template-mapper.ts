import type { ReaderPage, ReaderPageTemplate, ReaderPageContent } from '@/features/magazine/domain/types';
import type { ParsedIdmlPage } from './idml-parser';

function detectTemplate(page: ParsedIdmlPage, position: number, total: number): ReaderPageTemplate {
  const { totalWordCount, stories, imageFileNames, textPreview } = page;
  const hasImages = imageFileNames.length > 0;
  const firstStoryTitle = stories[0]?.title?.toLowerCase() || '';
  const previewLower = textPreview.toLowerCase();

  if (position === 0) return 'cover';

  if (position === total - 1) {
    if (totalWordCount < 100) return 'back-cover';
    return 'editor-note';
  }

  if (
    /\b(contents|table of contents|in this issue|what(?:'s|s) inside)\b/.test(firstStoryTitle) ||
    /\b(contents|table of contents|in this issue|what(?:'s|s) inside)\b/.test(previewLower)
  ) {
    return 'contents';
  }

  if (
    /\b(advert|advertisement|sponsor|sponsored)\b/.test(firstStoryTitle) ||
    /\b(advert|advertisement|sponsor|sponsored)\b/.test(previewLower)
  ) {
    if (totalWordCount < 50) return 'ad';
  }

  if (
    /\b(editor('?s)? note|from the editor|editorial|letter from)\b/.test(firstStoryTitle) ||
    /\b(editor('?s)? note|from the editor|editorial|letter from)\b/.test(previewLower)
  ) {
    return 'editor-note';
  }

  if (
    /\b(profile|spotlight|member spotlight|interview)\b/.test(firstStoryTitle) ||
    /\b(profile|spotlight|member spotlight|interview)\b/.test(previewLower)
  ) {
    return position % 2 === 0 ? 'feature-left' : 'feature-right';
  }

  if (totalWordCount > 600 && hasImages) {
    return position % 2 === 0 ? 'feature-left' : 'feature-right';
  }

  if (totalWordCount > 400) {
    return position % 2 === 0 ? 'feature-left' : 'feature-right';
  }

  if (totalWordCount < 30 && hasImages) {
    return 'ad';
  }

  if (totalWordCount < 100 && hasImages) {
    return position % 2 === 0 ? 'feature-left' : 'feature-right';
  }

  return position % 2 === 0 ? 'feature-left' : 'feature-right';
}

function buildContent(page: ParsedIdmlPage, template: ReaderPageTemplate): ReaderPageContent {
  const combinedText = page.stories.map((s) => s.text).join('\n\n');
  const firstTitle = page.stories[0]?.title || '';
  const firstImage = page.imageFileNames[0] || '';

  switch (template) {
    case 'cover':
      return {
        title: firstTitle || 'Magazine Edition',
        body: '',
        standfirst: page.stories.slice(1).map((s) => s.title).join(' · '),
        imageUrl: firstImage,
        imageUrls: page.imageFileNames,
      };

    case 'contents':
      return {
        title: firstTitle || 'In This Issue',
        body: '',
        items: page.stories.map((s) => ({
          title: s.title || 'Untitled',
          page: '',
        })),
      };

    case 'editor-note':
      return {
        title: firstTitle || "Editor's Note",
        author: '',
        body: combinedText,
        imageUrl: firstImage,
        imageUrls: page.imageFileNames,
      };

    case 'ad':
      return {
        title: firstTitle || 'Advertisement',
        body: '',
        imageUrl: firstImage,
        label: 'Advertisement',
      };

    case 'back-cover':
      return {
        title: firstTitle || 'Until Next Time',
        body: combinedText,
        imageUrl: firstImage,
        imageUrls: page.imageFileNames,
      };

    case 'feature-left':
    case 'feature-right':
    case 'feature-full':
    default:
      return {
        title: firstTitle || 'Feature',
        author: '',
        body: combinedText,
        standfirst: combinedText.split(/\n{2,}/)[0]?.split(/(?<=[.!?])\s+/)[0]?.slice(0, 180) || '',
        imageUrl: firstImage,
        imageUrls: page.imageFileNames,
        pullQuotes: [],
      };
  }
}

function createPageId(position: number): string {
  return `idml-page-${position + 1}-${Date.now().toString(36)}`;
}

export function mapIdmlToReaderPages(pages: ParsedIdmlPage[]): ReaderPage[] {
  const total = pages.length;

  return pages
    .filter((page) => page.stories.length > 0 || page.imageFileNames.length > 0)
    .map((page, index) => {
      const template = detectTemplate(page, index, total);
      const content = buildContent(page, template);

      return {
        id: createPageId(index),
        position: index,
        template,
        content,
      };
    });
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
