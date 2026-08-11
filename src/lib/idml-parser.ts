import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

export interface ParsedFrame {
  frameSelf: string;
  storyId: string;
  isTitle: boolean;
  label: string;
  position: 'left' | 'right' | 'full';
  order: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
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
  labels: string[];
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
  return /^.+\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(fileName);
}

const IMAGE_MAGIC_BYTES: Record<string, Array<{ bytes: number[]; offset?: number }>> = {
  png: [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  jpg: [{ bytes: [0xff, 0xd8, 0xff] }],
  jpeg: [{ bytes: [0xff, 0xd8, 0xff] }],
  gif: [{ bytes: [0x47, 0x49, 0x46, 0x38] }],
  webp: [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  ],
  svg: [
    { bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c] },
    { bytes: [0x3c, 0x73, 0x76, 0x67] },
  ],
  pdf: [{ bytes: [0x25, 0x50, 0x44, 0x46] }],
};

function looksLikeImageData(data: Buffer, fileName: string): boolean {
  if (!data || data.length === 0) return false;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const signatures = IMAGE_MAGIC_BYTES[ext];
  if (!signatures) return false;
  return signatures.every(({ bytes, offset = 0 }) => {
    if (data.length < offset + bytes.length) return false;
    return bytes.every((byte, index) => data[offset + index] === byte);
  });
}

function extractEmbeddedImageContents(contentsNode: any, fileName: string): string {
  let candidate = String(contentsNode?.textContent || '').replace(/\s+/g, '').trim();
  if (!candidate) return '';

  if (/^<\?xpacket/i.test(candidate) || /x:xmpmeta/i.test(candidate.slice(0, 4000))) {
    return '';
  }

  const data = Buffer.from(candidate, 'base64');
  if (data.length === 0 || !looksLikeImageData(data, fileName)) {
    return '';
  }

  return candidate;
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

function getFrameBounds(frame: any): {
  top: number;
  left: number;
  bottom: number;
  right: number;
} {
  const pathPoints = frame.getElementsByTagName('PathPointType');
  const verticals: number[] = [];
  const horizontals: number[] = [];

  for (let i = 0; i < pathPoints.length; i++) {
    const anchor = String(pathPoints[i].getAttribute('Anchor') || '').trim();
    if (!anchor) continue;
    const [vertical, horizontal] = anchor.split(/\s+/).map(Number);
    if (Number.isFinite(vertical)) verticals.push(vertical);
    if (Number.isFinite(horizontal)) horizontals.push(horizontal);
  }

  if (verticals.length === 0 || horizontals.length === 0) {
    return { top: 0, left: 0, bottom: 0, right: 0 };
  }

  return {
    top: Math.min(...verticals),
    left: Math.min(...horizontals),
    bottom: Math.max(...verticals),
    right: Math.max(...horizontals),
  };
}

function getFrameLabel(element: any): string {
  const propertiesNodes = element.getElementsByTagName('Properties');
  for (let i = 0; i < propertiesNodes.length; i++) {
    const propertiesNode = propertiesNodes[i];
    if (propertiesNode.parentNode !== element) continue;

    const labelNodes = propertiesNode.getElementsByTagName('Label');
    for (let j = 0; j < labelNodes.length; j++) {
      const labelNode = labelNodes[j];
      if (labelNode.parentNode !== propertiesNode) continue;

      const kvpNodes = labelNode.getElementsByTagName('KeyValuePair');
      for (let k = 0; k < kvpNodes.length; k++) {
        if (kvpNodes[k].getAttribute('Key') !== 'Label') continue;
        return String(kvpNodes[k].getAttribute('Value') || '')
          .trim()
          .replace(/\.+$/, '');
      }
    }
  }
  return '';
}

function isTitleFrame(
  story: ParsedIdmlStory | undefined,
  frameIndex: number,
  label = '',
): boolean {
  if (label === 'TitleFrame') return true;
  if (!story) return false;

  const text = (story.text || '').trim();
  if (!text) return false;

  const hasTitleStyle = story.paragraphStyles.some((s) =>
    /article.?heading|cover.?title|headline/i.test(s),
  );

  const wordCount = countWords(text);
  const isShort = wordCount <= 15;

  if (hasTitleStyle) return true;
  return frameIndex === 0 && isShort;
}

function parseSpreadFrames(spreadXml: string): Array<{
  pageName: string;
  pageTransform: { tx: number; ty: number };
  pageBounds: { top: number; left: number; bottom: number; right: number };
  frames: ParsedFrame[];
  imageFileNames: string[];
  labels: string[];
}> {
  const result: Array<{
    pageName: string;
    pageTransform: { tx: number; ty: number };
    pageBounds: { top: number; left: number; bottom: number; right: number };
    frames: ParsedFrame[];
    imageFileNames: string[];
    labels: string[];
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
      labels: [],
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
    const bounds = getFrameBounds(frame);
    const label = getFrameLabel(frame);

    const frameTransform = (frame.getAttribute('ItemTransform') || '0 0 0 0 0 0').split(' ').map(Number);
    const frameX = frameTransform[4] || 0;

    const { position, page: assignedPage } = getAssignedPage(frameX);
    const pageEntry = getOrCreatePageEntry(assignedPage.name, assignedPage);
    pageEntry.frames.push({
      frameSelf,
      storyId: parentStory,
      isTitle: false,
      label,
      position,
      order: frameOrder++,
      top: bounds.top,
      left: bounds.left,
      bottom: bounds.bottom,
      right: bounds.right,
    });
    if (label) pageEntry.labels.push(label);
  }

  const graphicTags = ['Rectangle', 'Oval', 'Polygon'];
  for (const tagName of graphicTags) {
    const graphicFrames = doc.getElementsByTagName(tagName);
    for (let i = 0; i < graphicFrames.length; i++) {
      const frame = graphicFrames[i];

      const frameTransform = (frame.getAttribute('ItemTransform') || '0 0 0 0 0 0').split(' ').map(Number);
      const frameX = frameTransform[4] || 0;
      const { page: assignedPage } = getAssignedPage(frameX);
      const pageEntry = getOrCreatePageEntry(assignedPage.name, assignedPage);

      const label = getFrameLabel(frame);
      if (label) pageEntry.labels.push(label);

      if ((frame.getAttribute('ContentType') || '') !== 'GraphicType') continue;

      const linkNodes = frame.getElementsByTagName('Link');
      if (linkNodes.length === 0) continue;

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

  const groupNodes = doc.getElementsByTagName('Group');
  for (let i = 0; i < groupNodes.length; i++) {
    const group = groupNodes[i];
    const label = getFrameLabel(group);
    if (!label) continue;

    const childPages = new Set<string>();
    const childTags = ['TextFrame', 'Rectangle', 'Oval', 'Polygon'];
    for (const childTag of childTags) {
      const children = group.getElementsByTagName(childTag);
      for (let j = 0; j < children.length; j++) {
        const childTransform = (children[j].getAttribute('ItemTransform') || '0 0 0 0 0 0').split(' ').map(Number);
        childPages.add(getAssignedPage(childTransform[4] || 0).page.name);
      }
    }

    for (const pageName of childPages) {
      const assignedPage = pageInfo.find((p) => p.name === pageName) || pageInfo[0];
      const pageEntry = getOrCreatePageEntry(pageName, assignedPage);
      pageEntry.labels.push(label);
    }
  }

  const imageNodes = doc.getElementsByTagName('Image');
  for (let i = 0; i < imageNodes.length; i++) {
    const imageNode = imageNodes[i];
    const label = getFrameLabel(imageNode);
    if (!label) continue;

    const imageTransform = (imageNode.getAttribute('ItemTransform') || '0 0 0 0 0 0').split(' ').map(Number);
    const { page: assignedPage } = getAssignedPage(imageTransform[4] || 0);
    const pageEntry = getOrCreatePageEntry(assignedPage.name, assignedPage);
    pageEntry.labels.push(label);
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
    /^Graphics\/.+\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(p),
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
    labels: string[];
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
        const candidate = extractEmbeddedImageContents(contentsNode, fileName);
        if (!candidate) continue;
        encodedContents = candidate;
        break;
      }

      if (!encodedContents) continue;

      const data = Buffer.from(encodedContents, 'base64');
      if (data.length === 0 || !looksLikeImageData(data, fileName)) continue;

      imagesByFileName.set(fileName, {
        fileName,
        data,
        mimeType: getFileMimeType(fileName),
      });
    }

    const pdfNodes = spreadDoc.getElementsByTagName('PDF');
    for (let pdfIdx = 0; pdfIdx < pdfNodes.length; pdfIdx++) {
      const pdfNode = pdfNodes[pdfIdx];

      const parentNode = pdfNode.parentNode;
      if (!parentNode) continue;

      let fileName = '';
      const pdfLinks = (parentNode as any).getElementsByTagName('Link');
      for (let linkIdx = 0; linkIdx < pdfLinks.length; linkIdx++) {
        const linkNode = pdfLinks[linkIdx];
        const candidate = extractFileNameFromUri(
          linkNode.getAttribute('LinkResourceURI') || '',
          linkNode.getAttribute('LinkResourceFormat') || '',
        );
        if (!/\.pdf$/i.test(candidate)) continue;
        fileName = candidate;
        break;
      }

      if (!fileName || !supportsEmbeddedImageExtraction(fileName) || imagesByFileName.has(fileName)) continue;

      let encodedContents = '';
      const pdfPropertiesNodes = pdfNode.getElementsByTagName('Properties');
      for (let propsIdx = 0; propsIdx < pdfPropertiesNodes.length; propsIdx++) {
        const contentsNode = pdfPropertiesNodes[propsIdx].getElementsByTagName('Contents')[0];
        const candidate = extractEmbeddedImageContents(contentsNode, fileName);
        if (!candidate) continue;
        encodedContents = candidate;
        break;
      }

      if (!encodedContents) continue;

      const pdfData = Buffer.from(encodedContents, 'base64');
      if (pdfData.length === 0 || !looksLikeImageData(pdfData, fileName)) continue;

      imagesByFileName.set(fileName, {
        fileName,
        data: pdfData,
        mimeType: getFileMimeType(fileName),
      });
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
          isTitle: isTitleFrame(story, idx, frame.label),
        };
      });

      allPageData.push({
        pageNumber,
        spreadIndex: spreadIdx,
        frames: framesWithTitles,
        imageFileNames: pageData.imageFileNames,
        labels: [...new Set(pageData.labels)],
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
      labels: pageData.labels,
      totalWordCount: countWords(combinedText),
      textPreview: combinedText.replace(/\s+/g, ' ').slice(0, 180),
    };
  });

  const maxPage = pages.length > 0 ? Math.max(...pages.map((p) => p.pageNumber)) : 0;

  return { pages, images: [...imagesByFileName.values()], storyMap, pageCount: maxPage };
}
