import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

export interface ParsedFrame {
  frameSelf: string;
  storyId: string;
  isTitle: boolean;
  position: 'left' | 'right' | 'full';
  order: number;
}

export interface ParsedIdmlStory {
  id: string;
  path: string;
  title: string;
  text: string;
  imageHints: string[];
  paragraphStyles: string[];
}

export interface ParsedIdmlImage {
  fileName: string;
  data: Buffer;
  mimeType: string;
}

export interface ParsedIdmlPage {
  pageNumber: number;
  spreadIndex: number;
  frames: ParsedFrame[];
  stories: ParsedIdmlStory[];
  imageFileNames: string[];
  totalWordCount: number;
  textPreview: string;
}

export interface ParsedIdml {
  pages: ParsedIdmlPage[];
  images: ParsedIdmlImage[];
  storyMap: Map<string, ParsedIdmlStory>;
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

function extractStoryContent(xml: string): {
  title: string;
  text: string;
  imageHints: string[];
  paragraphStyles: string[];
} {
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

  const paragraphStyles = [
    ...xml.matchAll(/AppliedParagraphStyle="([^"]+)"/g),
  ]
    .map((m) => m[1])
    .filter(Boolean);

  return { title, text, imageHints, paragraphStyles };
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
    case 'pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}

function supportsEmbeddedImageExtraction(fileName: string): boolean {
  return /^.+\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
}

function extractFileNameFromUri(uri: string, fallbackFormat?: string): string {
  const cleanUri = decodeURIComponent(String(uri || '').trim())
    .replace(/^file:/i, '')
    .replace(/\\/g, '/');
  const fromUri = cleanUri.split('/').pop()?.trim() || '';
  if (fromUri) return fromUri;

  const format = String(fallbackFormat || '')
    .replace(/^\$ID\//i, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
  if (format) return `embedded-asset.${format}`;

  return 'embedded-asset.bin';
}

function isTitleFrame(
  story: ParsedIdmlStory | undefined,
  frameIndex: number,
): boolean {
  if (!story) return false;
  if (frameIndex !== 0) return false;

  const text = (story.text || '').trim();
  if (!text) return false;

  const hasTitleStyle = story.paragraphStyles.some((s) =>
    /article.?heading|title|heading|cover.?title|headline/i.test(s),
  );

  const wordCount = countWords(text);
  const isShort = wordCount <= 15;

  return hasTitleStyle || isShort;
}

function parseSpreadFrames(spreadXml: string): Array<{
  pageName: string;
  pageTransform: { tx: number; ty: number };
  pageBounds: { top: number; left: number; bottom: number; right: number };
  frames: ParsedFrame[];
  imageFileNames: string[];
}> {
  const result: Array<{
    pageName: string;
    pageTransform: { tx: number; ty: number };
    pageBounds: { top: number; left: number; bottom: number; right: number };
    frames: ParsedFrame[];
    imageFileNames: string[];
  }> = [];

  const doc = new DOMParser().parseFromString(spreadXml, 'text/xml');

  const pages = doc.getElementsByTagName('Page');
  const pageInfo: Array<{
    self: string;
    name: string;
    tx: number;
    ty: number;
    bounds: { top: number; left: number; bottom: number; right: number };
  }> = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const self = page.getAttribute('Self') || '';
    const name = page.getAttribute('Name') || '';
    const transform = (page.getAttribute('ItemTransform') || '0 0 0 0 0 0').split(' ').map(Number);
    const boundsStr = page.getAttribute('GeometricBounds') || '0 0 700 482';
    const boundsValues = boundsStr.split(' ').map(Number);

    pageInfo.push({
      self,
      name,
      tx: transform[4] || 0,
      ty: transform[5] || 0,
      bounds: {
        top: boundsValues[0] || 0,
        left: boundsValues[1] || 0,
        bottom: boundsValues[2] || 700,
        right: boundsValues[3] || 482,
      },
    });
  }

  function getAssignedPage(frameX: number): {
    position: 'left' | 'right' | 'full';
    page: typeof pageInfo[number];
  } {
    if (pageInfo.length === 1) {
      return {
        position: 'full',
        page: pageInfo[0],
      };
    }

    if (pageInfo.length >= 2) {
      const page1Center = pageInfo[0].tx + (pageInfo[0].bounds.right / 2);
      const page2Center = pageInfo[1].tx + (pageInfo[1].bounds.right / 2);
      const distToPage1 = Math.abs(frameX - page1Center);
      const distToPage2 = Math.abs(frameX - page2Center);

      if (distToPage1 < distToPage2) {
        return { position: 'left', page: pageInfo[0] };
      }

      return { position: 'right', page: pageInfo[1] };
    }

    return {
      position: 'full',
      page: {
        self: '',
        name: '1',
        tx: 0,
        ty: 0,
        bounds: { top: 0, left: 0, bottom: 700, right: 482 },
      },
    };
  }

  function getOrCreatePageEntry(pageName: string, assignedPage: typeof pageInfo[number]) {
    const existing = result.find((r) => r.pageName === pageName);
    if (existing) return existing;

    const entry = {
      pageName,
      pageTransform: { tx: assignedPage.tx, ty: assignedPage.ty },
      pageBounds: assignedPage.bounds,
      frames: [],
      imageFileNames: [],
    };
    result.push(entry);
    return entry;
  }

  const textFrames = doc.getElementsByTagName('TextFrame');
  let frameOrder = 0;

  for (let i = 0; i < textFrames.length; i++) {
    const frame = textFrames[i];
    const frameSelf = frame.getAttribute('Self') || '';
    const parentStory = frame.getAttribute('ParentStory') || '';

    const frameTransform = (frame.getAttribute('ItemTransform') || '0 0 0 0 0 0').split(' ').map(Number);
    const frameX = frameTransform[4] || 0;

    const { position, page: assignedPage } = getAssignedPage(frameX);
    const pageEntry = getOrCreatePageEntry(assignedPage.name, assignedPage);
    pageEntry.frames.push({
      frameSelf,
      storyId: parentStory,
      isTitle: false,
      position,
      order: frameOrder++,
    });
  }

  const graphicTags = ['Rectangle', 'Oval', 'Polygon'];
  for (const tagName of graphicTags) {
    const graphicFrames = doc.getElementsByTagName(tagName);
    for (let i = 0; i < graphicFrames.length; i++) {
      const frame = graphicFrames[i];
      if ((frame.getAttribute('ContentType') || '') !== 'GraphicType') continue;

      const linkNodes = frame.getElementsByTagName('Link');
      if (linkNodes.length === 0) continue;

      const frameTransform = (frame.getAttribute('ItemTransform') || '0 0 0 0 0 0').split(' ').map(Number);
      const frameX = frameTransform[4] || 0;
      const { page: assignedPage } = getAssignedPage(frameX);
      const pageEntry = getOrCreatePageEntry(assignedPage.name, assignedPage);

      for (let linkIdx = 0; linkIdx < linkNodes.length; linkIdx++) {
        const linkNode = linkNodes[linkIdx];
        const fileName = extractFileNameFromUri(
          linkNode.getAttribute('LinkResourceURI') || '',
          linkNode.getAttribute('LinkResourceFormat') || '',
        );

        if (fileName && !pageEntry.imageFileNames.includes(fileName)) {
          pageEntry.imageFileNames.push(fileName);
        }
      }
    }
  }

  return result;
}

export async function parseIdml(fileBuffer: Buffer): Promise<ParsedIdml> {
  const zip = await JSZip.loadAsync(fileBuffer);

  const storyFiles = Object.keys(zip.files).filter((p) => /^Stories\/.+\.xml$/i.test(p));
  storyFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const storyMap = new Map<string, ParsedIdmlStory>();

  for (const path of storyFiles) {
    const xml = await zip.files[path].async('text');
    const content = extractStoryContent(xml);

    const selfMatch = xml.match(/<Story Self="([^"]+)"/);
    const storyId = selfMatch?.[1] || path.replace(/^Stories\//, '').replace(/\.xml$/i, '');

    if (!content.text && content.imageHints.length === 0) continue;

    storyMap.set(storyId, {
      id: storyId,
      path,
      title: content.title,
      text: normalizeWhitespace(content.text),
      imageHints: content.imageHints,
      paragraphStyles: content.paragraphStyles,
    });
  }

  const imagesByFileName = new Map<string, ParsedIdmlImage>();
  const imageFiles = Object.keys(zip.files).filter((p) =>
    /^Graphics\/.+\.(png|jpe?g|gif|webp|svg)$/i.test(p),
  );

  for (const path of imageFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const data = await file.async('nodebuffer');
    const fileName = path.split('/').pop() || path;
    imagesByFileName.set(fileName, {
      fileName,
      data,
      mimeType: getFileMimeType(fileName),
    });
  }

  const spreadFiles = Object.keys(zip.files).filter((p) => /^Spreads\/.+\.xml$/i.test(p));
  spreadFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const allPageData: Array<{
    pageNumber: number;
    spreadIndex: number;
    frames: ParsedFrame[];
    imageFileNames: string[];
  }> = [];

  let pageNumber = 1;

  for (let spreadIdx = 0; spreadIdx < spreadFiles.length; spreadIdx++) {
    const spreadXml = await zip.files[spreadFiles[spreadIdx]].async('text');
    const spreadData = parseSpreadFrames(spreadXml);
    const spreadDoc = new DOMParser().parseFromString(spreadXml, 'text/xml');
    const spreadImages = spreadDoc.getElementsByTagName('Image');

    for (let imageIdx = 0; imageIdx < spreadImages.length; imageIdx++) {
      const imageNode = spreadImages[imageIdx];
      const linkNode = imageNode.getElementsByTagName('Link')[0];
      if (!linkNode) continue;

      const fileName = extractFileNameFromUri(
        linkNode.getAttribute('LinkResourceURI') || '',
        linkNode.getAttribute('LinkResourceFormat') || '',
      );
      if (!supportsEmbeddedImageExtraction(fileName) || imagesByFileName.has(fileName)) continue;

      const propertiesNodes = imageNode.getElementsByTagName('Properties');
      let encodedContents = '';
      for (let propsIdx = 0; propsIdx < propertiesNodes.length; propsIdx++) {
        const contentsNode = propertiesNodes[propsIdx].getElementsByTagName('Contents')[0];
        const candidate = String(contentsNode?.textContent || '').replace(/\s+/g, '').trim();
        if (!candidate) continue;
        encodedContents = candidate;
        break;
      }

      if (!encodedContents) continue;

      try {
        const data = Buffer.from(encodedContents, 'base64');
        if (data.length === 0) continue;

        imagesByFileName.set(fileName, {
          fileName,
          data,
          mimeType: getFileMimeType(fileName),
        });
      } catch {
        // Ignore malformed embedded content and fall back to filename hints only.
      }
    }

    for (const pageData of spreadData) {
      const pageName = parseInt(pageData.pageName, 10);
      if (!isNaN(pageName)) {
        pageNumber = pageName;
      }

      const framesWithTitles = pageData.frames.map((frame, idx) => {
        const story = storyMap.get(frame.storyId);
        return {
          ...frame,
          isTitle: isTitleFrame(story, idx),
        };
      });

      allPageData.push({
        pageNumber,
        spreadIndex: spreadIdx,
        frames: framesWithTitles,
        imageFileNames: pageData.imageFileNames,
      });

      pageNumber++;
    }
  }

  allPageData.sort((a, b) => a.pageNumber - b.pageNumber);

  const pages: ParsedIdmlPage[] = allPageData.map((pageData) => {
    const storyIds = new Set(pageData.frames.map((f) => f.storyId));
    const pageStories: ParsedIdmlStory[] = [];
    const allImageHints: string[] = [...pageData.imageFileNames];

    for (const storyId of storyIds) {
      const story = storyMap.get(storyId);
      if (story) {
        pageStories.push(story);
        allImageHints.push(...story.imageHints);
      }
    }

    const combinedText = pageStories.map((s) => s.text).join('\n\n');

    return {
      pageNumber: pageData.pageNumber,
      spreadIndex: pageData.spreadIndex,
      frames: pageData.frames,
      stories: pageStories,
      imageFileNames: allImageHints,
      totalWordCount: countWords(combinedText),
      textPreview: combinedText.replace(/\s+/g, ' ').slice(0, 180),
    };
  });

  const maxPage = pages.length > 0 ? Math.max(...pages.map((p) => p.pageNumber)) : 0;

  return { pages, images: [...imagesByFileName.values()], storyMap, pageCount: maxPage };
}
