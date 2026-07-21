import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

type StoryKind =
  | 'article'
  | 'headline'
  | 'snippet'
  | 'advert'
  | 'utility'
  | 'masthead'
  | 'page_number'
  | 'blank';

type SlotContentHint = 'story' | 'editorial_note' | 'contents' | 'ad' | 'quote' | 'static_copy';

export interface IdmlManifestSourceFile {
  path: string;
  fileName: string;
  baseName: string;
}

export interface IdmlManifestDocument {
  name: string;
  domVersion?: string;
  pageCount: number;
  spreadCount: number;
  storyCount: number;
  labels: Record<string, string>;
  spreadPathsInOrder: string[];
  storyPathsInOrder: string[];
}

export interface IdmlManifestPage {
  id: string;
  name: string;
  self: string;
  spreadPath: string;
  spreadIndex: number;
  pageIndexInSpread: number;
  itemTransformX: number;
  storyIds: string[];
  assetIds: string[];
}

export interface IdmlManifestSpread {
  id: string;
  path: string;
  self: string;
  index: number;
  pageNames: string[];
  storyIds: string[];
  assetIds: string[];
}

export interface IdmlManifestAsset {
  id: string;
  spreadPath: string;
  pageNames: string[];
  objectType: string;
  uri: string;
  decodedPath: string;
  fileName: string;
  format?: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface IdmlManifestStory {
  id: string;
  path: string;
  order: number;
  title: string;
  text: string;
  preview: string;
  contentBlocks: string[];
  textLength: number;
  imageFileNames: string[];
  sourceLinkUri?: string;
  kind: StoryKind;
  contentTypeHint: string;
  slotContentHint: SlotContentHint;
  candidateForStoryPool: boolean;
  linkedPageNames: string[];
  linkedSpreadPaths: string[];
}

export interface IdmlManifestDiagnostics {
  unplacedStoryIds: string[];
  storiesWithoutText: string[];
  assetsWithoutPageAssignment: string[];
}

export interface IdmlManifest {
  version: 1;
  extractedAt: string;
  sourceFile: IdmlManifestSourceFile;
  document: IdmlManifestDocument;
  pages: IdmlManifestPage[];
  spreads: IdmlManifestSpread[];
  assets: IdmlManifestAsset[];
  stories: IdmlManifestStory[];
  diagnostics: IdmlManifestDiagnostics;
}

interface ParsedSpreadItem {
  storyId?: string;
  assetId?: string;
  itemTransformX: number;
}

interface ParsedPageDescriptor {
  id: string;
  name: string;
  self: string;
  itemTransformX: number;
  storyIds: Set<string>;
  assetIds: Set<string>;
}

const XML_ENTITY_RE = /&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp);/g;

function decodeXmlEntities(value: string): string {
  return value.replace(XML_ENTITY_RE, (_, entity: string) => {
    switch (entity) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      case 'nbsp':
        return ' ';
      default:
        if (entity.startsWith('#x')) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        }
        if (entity.startsWith('#')) {
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        }
        return _;
    }
  });
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of input.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXmlEntities(match[2] || '');
  }
  return attributes;
}

function parseTransformX(value?: string): number {
  if (!value) return 0;
  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part));

  return Number.isFinite(parts[4]) ? parts[4] : 0;
}

function slugifyFileBase(value: string): string {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function decodeFileUri(uri: string): string {
  const clean = uri.replace(/^file:/i, '');
  try {
    return decodeURIComponent(clean);
  } catch {
    return clean;
  }
}

function basenameFromUri(uri: string): string {
  const decoded = decodeFileUri(uri);
  return path.basename(decoded);
}

function classifyStory(text: string, title: string, pathName: string): StoryKind {
  const compact = text.replace(/\s+/g, ' ').trim();
  const haystack = `${title} ${compact} ${pathName}`.toLowerCase();

  if (!compact) return 'blank';
  if (/^\d{1,3}$/.test(compact)) return 'page_number';

  if (
    compact.length < 160 &&
    /\b(yorkshire businesswoman|n[o0]?\.?\s*\d+|bi-monthly|june-july \d{4}|supporting female business women)\b/i.test(
      haystack,
    )
  ) {
    return 'masthead';
  }

  if (
    /\b(contents|disclosure|printed by|group editor|digital copy available|cover\s*:|issn|from the editor|editor('?s)? note)\b/i.test(
      haystack,
    )
  ) {
    return 'utility';
  }

  if (
    /(@|tel:|tickets:|dress code:|venue:|www\.|\.co\.uk|instagram\.com|justgiving\.com|reservations@|management@)/i.test(
      compact,
    ) &&
    compact.length < 900
  ) {
    return 'advert';
  }

  if (compact.length < 140 && !/[.!?].+[.!?]/.test(compact)) {
    return 'headline';
  }

  if (compact.length >= 220) return 'article';

  return 'snippet';
}

function inferStoryContentType(kind: StoryKind, title: string, text: string): string {
  const haystack = `${title} ${text.slice(0, 280)}`.toLowerCase();

  if (kind === 'page_number' || kind === 'blank' || kind === 'masthead' || kind === 'utility') {
    return 'utility';
  }

  if (kind === 'advert') return 'partner';
  if (/\b(editor|editorial|as i write)\b/.test(haystack)) return 'editorial';
  if (/\b(profile|spotlight|member spotlight)\b/.test(haystack)) return 'profile';
  if (/\b(column|comment|opinion|expert)\b/.test(haystack)) return 'column';
  if (kind === 'headline' && /\bcover\b/.test(haystack)) return 'lead';
  if (kind === 'headline' || kind === 'article' || kind === 'snippet') return 'feature';

  return 'utility';
}

function inferSlotContentHint(kind: StoryKind, title: string, text: string): SlotContentHint {
  const haystack = `${title} ${text}`.toLowerCase();

  if (kind === 'advert') return 'ad';
  if (/\b(contents|table of contents)\b/.test(haystack)) return 'contents';
  if (/\b(editor|editorial|from the editor|as i write)\b/.test(haystack)) return 'editorial_note';
  if (kind === 'page_number' || kind === 'masthead' || kind === 'utility' || kind === 'blank') {
    return 'static_copy';
  }
  return 'story';
}

function isCandidateForStoryPool(kind: StoryKind, slotContentHint: SlotContentHint): boolean {
  if (slotContentHint !== 'story' && slotContentHint !== 'editorial_note') return false;
  return kind === 'article' || kind === 'headline' || kind === 'snippet';
}

function extractStoryFromXml(pathName: string, xml: string, order: number): IdmlManifestStory {
  const storyAttrs = parseAttributes(xml.match(/<Story\b([^>]*)>/)?.[1] || '');
  const contentBlocks = Array.from(xml.matchAll(/<Content>([\s\S]*?)<\/Content>/g))
    .map((match) => normalizeWhitespace(decodeXmlEntities(match[1] || '')))
    .filter(Boolean);

  const text = normalizeWhitespace(contentBlocks.join('\n').replace(/\n{2,}/g, '\n\n'));
  const title = normalizeWhitespace(contentBlocks[0] || '').split('\n')[0] || path.basename(pathName, '.xml');
  const preview = text.replace(/\s+/g, ' ').slice(0, 220);
  const imageFileNames = Array.from(
    new Set(
      [
        ...xml.matchAll(/LinkResourceURI="file:[^"]*\/([^"\/]+\.(?:png|jpe?g|webp|gif|svg|tiff?|psd))"/gi),
        ...xml.matchAll(/LinkResourceURI="[^"]*\/([^"\/]+\.(?:png|jpe?g|webp|gif|svg|tiff?|psd))"/gi),
        ...xml.matchAll(/(?:href|src)="[^"]*\/([^"\/]+\.(?:png|jpe?g|webp|gif|svg|tiff?|psd))"/gi),
      ]
        .map((match) => String(match[1] || '').trim())
        .filter(Boolean),
    ),
  );
  const sourceLinkUri = decodeXmlEntities(xml.match(/<Link\b[^>]*LinkResourceURI="([^"]+)"/)?.[1] || '');
  const id = storyAttrs.Self || path.basename(pathName, '.xml').replace(/^Story_/, '');
  const kind = classifyStory(text, title, pathName);
  const contentTypeHint = inferStoryContentType(kind, title, text);
  const slotContentHint = inferSlotContentHint(kind, title, text);

  return {
    id,
    path: pathName,
    order,
    title,
    text,
    preview,
    contentBlocks,
    textLength: text.length,
    imageFileNames,
    sourceLinkUri: sourceLinkUri || undefined,
    kind,
    contentTypeHint,
    slotContentHint,
    candidateForStoryPool: isCandidateForStoryPool(kind, slotContentHint),
    linkedPageNames: [],
    linkedSpreadPaths: [],
  };
}

function assignItemToPage(itemX: number, pages: ParsedPageDescriptor[]): ParsedPageDescriptor | null {
  if (pages.length === 0) return null;
  if (pages.length === 1) return pages[0];

  let winner = pages[0];
  let minDistance = Math.abs(itemX - winner.itemTransformX);

  for (const page of pages.slice(1)) {
    const distance = Math.abs(itemX - page.itemTransformX);
    if (distance < minDistance) {
      winner = page;
      minDistance = distance;
    }
  }

  return winner;
}

function extractAltText(block: string): string | undefined {
  const match = block.match(/CustomAltText="([^"]*)"/);
  const value = normalizeWhitespace(decodeXmlEntities(match?.[1] || ''));
  return value || undefined;
}

function extractGraphicDimensions(block: string): { width?: number; height?: number } {
  const match = block.match(/<GraphicBounds\b[^>]*Right="([^"]+)"[^>]*Bottom="([^"]+)"/);
  const width = Number.parseFloat(match?.[1] || '');
  const height = Number.parseFloat(match?.[2] || '');

  return {
    width: Number.isFinite(width) ? width : undefined,
    height: Number.isFinite(height) ? height : undefined,
  };
}

function parseSpreadXml(
  spreadPath: string,
  xml: string,
  spreadIndex: number,
  assetAccumulator: IdmlManifestAsset[],
): {
  spread: IdmlManifestSpread;
  pages: IdmlManifestPage[];
  storyIds: Set<string>;
} {
  const spreadAttrs = parseAttributes(xml.match(/<Spread\b([^>]*)>/)?.[1] || '');
  const parsedPages: ParsedPageDescriptor[] = Array.from(xml.matchAll(/<Page\b([^>]*)>/g)).map((match, index) => {
    const attrs = parseAttributes(match[1] || '');
    return {
      id: `${spreadPath}::${attrs.Self || `page-${index + 1}`}`,
      name: attrs.Name || String(index + 1),
      self: attrs.Self || `page-${index + 1}`,
      itemTransformX: parseTransformX(attrs.ItemTransform),
      storyIds: new Set<string>(),
      assetIds: new Set<string>(),
    };
  });

  const storyIds = new Set<string>();
  const items: ParsedSpreadItem[] = [];

  for (const match of xml.matchAll(/<TextFrame\b([^>]*)>/g)) {
    const attrs = parseAttributes(match[1] || '');
    const storyId = attrs.ParentStory || '';
    if (!storyId) continue;

    storyIds.add(storyId);
    items.push({
      storyId,
      itemTransformX: parseTransformX(attrs.ItemTransform),
    });
  }

  let assetIndex = 0;
  for (const match of xml.matchAll(/<(Rectangle|Oval|Polygon|GraphicLine)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const objectType = match[1];
    const openingAttrs = parseAttributes(match[2] || '');
    const block = match[3] || '';
    const linkMatch = block.match(/<Link\b([^>]*)\/?>/);

    if (!linkMatch) continue;

    const linkAttrs = parseAttributes(linkMatch[1] || '');
    const uri = linkAttrs.LinkResourceURI || '';
    if (!uri) continue;

    const decodedPath = decodeFileUri(uri);
    const fileName = basenameFromUri(uri);
    const { width, height } = extractGraphicDimensions(block);
    const assetId = `${spreadPath}::asset-${assetIndex++}`;

    assetAccumulator.push({
      id: assetId,
      spreadPath,
      pageNames: [],
      objectType,
      uri,
      decodedPath,
      fileName,
      format: linkAttrs.LinkResourceFormat || undefined,
      altText: extractAltText(block),
      width,
      height,
    });

    items.push({
      assetId,
      itemTransformX: parseTransformX(openingAttrs.ItemTransform),
    });
  }

  for (const item of items) {
    const page = assignItemToPage(item.itemTransformX, parsedPages);
    if (!page) continue;

    if (item.storyId) page.storyIds.add(item.storyId);
    if (item.assetId) page.assetIds.add(item.assetId);
  }

  const pageManifests: IdmlManifestPage[] = parsedPages.map((page, index) => ({
    id: page.id,
    name: page.name,
    self: page.self,
    spreadPath,
    spreadIndex,
    pageIndexInSpread: index,
    itemTransformX: page.itemTransformX,
    storyIds: Array.from(page.storyIds),
    assetIds: Array.from(page.assetIds),
  }));

  for (const asset of assetAccumulator.filter((candidate) => candidate.spreadPath === spreadPath)) {
    asset.pageNames = pageManifests
      .filter((page) => page.assetIds.includes(asset.id))
      .map((page) => page.name);
  }

  return {
    spread: {
      id: spreadAttrs.Self || spreadPath,
      path: spreadPath,
      self: spreadAttrs.Self || spreadPath,
      index: spreadIndex,
      pageNames: pageManifests.map((page) => page.name),
      storyIds: Array.from(storyIds),
      assetIds: pageManifests.flatMap((page) => page.assetIds),
    },
    pages: pageManifests,
    storyIds,
  };
}

async function readZipTextFile(zip: JSZip, filePath: string): Promise<string> {
  const file = zip.file(filePath);
  if (!file) {
    throw new Error(`Missing file in IDML archive: ${filePath}`);
  }
  return file.async('text');
}

function sortPages(pages: IdmlManifestPage[]): IdmlManifestPage[] {
  return [...pages].sort((left, right) => {
    const leftNumber = Number.parseInt(left.name, 10);
    const rightNumber = Number.parseInt(right.name, 10);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }

    if (left.spreadIndex !== right.spreadIndex) return left.spreadIndex - right.spreadIndex;
    return left.pageIndexInSpread - right.pageIndexInSpread;
  });
}

export async function buildIdmlManifestFromBuffer(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  sourcePath: string,
): Promise<IdmlManifest> {
  const zip = await JSZip.loadAsync(buffer);
  const extractedAt = new Date().toISOString();
  const sourceFileName = path.basename(sourcePath);
  const designMapXml = await readZipTextFile(zip, 'designmap.xml');
  const documentAttrs = parseAttributes(designMapXml.match(/<Document\b([^>]*)>/)?.[1] || '');
  const labels = Object.fromEntries(
    Array.from(designMapXml.matchAll(/<KeyValuePair\b[^>]*Key="([^"]+)"[^>]*Value="([^"]*)"[^>]*\/>/g)).map(
      (match) => [decodeXmlEntities(match[1] || ''), decodeXmlEntities(match[2] || '')],
    ),
  );

  const spreadPaths = Array.from(
    designMapXml.matchAll(/<idPkg:Spread\b[^>]*src="([^"]+)"/g),
    (match) => decodeXmlEntities(match[1] || ''),
  );
  const orderedStoryPaths = Array.from(
    designMapXml.matchAll(/<idPkg:Story\b[^>]*src="([^"]+)"/g),
    (match) => decodeXmlEntities(match[1] || ''),
  );

  const archiveStoryPaths = Object.keys(zip.files).filter((entry) => /^Stories\/.+\.xml$/i.test(entry));
  const storyPaths = orderedStoryPaths.length > 0 ? orderedStoryPaths : archiveStoryPaths.sort();

  const stories = await Promise.all(
    storyPaths.map(async (storyPath, index) => extractStoryFromXml(storyPath, await readZipTextFile(zip, storyPath), index)),
  );
  const storyById = new Map(stories.map((story) => [story.id, story]));

  const assets: IdmlManifestAsset[] = [];
  const pages: IdmlManifestPage[] = [];
  const spreads: IdmlManifestSpread[] = [];

  for (const [spreadIndex, spreadPath] of spreadPaths.entries()) {
    const spreadXml = await readZipTextFile(zip, spreadPath);
    const parsed = parseSpreadXml(spreadPath, spreadXml, spreadIndex, assets);
    spreads.push(parsed.spread);
    pages.push(...parsed.pages);
  }

  for (const page of pages) {
    for (const storyId of page.storyIds) {
      const story = storyById.get(storyId);
      if (!story) continue;
      if (!story.linkedPageNames.includes(page.name)) story.linkedPageNames.push(page.name);
      if (!story.linkedSpreadPaths.includes(page.spreadPath)) story.linkedSpreadPaths.push(page.spreadPath);
    }
  }

  const storyIdsInPages = new Set(pages.flatMap((page) => page.storyIds));
  const assetsWithoutPageAssignment = assets.filter((asset) => asset.pageNames.length === 0).map((asset) => asset.id);

  return {
    version: 1,
    extractedAt,
    sourceFile: {
      path: sourcePath,
      fileName: sourceFileName,
      baseName: slugifyFileBase(sourceFileName),
    },
    document: {
      name: documentAttrs.Name || sourceFileName,
      domVersion: documentAttrs.DOMVersion || undefined,
      pageCount: pages.length,
      spreadCount: spreads.length,
      storyCount: stories.length,
      labels,
      spreadPathsInOrder: spreadPaths,
      storyPathsInOrder: storyPaths,
    },
    pages: sortPages(pages),
    spreads,
    assets,
    stories: stories.map((story) => ({
      ...story,
      linkedPageNames: [...story.linkedPageNames].sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10)),
    })),
    diagnostics: {
      unplacedStoryIds: stories.filter((story) => !storyIdsInPages.has(story.id)).map((story) => story.id),
      storiesWithoutText: stories.filter((story) => story.textLength === 0).map((story) => story.id),
      assetsWithoutPageAssignment,
    },
  };
}

export async function buildIdmlManifestFromFile(filePath: string): Promise<IdmlManifest> {
  const buffer = await fs.readFile(filePath);
  return buildIdmlManifestFromBuffer(buffer, filePath);
}
