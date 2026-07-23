import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

export interface ParsedIdmlStory {
  path: string;
  title: string;
  text: string;
  imageHints: string[];
}

export interface ParsedIdmlImage {
  fileName: string;
  data: Buffer;
  mimeType: string;
}

export interface ParsedIdmlPage {
  pageNumber: number;
  spreadIndex: number;
  stories: ParsedIdmlStory[];
  imageFileNames: string[];
  totalWordCount: number;
  textPreview: string;
}

export interface ParsedIdml {
  pages: ParsedIdmlPage[];
  images: ParsedIdmlImage[];
  pageCount: number;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTextFromStory(xml: string): { title: string; text: string; imageHints: string[] } {
  const contentMatches = [...xml.matchAll(/<Content>([\s\S]*?)<\/Content>/g)];
  const rawPieces = contentMatches
    .map((m) => decodeXmlEntities(m[1] || '').trim())
    .filter(Boolean);

  const text = normalizeWhitespace(rawPieces.join('\n'));
  const title = normalizeWhitespace(rawPieces[0] || '').split('\n')[0] || '';

  const imageHints = [
    ...xml.matchAll(/LinkResourceURI="file:[^"]*\/([^"\/]+\.(?:png|jpe?g|webp|gif|svg))"/gi),
    ...xml.matchAll(/LinkResourceURI="[^"]*\/([^"\/]+\.(?:png|jpe?g|webp|gif|svg))"/gi),
  ]
    .map((m) => String(m[1] || '').trim())
    .filter(Boolean);

  return { title, text, imageHints };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function getFileMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

function parseSpreadPages(designmapXml: string): number {
  try {
    const doc = new DOMParser().parseFromString(designmapXml, 'text/xml');
    const spreads = doc.getElementsByTagName('Spread');
    let maxPage = 0;

    for (let i = 0; i < spreads.length; i++) {
      const spread = spreads[i];
      const pages = spread.getElementsByTagName('Page');
      for (let j = 0; j < pages.length; j++) {
        const pageSelf = pages[j].getAttribute('Self');
        if (pageSelf) {
          const pageMatch = pageSelf.match(/Page_(\d+)/i);
          if (pageMatch) {
            maxPage = Math.max(maxPage, parseInt(pageMatch[1], 10));
          }
        }
      }
    }

    return maxPage || 0;
  } catch {
    return 0;
  }
}

function mapStoriesToPages(
  stories: ParsedIdmlStory[],
  totalPageCount: number,
): ParsedIdmlPage[] {
  if (stories.length === 0) return [];

  if (stories.length >= totalPageCount && totalPageCount > 0) {
    return stories.slice(0, totalPageCount).map((story, i) => ({
      pageNumber: i + 1,
      spreadIndex: Math.floor(i / 2),
      stories: [story],
      imageFileNames: story.imageHints,
      totalWordCount: countWords(story.text),
      textPreview: story.text.replace(/\s+/g, ' ').slice(0, 180),
    }));
  }

  const pages: ParsedIdmlPage[] = [];
  const perPage = Math.max(1, Math.ceil(stories.length / Math.max(1, totalPageCount)));

  for (let pageIdx = 0; pageIdx < totalPageCount; pageIdx++) {
    const storyStart = pageIdx * perPage;
    const storyEnd = Math.min(storyStart + perPage, stories.length);
    const pageStories = stories.slice(storyStart, storyEnd);

    if (pageStories.length === 0) {
      pages.push({
        pageNumber: pageIdx + 1,
        spreadIndex: Math.floor(pageIdx / 2),
        stories: [],
        imageFileNames: [],
        totalWordCount: 0,
        textPreview: '',
      });
      continue;
    }

    const allImageHints = pageStories.flatMap((s) => s.imageHints);
    const combinedText = pageStories.map((s) => s.text).join('\n\n');

    pages.push({
      pageNumber: pageIdx + 1,
      spreadIndex: Math.floor(pageIdx / 2),
      stories: pageStories,
      imageFileNames: allImageHints,
      totalWordCount: countWords(combinedText),
      textPreview: combinedText.replace(/\s+/g, ' ').slice(0, 180),
    });
  }

  return pages;
}

export async function parseIdml(fileBuffer: Buffer): Promise<ParsedIdml> {
  const zip = await JSZip.loadAsync(fileBuffer);

  let designmapXml = '';
  const designmapFile = zip.file('designmap.xml');
  if (designmapFile) {
    designmapXml = await designmapFile.async('text');
  }

  const storyFiles = Object.keys(zip.files).filter((p) => /^Stories\/.+\.xml$/i.test(p));
  storyFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const stories: ParsedIdmlStory[] = [];
  for (const path of storyFiles) {
    const xml = await zip.files[path].async('text');
    const parsed = extractTextFromStory(xml);
    if (!parsed.text) continue;

    stories.push({
      path,
      title: parsed.title,
      text: normalizeWhitespace(parsed.text),
      imageHints: parsed.imageHints,
    });
  }

  const imageFiles = Object.keys(zip.files).filter((p) =>
    /^Graphics\/.+\.(png|jpe?g|gif|webp|svg)$/i.test(p),
  );

  const images: ParsedIdmlImage[] = [];
  for (const path of imageFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const data = await file.async('nodebuffer');
    const fileName = path.split('/').pop() || path;
    images.push({
      fileName,
      data,
      mimeType: getFileMimeType(fileName),
    });
  }

  let pageCount = parseSpreadPages(designmapXml);

  if (pageCount === 0) {
    pageCount = stories.length || images.length || 1;
  }

  const pages = mapStoriesToPages(stories, pageCount);

  return { pages, images, pageCount };
}
