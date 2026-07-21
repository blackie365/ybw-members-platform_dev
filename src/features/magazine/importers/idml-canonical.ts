import path from 'node:path';
import slugify from '@sindresorhus/slugify';
import type {
  Edition,
  FlatplanIntent,
  FlatplanPage,
  MagazineAsset,
  Slot,
  SlotContentType,
  Story,
  StoryAssetRef,
  StoryContentType,
} from '../domain/types';
import type { IdmlManifest, IdmlManifestAsset, IdmlManifestPage, IdmlManifestStory } from './idml-manifest';

export interface IdmlCanonicalBundle {
  version: 1;
  manifest: Pick<IdmlManifest, 'version' | 'extractedAt' | 'sourceFile' | 'document' | 'diagnostics'>;
  edition: Edition;
  pages: FlatplanPage[];
  slots: Slot[];
  stories: Story[];
  assets: MagazineAsset[];
  summary: {
    candidateStoryCount: number;
    placedStoryCount: number;
    unplacedStoryCount: number;
    pageCount: number;
    slotCount: number;
    assetCount: number;
    warnings: string[];
  };
}

interface BuildCanonicalBundleOptions {
  editionId?: string;
  slug?: string;
  publishDate?: string;
  title?: string;
  themeVariant?: string;
}

interface PageStoryContext {
  candidates: IdmlManifestStory[];
  editorialNotes: IdmlManifestStory[];
  contents: IdmlManifestStory[];
  ads: IdmlManifestStory[];
  staticCopy: IdmlManifestStory[];
  all: IdmlManifestStory[];
}

interface PageIntentPlan {
  intent: FlatplanIntent;
  templateFamily: string;
  templateVariant: string;
}

interface PageIntentState {
  assignedEditorialStoryIds: Set<string>;
  assignedContentsStoryIds: Set<string>;
}

const BROWSER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);
const DOWNLOAD_ASSET_EXTENSIONS = new Set(['.pdf']);
const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function parseMonthYear(value: string): { year: number; month: number } | null {
  const lower = value.toLowerCase();

  for (const [index, monthName] of MONTH_NAMES.entries()) {
    const monthPattern = new RegExp(`${monthName}\\D+(20\\d{2})`, 'i');
    const match = lower.match(monthPattern);
    if (match) {
      return {
        year: Number.parseInt(match[1], 10),
        month: index + 1,
      };
    }
  }

  return null;
}

function buildPublishDate(manifest: IdmlManifest, override?: string): string {
  if (override) return override;

  const candidates = [
    manifest.document.name,
    manifest.sourceFile.fileName,
    manifest.document.labels.lastFlatplanJSON,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = parseMonthYear(candidate);
    if (parsed) {
      return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-01T00:00:00.000Z`;
    }
  }

  return new Date().toISOString();
}

function humanizeDocumentName(value: string): string {
  const cleaned = value
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\bclean\b/gi, '')
    .replace(/\bcopy\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned
    .split(' ')
    .map((part) => {
      if (!part) return part;
      if (part.toUpperCase() === 'YBW') return 'YBW';
      if (/^\d+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function buildEditionTitle(manifest: IdmlManifest, publishDate: string, override?: string): string {
  if (override) return override;

  const base = humanizeDocumentName(manifest.document.name || manifest.sourceFile.fileName);
  if (base) return base;

  const parsedDate = new Date(publishDate);
  const monthName = MONTH_NAMES[parsedDate.getUTCMonth()] || 'issue';
  return `YBW ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${parsedDate.getUTCFullYear()}`;
}

function buildEditionSlug(title: string, override?: string): string {
  return override || slugify(title);
}

function buildEditionId(slug: string, override?: string): string {
  return override || `idml-${slug}`;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toSentenceCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function inferAuthor(blocks: string[]): string | undefined {
  for (const block of blocks.slice(0, 4)) {
    const trimmed = block.trim();
    const bylineMatch = trimmed.match(/^(?:by|words by)\s+([A-Z][A-Za-z .'-]{2,80})$/i);
    if (bylineMatch) return bylineMatch[1].trim();
  }

  return undefined;
}

function splitStandfirstAndBody(story: IdmlManifestStory): { standfirst?: string; body?: string } {
  const blocks = story.contentBlocks.map((block) => normalizeWhitespace(block)).filter(Boolean);
  if (blocks.length === 0) return {};

  const filteredBlocks = [...blocks];
  const first = filteredBlocks[0] || '';
  if (first.replace(/\s+/g, ' ').trim() === story.title.replace(/\s+/g, ' ').trim()) {
    filteredBlocks.shift();
  }

  const standfirstCandidate = filteredBlocks[0];
  const bodyBlocks =
    standfirstCandidate && standfirstCandidate.length <= 260 && filteredBlocks.length > 1
      ? filteredBlocks.slice(1)
      : filteredBlocks;

  return {
    standfirst:
      standfirstCandidate && standfirstCandidate.length <= 260 && filteredBlocks.length > 1
        ? standfirstCandidate
        : undefined,
    body: normalizeWhitespace(bodyBlocks.join('\n\n')) || undefined,
  };
}

function getPageNumber(page: IdmlManifestPage): number {
  const parsed = Number.parseInt(page.name, 10);
  return Number.isFinite(parsed) ? parsed : page.spreadIndex + 1;
}

function buildPageId(editionId: string, position: number): string {
  return `${editionId}-page-${String(position).padStart(2, '0')}`;
}

function buildSlotId(pageId: string, key: string): string {
  return `${pageId}-${key}`;
}

function buildAssetId(editionId: string, index: number, fileName: string): string {
  return `${editionId}-asset-${String(index + 1).padStart(3, '0')}-${slugify(path.basename(fileName, path.extname(fileName)))}`;
}

function storyContentTypeToTag(contentType?: StoryContentType): string[] {
  if (!contentType) return [];
  if (contentType === 'partner') return ['partner'];
  if (contentType === 'editorial') return ['editorial'];
  if (contentType === 'profile') return ['profile'];
  if (contentType === 'column') return ['column'];
  if (contentType === 'lead') return ['cover', 'lead', 'featured'];
  if (contentType === 'feature') return ['feature'];
  return ['utility'];
}

function inferStoryTags(story: IdmlManifestStory): string[] {
  const tags = new Set<string>(['imported', ...storyContentTypeToTag(story.contentTypeHint as StoryContentType)]);

  if (story.slotContentHint === 'editorial_note') {
    tags.add('editorial');
    tags.add('editor-note');
  }
  if (story.slotContentHint === 'contents') tags.add('contents');
  if (story.linkedPageNames.some((pageName) => pageName === '1')) {
    tags.add('cover');
  }
  if (story.imageFileNames.length > 0) tags.add('has-image');
  if (story.kind === 'headline') tags.add('headline');
  if (story.kind === 'snippet') tags.add('supporting');

  return Array.from(tags);
}

function inferStoryPriority(story: IdmlManifestStory): number {
  const lowestPage = story.linkedPageNames
    .map((pageName) => Number.parseInt(pageName, 10))
    .filter((pageNumber) => Number.isFinite(pageNumber))
    .sort((left, right) => left - right)[0];

  let priority = 10;
  if (typeof lowestPage === 'number') priority += Math.max(0, 80 - lowestPage);
  if (story.contentTypeHint === 'lead') priority += 30;
  if (story.slotContentHint === 'editorial_note') priority += 20;
  if (story.kind === 'article') priority += 10;

  return priority;
}

function inferPullQuotes(body?: string): string[] {
  if (!body) return [];
  const matches = Array.from(body.matchAll(/"([^"\n]{30,240})"/g))
    .map((match) => normalizeWhitespace(match[1] || ''))
    .filter(Boolean);
  return Array.from(new Set(matches)).slice(0, 2);
}

function getAssetExtension(fileNameOrPath: string): string {
  return path.extname(fileNameOrPath || '').toLowerCase();
}

function isBrowserRenderableAsset(asset: Pick<IdmlManifestAsset, 'fileName' | 'decodedPath'>): boolean {
  return BROWSER_IMAGE_EXTENSIONS.has(getAssetExtension(asset.fileName || asset.decodedPath));
}

function isDownloadAsset(asset: Pick<IdmlManifestAsset, 'fileName' | 'decodedPath'>): boolean {
  return DOWNLOAD_ASSET_EXTENSIONS.has(getAssetExtension(asset.fileName || asset.decodedPath));
}

function isSupportedAsset(asset: Pick<IdmlManifestAsset, 'fileName' | 'decodedPath'>): boolean {
  return isBrowserRenderableAsset(asset) || isDownloadAsset(asset);
}

function pickRenderableAsset(assets: IdmlManifestAsset[]): IdmlManifestAsset | undefined {
  return assets.find((asset) => isBrowserRenderableAsset(asset));
}

function pickRenderableAssets(assets: IdmlManifestAsset[], limit?: number): IdmlManifestAsset[] {
  const renderable = assets.filter((asset) => isBrowserRenderableAsset(asset));
  return typeof limit === 'number' ? renderable.slice(0, limit) : renderable;
}

function buildStoryAssetRefs(assets: IdmlManifestAsset[]): StoryAssetRef[] {
  return pickRenderableAssets(assets).map((asset) => ({
    src: asset.decodedPath,
    alt: asset.altText || asset.fileName,
    width: asset.width,
    height: asset.height,
  }));
}

function buildMagazineAssets(editionId: string, manifest: IdmlManifest): MagazineAsset[] {
  const timestamp = new Date().toISOString();

  return manifest.assets.filter((asset) => isSupportedAsset(asset)).map((asset, index) => {
    const pageNumber = asset.pageNames
      .map((pageName) => Number.parseInt(pageName, 10))
      .find((page) => Number.isFinite(page));

    let role: MagazineAsset['role'] = 'inline';
    if (pageNumber === 1) role = 'cover';
    else if (pageNumber === manifest.document.pageCount) role = 'cover';
    else if (isDownloadAsset(asset)) role = pageNumber ? 'ad' : 'download';

    return {
      id: buildAssetId(editionId, index, asset.fileName),
      type: isDownloadAsset(asset) ? 'pdf' : 'image',
      role,
      src: asset.decodedPath,
      alt: asset.altText || asset.fileName,
      caption: asset.pageNames.length > 0 ? `Placed on page ${asset.pageNames.join(', ')}` : undefined,
      editionId,
      width: asset.width,
      height: asset.height,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

function buildPageStoryContext(page: IdmlManifestPage, storyMap: Map<string, IdmlManifestStory>): PageStoryContext {
  const all = page.storyIds.map((storyId) => storyMap.get(storyId)).filter((story): story is IdmlManifestStory => Boolean(story));

  return {
    all,
    candidates: all.filter((story) => story.candidateForStoryPool),
    editorialNotes: all.filter((story) => story.slotContentHint === 'editorial_note'),
    contents: all.filter((story) => story.slotContentHint === 'contents'),
    ads: all.filter((story) => story.slotContentHint === 'ad' || story.contentTypeHint === 'partner'),
    staticCopy: all.filter((story) => story.slotContentHint === 'static_copy'),
  };
}

function planPageIntent(
  page: IdmlManifestPage,
  pageCount: number,
  context: PageStoryContext,
  featureOrdinal: number,
  state: PageIntentState,
): PageIntentPlan {
  const position = getPageNumber(page);
  const availableContentsStories = context.contents.filter((story) => !state.assignedContentsStoryIds.has(story.id));
  const availableEditorialStories = context.editorialNotes.filter((story) => !state.assignedEditorialStoryIds.has(story.id));

  if (position === 1) {
    return { intent: 'cover', templateFamily: 'cover', templateVariant: 'editorial' };
  }

  if (position === pageCount) {
    return { intent: 'back_cover', templateFamily: 'feature', templateVariant: 'full-bleed' };
  }

  if (availableContentsStories.length > 0) {
    return { intent: 'contents', templateFamily: 'contents', templateVariant: 'standard' };
  }

  if (availableEditorialStories.length > 0) {
    return { intent: 'editor_note', templateFamily: 'feature', templateVariant: 'left-media' };
  }

  const hasOnlyAdLikeContent =
    context.ads.length > 0 && context.candidates.length === 0 && context.editorialNotes.length === 0 && context.contents.length === 0;
  if (hasOnlyAdLikeContent) {
    return { intent: 'ad', templateFamily: 'feature', templateVariant: 'full-bleed' };
  }

  if (context.candidates.length === 0 && context.all.length > 0) {
    return { intent: 'feature_supporting', templateFamily: 'feature', templateVariant: 'left-media' };
  }

  if (featureOrdinal === 0) {
    return { intent: 'feature_primary', templateFamily: 'feature', templateVariant: 'left-media' };
  }

  if (featureOrdinal === 1) {
    return { intent: 'feature_secondary', templateFamily: 'feature', templateVariant: 'right-media' };
  }

  return {
    intent: 'feature_supporting',
    templateFamily: 'feature',
    templateVariant: featureOrdinal % 3 === 0 ? 'full-bleed' : featureOrdinal % 2 === 0 ? 'right-media' : 'left-media',
  };
}

function summarizeStaticCopy(stories: IdmlManifestStory[]): string {
  return normalizeWhitespace(stories.map((story) => story.preview || story.text).filter(Boolean).join('\n\n'));
}

function buildStaticCopyOverride(stories: IdmlManifestStory[], pageAssets: IdmlManifestAsset[], fallbackTitle: string) {
  const renderableAsset = pickRenderableAsset(pageAssets);
  return {
    eyebrow: 'Imported Page',
    title: stories[0]?.title || fallbackTitle,
    body: summarizeStaticCopy(stories),
    imageSrc: renderableAsset?.decodedPath,
  };
}

function buildAdOverride(stories: IdmlManifestStory[], assets: IdmlManifestAsset[], pageNumber: number) {
  const lead = stories[0];
  const body = normalizeWhitespace(stories.map((story) => story.text).join('\n\n'));
  const renderableAsset = pickRenderableAsset(assets);
  const pdfAsset = assets.find((asset) => isDownloadAsset(asset));

  return {
    label: 'Advertisement',
    advertiserName: lead?.title || `Page ${pageNumber}`,
    headline: lead?.title || `Advertisement ${pageNumber}`,
    body: body || undefined,
    imageSrc: renderableAsset?.decodedPath,
    pdfSrc: pdfAsset?.decodedPath,
    ctaLabel: pdfAsset ? 'Open Advert PDF' : undefined,
    ctaHref: pdfAsset?.decodedPath,
  };
}

function createContentsEntries(
  pages: FlatplanPage[],
  slots: Slot[],
  stories: Story[],
): Array<{ page: string; category: string; title: string }> {
  const storyMap = new Map(stories.map((story) => [story.id, story]));
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));

  return pages
    .filter((page) => !['cover', 'contents', 'ad', 'back_cover'].includes(page.intent))
    .map((page) => {
      const storySlot = page.slotIds
        .map((slotId) => slotMap.get(slotId))
        .find((slot) => slot?.binding?.storyId);
      const story = storySlot?.binding?.storyId ? storyMap.get(storySlot.binding.storyId) : null;
      if (!story) return null;

      return {
        page: String(page.position).padStart(2, '0'),
        category: toSentenceCase(page.intent.replace(/_/g, ' ')),
        title: story.title,
      };
    })
    .filter((entry): entry is { page: string; category: string; title: string } => Boolean(entry));
}

function buildStoryRecord(
  story: IdmlManifestStory,
  linkedAssets: IdmlManifestAsset[],
  timestamp: string,
): Story {
  const { standfirst, body } = splitStandfirstAndBody(story);
  const assetRefs = buildStoryAssetRefs(linkedAssets);

  return {
    id: `story-${story.id}`,
    source: 'imported',
    sourceRef: story.path,
    title: story.title,
    standfirst,
    body,
    author: inferAuthor(story.contentBlocks),
    tags: inferStoryTags(story),
    priority: inferStoryPriority(story),
    contentType: (story.contentTypeHint as StoryContentType) || 'feature',
    includedInEditionCandidatePool: story.candidateForStoryPool,
    editorialConfidence: story.candidateForStoryPool ? 0.9 : 0.3,
    placementConfidence: story.linkedPageNames.length > 0 ? 0.95 : 0.2,
    issueTags: story.linkedPageNames.map((pageName) => `page-${pageName}`),
    manualNotes: `Imported from ${story.path}`,
    heroImage: assetRefs[0],
    gallery: assetRefs.slice(1),
    pullQuotes: inferPullQuotes(body),
    status: story.candidateForStoryPool ? 'approved' : 'archived',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function getSupplementalPageStories(context: PageStoryContext, primaryStoryId?: string): IdmlManifestStory[] {
  return context.all.filter(
    (story) =>
      story.id !== primaryStoryId &&
      story.textLength > 0 &&
      story.kind !== 'page_number' &&
      story.kind !== 'masthead' &&
      story.kind !== 'blank' &&
      story.slotContentHint !== 'contents' &&
      story.slotContentHint !== 'ad',
  );
}

function uniqueNormalizedBlocks(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const blocks: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeWhitespace(value || '');
    if (!normalized) return;
    const key = normalized.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    blocks.push(normalized);
  });

  return blocks;
}

function buildComposedPageStoryRecord(
  baseStory: Story,
  supplementalStories: IdmlManifestStory[],
  pageNumber: number,
  timestamp: string,
): Story {
  if (supplementalStories.length === 0) return baseStory;

  const supplementalStandfirsts = supplementalStories
    .map((story) => splitStandfirstAndBody(story).standfirst)
    .filter(Boolean);
  const supplementalBodies = supplementalStories.flatMap((story) => {
    const { body, standfirst } = splitStandfirstAndBody(story);
    return [body || story.text, standfirst];
  });
  const standfirst = uniqueNormalizedBlocks([baseStory.standfirst, ...supplementalStandfirsts])[0];
  const bodyBlocks = uniqueNormalizedBlocks([baseStory.body, ...supplementalBodies]);
  const body = bodyBlocks.join('\n\n') || undefined;

  return {
    ...baseStory,
    id: `${baseStory.id}-page-${String(pageNumber).padStart(2, '0')}`,
    standfirst,
    body,
    pullQuotes: body ? inferPullQuotes(body) : baseStory.pullQuotes,
    tags: Array.from(new Set([...baseStory.tags, 'page-composed'])),
    issueTags: Array.from(new Set([...(baseStory.issueTags || []), `page-${pageNumber}`])),
    manualNotes: `${baseStory.manualNotes || 'Imported story'} | Page ${pageNumber} composed from ${supplementalStories.length + 1} linked story fragments`,
    updatedAt: timestamp,
  };
}
export function buildCanonicalBundleFromManifest(
  manifest: IdmlManifest,
  options: BuildCanonicalBundleOptions = {},
): IdmlCanonicalBundle {
  const timestamp = new Date().toISOString();
  const publishDate = buildPublishDate(manifest, options.publishDate);
  const title = buildEditionTitle(manifest, publishDate, options.title);
  const slug = buildEditionSlug(title, options.slug);
  const editionId = buildEditionId(slug, options.editionId);
  const themeVariant = options.themeVariant || 'ybw-editorial';

  const storyMap = new Map(manifest.stories.map((story) => [story.id, story]));
  const assetMap = new Map(
    manifest.assets.map((asset) => [
      asset.id,
      asset,
    ]),
  );
  const storyAssetsMap = new Map<string, IdmlManifestAsset[]>();

  manifest.stories.forEach((story) => {
    const linkedAssets = manifest.assets.filter((asset) =>
      asset.pageNames.some((pageName) => story.linkedPageNames.includes(pageName)),
    );
    storyAssetsMap.set(story.id, linkedAssets);
  });

  const stories = manifest.stories
    .filter((story) => story.candidateForStoryPool || story.slotContentHint === 'editorial_note')
    .map((story) => buildStoryRecord(story, storyAssetsMap.get(story.id) || [], timestamp));

  const canonicalStoryMap = new Map(stories.map((story) => [story.sourceRef, story]));
  const supportedManifestAssets = manifest.assets.filter((asset) => isSupportedAsset(asset));
  const assets = buildMagazineAssets(editionId, manifest);
  const sortedManifestPages = [...manifest.pages].sort((left, right) => getPageNumber(left) - getPageNumber(right));
  const spreadPagesByPath = new Map<string, IdmlManifestPage[]>();
  sortedManifestPages.forEach((page) => {
    const existing = spreadPagesByPath.get(page.spreadPath) ?? [];
    existing.push(page);
    spreadPagesByPath.set(page.spreadPath, existing);
  });
  const assetIdByManifestId = new Map(
    supportedManifestAssets.map((asset, index) => [asset.id, assets[index]?.id].filter(Boolean) as [string, string]),
  );

  const pages: FlatplanPage[] = [];
  const slots: Slot[] = [];
  const warnings: string[] = [];
  let featureOrdinal = 0;
  const intentState: PageIntentState = {
    assignedEditorialStoryIds: new Set<string>(),
    assignedContentsStoryIds: new Set<string>(),
  };

  sortedManifestPages.forEach((manifestPage) => {
    const pageNumber = getPageNumber(manifestPage);
    const context = buildPageStoryContext(manifestPage, storyMap);
    const pageId = buildPageId(editionId, pageNumber);
    const pageAssets = manifestPage.assetIds.map((assetId) => assetMap.get(assetId)).filter((asset): asset is IdmlManifestAsset => Boolean(asset));
    const basePlan = planPageIntent(manifestPage, manifest.document.pageCount, context, featureOrdinal, intentState);
    const hasDownloadAsset = pageAssets.some((asset) => isDownloadAsset(asset));
    const hasEditorialStory = context.candidates.length > 0 || context.editorialNotes.length > 0 || context.contents.length > 0;
    const plan =
      hasDownloadAsset && !hasEditorialStory
        ? ({ intent: 'ad', templateFamily: 'ad', templateVariant: 'standard' } satisfies PageIntentPlan)
        : basePlan;
    if (plan.intent.startsWith('feature')) featureOrdinal += 1;
    const renderablePageAssets = pickRenderableAssets(pageAssets);
    const candidateStories = context.candidates.filter((story) => canonicalStoryMap.has(story.path));
    const availableEditorialStories = context.editorialNotes.filter((story) => !intentState.assignedEditorialStoryIds.has(story.id));
    const availableContentsStories = context.contents.filter((story) => !intentState.assignedContentsStoryIds.has(story.id));
    const primaryStory = candidateStories[0] || availableEditorialStories[0];
    let primaryStoryRecord = primaryStory ? canonicalStoryMap.get(primaryStory.path) : null;
    if (primaryStory && primaryStoryRecord) {
      const supplementalStories = getSupplementalPageStories(context, primaryStory.id);
      if (supplementalStories.length > 0) {
        primaryStoryRecord = buildComposedPageStoryRecord(primaryStoryRecord, supplementalStories, pageNumber, timestamp);
        stories.push(primaryStoryRecord);
      }
    }
    const pageSlotIds: string[] = [];

    const addSlot = (definition: {
      key: string;
      contentType: SlotContentType;
      isRequired: boolean;
      bindingStoryId?: string;
      bindingAssetIds?: string[];
      bindingMode?: Slot['bindingMode'];
      manualOverride?: boolean;
      overrideData?: Record<string, unknown>;
    }) => {
      const slotId = buildSlotId(pageId, definition.key);
      pageSlotIds.push(slotId);
      slots.push({
        id: slotId,
        editionId,
        flatplanPageId: pageId,
        key: definition.key,
        contentType: definition.contentType,
        isRequired: definition.isRequired,
        bindingMode:
          definition.bindingMode || (definition.overrideData || definition.bindingAssetIds || definition.bindingStoryId ? 'locked' : 'auto'),
        binding:
          definition.bindingStoryId || definition.bindingAssetIds
            ? {
                storyId: definition.bindingStoryId,
                assetIds: definition.bindingAssetIds,
              }
            : undefined,
        manualOverride: definition.manualOverride,
        overrideData: definition.overrideData,
        automationConfidence:
          definition.bindingStoryId || definition.bindingAssetIds || definition.overrideData
            ? 100
            : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    };

    const hasStaticPageFallback =
      (context.staticCopy.length > 0 || context.all.length === 0) &&
      (context.all.length > 0 || renderablePageAssets.length > 0 || pageNumber <= 3);

    if (
      (plan.intent === 'cover' || plan.intent === 'feature_primary' || plan.intent === 'feature_secondary') &&
      !primaryStoryRecord &&
      context.all.length === 0 &&
      !hasStaticPageFallback
    ) {
      warnings.push(`Page ${pageNumber} is missing a primary story binding.`);
    }

    switch (plan.intent) {
      case 'cover':
        addSlot({
          key: 'heroStory',
          contentType: 'story',
          isRequired: true,
          bindingStoryId: primaryStoryRecord?.id,
        });
        addSlot({
          key: 'coverAsset',
          contentType: 'gallery',
          isRequired: false,
          manualOverride: true,
          overrideData: {
            items: renderablePageAssets.slice(0, 1).map((asset) => ({
              src: asset.decodedPath,
              alt: asset.altText || primaryStoryRecord?.title || title,
            })),
          },
        });
        break;
      case 'contents':
        if (availableContentsStories[0]) {
          intentState.assignedContentsStoryIds.add(availableContentsStories[0].id);
        }
        addSlot({
          key: 'contentsList',
          contentType: 'contents',
          isRequired: true,
          manualOverride: true,
          overrideData: { entries: [] },
        });
        addSlot({
          key: 'contentsHighlight',
          contentType: 'story',
          isRequired: false,
          bindingStoryId: primaryStoryRecord?.id,
        });
        break;
      case 'editor_note':
        if (primaryStory) {
          intentState.assignedEditorialStoryIds.add(primaryStory.id);
        }
        addSlot({
          key: 'primaryStory',
          contentType: 'story',
          isRequired: true,
          bindingStoryId: primaryStoryRecord?.id,
        });
        break;
      case 'ad':
        addSlot({
          key: 'adPanel',
          contentType: 'ad',
          isRequired: true,
          manualOverride: true,
          overrideData: buildAdOverride(context.ads.length > 0 ? context.ads : context.staticCopy, pageAssets, pageNumber),
        });
        break;
      case 'back_cover':
        addSlot({
          key: 'staticCopy',
          contentType: 'static_copy',
          isRequired: true,
          manualOverride: true,
          overrideData: {
            eyebrow: 'Back Cover',
            title: context.staticCopy[0]?.title || primaryStoryRecord?.title || title,
            body: summarizeStaticCopy(context.staticCopy) || primaryStoryRecord?.standfirst || manifest.document.name,
            imageSrc: renderablePageAssets[0]?.decodedPath,
          },
        });
        addSlot({
          key: 'galleryRail',
          contentType: 'gallery',
          isRequired: false,
          manualOverride: true,
          overrideData: {
            items: renderablePageAssets.slice(0, 1).map((asset) => ({
              src: asset.decodedPath,
              alt: asset.altText || title,
            })),
          },
        });
        break;
      default: {
        const boundAssetIds = renderablePageAssets
          .map((asset) => assetIdByManifestId.get(asset.id))
          .filter((assetId): assetId is string => Boolean(assetId))
          .slice(0, 3);

        if (primaryStoryRecord) {
          addSlot({
            key: 'primaryStory',
            contentType: 'story',
            isRequired: true,
            bindingStoryId: primaryStoryRecord.id,
          });

          if (primaryStoryRecord.pullQuotes?.[0]) {
            addSlot({
              key: 'quoteRail',
              contentType: 'quote',
              isRequired: false,
              manualOverride: true,
              overrideData: {
                quote: primaryStoryRecord.pullQuotes[0],
                attribution: primaryStoryRecord.author,
              },
            });
          } else {
            addSlot({
              key: 'quoteRail',
              contentType: 'quote',
              isRequired: false,
            });
          }
        } else {
          addSlot({
            key: 'staticCopy',
            contentType: 'static_copy',
            isRequired: true,
            manualOverride: true,
            overrideData: buildStaticCopyOverride(
              context.staticCopy.length > 0 ? context.staticCopy : context.all,
              pageAssets,
              `Page ${pageNumber}`,
            ),
          });
        }

        if (renderablePageAssets.length > 0) {
          addSlot({
            key: 'galleryRail',
            contentType: 'gallery',
            isRequired: false,
            bindingAssetIds: boundAssetIds,
            manualOverride: true,
            overrideData: {
              items: renderablePageAssets.slice(0, 3).map((asset) => ({
                src: asset.decodedPath,
                alt: asset.altText || primaryStoryRecord?.title || asset.fileName,
                caption: asset.fileName,
              })),
            },
          });
        } else {
          addSlot({
            key: 'galleryRail',
            contentType: 'gallery',
            isRequired: false,
          });
        }
        break;
      }
    }

    pages.push({
      id: pageId,
      editionId,
      position: pageNumber,
      spreadId: `${editionId}-spread-${String(manifestPage.spreadIndex + 1).padStart(2, '0')}`,
      spreadIndex: manifestPage.spreadIndex,
      pageIndexInSpread: manifestPage.pageIndexInSpread,
      spreadPageCount: (spreadPagesByPath.get(manifestPage.spreadPath) ?? []).length,
      spreadPageIds: (spreadPagesByPath.get(manifestPage.spreadPath) ?? []).map((page) => buildPageId(editionId, getPageNumber(page))),
      spreadPagePositions: (spreadPagesByPath.get(manifestPage.spreadPath) ?? []).map((page) => getPageNumber(page)),
      templateFamily: plan.templateFamily,
      templateVariant: plan.templateVariant,
      intent: plan.intent,
      status: pageSlotIds.some((slotId) => slots.find((slot) => slot.id === slotId)?.binding?.storyId || slots.find((slot) => slot.id === slotId)?.overrideData)
        ? 'filled'
        : 'needs_review',
      slotIds: pageSlotIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  const contentsEntries = createContentsEntries(pages, slots, stories);
  slots.forEach((slot) => {
    if (slot.contentType === 'contents') {
      slot.overrideData = {
        ...(slot.overrideData || {}),
        entries: contentsEntries,
      };
      slot.updatedAt = timestamp;
    }
  });

  const coverAsset = manifest.assets.find((asset) => asset.pageNames.includes('1') && isBrowserRenderableAsset(asset));
  const editorNoteStory = stories.find((story) => story.tags.includes('editor-note'));

  const edition: Edition = {
    id: editionId,
    slug,
    title,
    subtitle: manifest.document.labels.lastTemplate ? `Imported from ${manifest.document.labels.lastTemplate}` : undefined,
    description: editorNoteStory?.standfirst || editorNoteStory?.body?.slice(0, 240) || manifest.document.name,
    publishDate,
    coverImage: coverAsset?.decodedPath || stories.find((story) => story.heroImage?.src)?.heroImage?.src || '',
    status: 'assembling',
    readerMode: 'custom',
    themeVariant,
    isLive: false,
    latestRevisionId: `import-${Date.now()}`,
    issuu: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const placedStoryIds = new Set(
    slots.map((slot) => slot.binding?.storyId).filter((storyId): storyId is string => Boolean(storyId)),
  );

  return {
    version: 1,
    manifest: {
      version: manifest.version,
      extractedAt: manifest.extractedAt,
      sourceFile: manifest.sourceFile,
      document: manifest.document,
      diagnostics: manifest.diagnostics,
    },
    edition,
    pages,
    slots,
    stories,
    assets,
    summary: {
      candidateStoryCount: stories.filter((story) => story.includedInEditionCandidatePool).length,
      placedStoryCount: placedStoryIds.size,
      unplacedStoryCount: stories.filter((story) => !placedStoryIds.has(story.id)).length,
      pageCount: pages.length,
      slotCount: slots.length,
      assetCount: assets.length,
      warnings,
    },
  };
}
