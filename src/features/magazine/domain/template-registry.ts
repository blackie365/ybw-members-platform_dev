import type { ComponentType } from 'react';
import CoverTemplate from '../templates/cover/renderer';
import ContentsTemplate from '../templates/contents/renderer';
import FeatureTemplate from '../templates/feature/renderer';
import EditorNoteTemplate from '../templates/editor-note/renderer';
import AdTemplate from '../templates/ad/renderer';
import BackCoverTemplate from '../templates/back-cover/renderer';
import type {
  Edition,
  EditionPresetPage,
  FlatplanPage,
  MagazineAsset,
  Slot,
  Story,
  StoryAssetRef,
  TemplateDefinition,
} from './types';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';

export interface TemplateRenderProps {
  edition: Edition;
  page: FlatplanPage;
  viewModel: Record<string, unknown>;
  imageVersion?: string;
}

/** Context injected by MagazineShell so buildViewModel knows where a story sits across pages. */
export interface StoryPageContext {
  /** 0-based index: how many times this story has already appeared on prior pages. */
  storyOccurrenceIndex: number;
  /** Total flatplan pages that reference this story. 1 means it fits on one page. */
  storyTotalPages: number;
}

export interface TemplateRegistryEntry {
  definition: TemplateDefinition;
  buildDefaultSlots: () => EditionPresetPage['slotDefinitions'];
  buildViewModel: (input: {
    edition: Edition;
    page: FlatplanPage;
    slots: Slot[];
    stories: Story[];
    assets: MagazineAsset[];
    storyOccurrenceIndex?: number;
    storyTotalPages?: number;
  }) => Record<string, unknown>;
  render: ComponentType<TemplateRenderProps>;
}

interface ManualGalleryItem {
  src: string;
  alt?: string;
  caption?: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function looksLikeImportArtifact(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;

  return (
    /^<\?ACE 18\?>$/i.test(normalized) ||
    /\.(indd|idml|icml)$/i.test(normalized) ||
    /^imported from /i.test(normalized) ||
    /^printed by[:\s]/i.test(normalized)
  );
}

function looksLikeGenericMagazineTitle(value?: string): boolean {
  if (!value) return false;
  return /^(ybw|yorkshire)[-\s]*business[-\s]*woman$/i.test(value.trim());
}

function extractMeaningfulParagraphs(value?: string): string[] {
  if (!value) return [];
  return normalizeWhitespace(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => !looksLikeImportArtifact(paragraph));
}

function extractEditorialTitleFromBody(body?: string): string | undefined {
  const paragraphs = extractMeaningfulParagraphs(body);
  if (paragraphs.length === 0) return undefined;

  const first = paragraphs[0];
  if (/^editors?\s*notes?$/i.test(first.replace(/\s+/g, ' '))) return "Editor's Note";
  if (/^cover\s*:/i.test(first) || /disclosure/i.test(first)) return 'Contents & Disclosure';
  if (/^we have another great issue for you/i.test(first) || /by group editor/i.test(body || '')) {
    return "Editor's Note";
  }

  const sentence = first.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  const candidate = sentence.length >= 8 && sentence.length <= 90 ? sentence : first;
  if (!candidate || looksLikeImportArtifact(candidate) || looksLikeGenericMagazineTitle(candidate)) return undefined;

  return candidate;
}

function sanitizeEditorialTitle(title: string | undefined, body?: string, fallback?: string): string | undefined {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (trimmed && !looksLikeImportArtifact(trimmed) && !looksLikeGenericMagazineTitle(trimmed)) {
    return trimmed;
  }

  return extractEditorialTitleFromBody(body) ?? fallback;
}

function sanitizeEditorialStandfirst(value: string | undefined, fallback?: string): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed && !looksLikeImportArtifact(trimmed)) return trimmed;

  const fallbackTrimmed = typeof fallback === 'string' ? fallback.trim() : '';
  if (fallbackTrimmed && !looksLikeImportArtifact(fallbackTrimmed)) return fallbackTrimmed;

  return undefined;
}

function sanitizeEditorialBody(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;

  return normalized
    .replace(/^EditorsNotes\s*/i, '')
    .replace(/^Gill x\s*/i, '')
    .trim();
}

function getStoryPagePosition(story: Story): number | null {
  const pageTag = story.issueTags?.find((tag) => /^page-\d+$/i.test(tag));
  if (!pageTag) return null;

  const value = Number.parseInt(pageTag.replace(/^page-/i, ''), 10);
  return Number.isFinite(value) ? value : null;
}

function buildGeneratedContentsEntries(stories: Story[]) {
  return stories
    .map((story) => ({
      story,
      pagePosition: getStoryPagePosition(story),
      title: sanitizeEditorialTitle(story.title, story.body),
    }))
    .filter(
      (entry): entry is { story: Story; pagePosition: number; title: string } =>
        typeof entry.pagePosition === 'number' && Boolean(entry.title),
    )
    .sort((left, right) => left.pagePosition - right.pagePosition)
    .slice(0, 8)
    .map((entry) => ({
      title: entry.title,
      pageLabel: String(entry.pagePosition).padStart(2, '0'),
    }));
}

function sanitizeEditionDescription(value?: string): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || looksLikeImportArtifact(trimmed)) return undefined;
  return trimmed;
}

function isLocalAssetPath(value?: string): boolean {
  if (!value) return false;
  return value.startsWith('/Users/') || value.startsWith('/Volumes/') || value.startsWith('/private/');
}

function safeImageUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (isLocalAssetPath(trimmed)) return undefined;
  return fixMagazineImageUrl(trimmed);
}

function safeLinkUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || isLocalAssetPath(trimmed)) return undefined;
  return trimmed;
}

function pickFirstImageUrl(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const safe = safeImageUrl(value);
    if (safe) return safe;
  }

  return undefined;
}

function buildSafeGalleryItems(items: Array<Record<string, unknown> | null | undefined>): ManualGalleryItem[] {
  return items.reduce<ManualGalleryItem[]>((accumulator, item) => {
    const src = safeImageUrl(typeof item?.src === 'string' ? item.src : undefined);
    if (!src) return accumulator;

    accumulator.push({
      src,
      alt: typeof item?.alt === 'string' ? item.alt.trim() : undefined,
      caption: typeof item?.caption === 'string' ? item.caption.trim() : undefined,
    });

    return accumulator;
  }, []);
}

function buildSafeStoryGallery(items: StoryAssetRef[]): ManualGalleryItem[] {
  return items.reduce<ManualGalleryItem[]>((accumulator, item) => {
    const src = safeImageUrl(item?.src);
    if (!src) return accumulator;

    accumulator.push({
      src,
      alt: item.alt,
      caption: item.caption,
    });

    return accumulator;
  }, []);
}

function findBoundStory(slots: Slot[], stories: Story[]): Story | null {
  const storyId = slots.find((slot) => slot.binding?.storyId)?.binding?.storyId;
  return stories.find((story) => story.id === storyId) ?? null;
}

function findBoundAsset(slots: Slot[], assets: MagazineAsset[]): MagazineAsset | null {
  const assetId = slots.find((slot) => slot.binding?.assetIds?.length)?.binding?.assetIds?.[0];
  return assets.find((asset) => asset.id === assetId) ?? null;
}

function findSlotByContentType(slots: Slot[], contentType: Slot['contentType']): Slot | null {
  return slots.find((slot) => slot.contentType === contentType) ?? null;
}

function getOverrideString(slot: Slot | null, key: string): string | undefined {
  const value = slot?.overrideData?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function findManualGalleryItems(slots: Slot[]): ManualGalleryItem[] {
  return slots.reduce<ManualGalleryItem[]>((accumulator, slot) => {
    const items = slot.overrideData?.items;
    if (!Array.isArray(items)) return accumulator;

    items.forEach((item) => {
      if (!item || typeof item !== 'object') return;

      const src = safeImageUrl(typeof item.src === 'string' ? item.src : undefined);
      if (!src) return;

      accumulator.push({
        src,
        alt: typeof item.alt === 'string' ? item.alt.trim() : undefined,
        caption: typeof item.caption === 'string' ? item.caption.trim() : undefined,
      });
    });

    return accumulator;
  }, []);
}

function formatPublishDate(publishDate: string): string {
  try {
    return new Date(publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch {
    return publishDate;
  }
}

function humanizeContentType(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

const coverEntry: TemplateRegistryEntry = {
  definition: {
    family: 'cover',
    variant: 'editorial',
    label: 'Cover Editorial',
    editorSchemaKey: 'cover.editorial',
    rendererKey: 'cover/editorial',
    supportsFallbackToIssuu: true,
    allowedSlots: [
      { key: 'heroStory', contentType: 'story', isRequired: true },
      { key: 'coverAsset', contentType: 'gallery', isRequired: false },
    ],
  },
  buildDefaultSlots: () => [
    { key: 'heroStory', contentType: 'story', isRequired: true },
    { key: 'coverAsset', contentType: 'gallery', isRequired: false },
  ],
  buildViewModel: ({ edition, slots, stories, assets }) => {
    const story = findBoundStory(slots, stories);
    const asset = findBoundAsset(slots, assets);
    const manualGallery = findManualGalleryItems(slots);
    const sanitizedBody = sanitizeEditorialBody(story?.body);
    const headline = sanitizeEditorialTitle(story?.title, sanitizedBody, edition.title) ?? edition.title;
    // Both edition.description and edition.subtitle can contain raw IDML import artefacts;
    // sanitizeEditionDescription strips those before they reach the renderer.
    const editionStandfirstFallback =
      sanitizeEditionDescription(edition.description) ??
      sanitizeEditionDescription(edition.subtitle);
    const standfirst = sanitizeEditorialStandfirst(story?.standfirst, editionStandfirstFallback);
    const coverImgSrc =
      safeImageUrl(edition.coverImage) ??
      safeImageUrl(asset?.src) ??
      safeImageUrl(story?.heroImage?.src) ?? '';
    const featureImgSrc =
      safeImageUrl(asset?.src) ??
      safeImageUrl(manualGallery[0]?.src) ??
      safeImageUrl(story?.heroImage?.src) ?? '';
    const gallery = buildSafeGalleryItems((story?.gallery as any) ?? []);

    return {
      // Gen 1 PageCover data shape
      image: coverImgSrc,
      featureImage: featureImgSrc || coverImgSrc,
      headline,
      subheadline: standfirst ?? '',
      date: formatPublishDate(edition.publishDate),
      issue: sanitizeEditionDescription(edition.subtitle) || formatPublishDate(edition.publishDate),
      badge: story?.tags?.[0] ?? 'Lead Feature',
      gallery,
    };
  },
  render: CoverTemplate,
};

const contentsEntry: TemplateRegistryEntry = {
  definition: {
    family: 'contents',
    variant: 'standard',
    label: 'Contents Standard',
    editorSchemaKey: 'contents.standard',
    rendererKey: 'contents/standard',
    supportsFallbackToIssuu: true,
    allowedSlots: [
      { key: 'contentsList', contentType: 'contents', isRequired: true },
      { key: 'contentsHighlight', contentType: 'story', isRequired: false },
    ],
  },
  buildDefaultSlots: () => [
    { key: 'contentsList', contentType: 'contents', isRequired: true },
    { key: 'contentsHighlight', contentType: 'story', isRequired: false },
  ],
  buildViewModel: ({ edition, slots, stories }) => {
    const generatedEntries = slots.find((slot) => slot.contentType === 'contents')?.overrideData?.entries;
    const fallbackEntries = buildGeneratedContentsEntries(stories);
    const rawEntries: Array<{ title: string; pageLabel: string }> =
      Array.isArray(generatedEntries) && generatedEntries.length > 0
        ? (generatedEntries as Array<{ title: string; pageLabel: string }>)
        : fallbackEntries;

    return {
      // Gen 1 PageContents data shape
      title: 'In This Issue',
      kicker: formatPublishDate(edition.publishDate),
      items: rawEntries.map((e) => ({ title: e.title, page: e.pageLabel })),
      // news: [] → PageContents will fetch live news automatically when empty
    };
  },
  render: ContentsTemplate,
};

const editorNoteEntry: TemplateRegistryEntry = {
  definition: {
    family: 'editor-note',
    variant: 'standard',
    label: 'Editor Note',
    editorSchemaKey: 'editor-note.standard',
    rendererKey: 'editor-note/standard',
    allowedSlots: [{ key: 'primaryStory', contentType: 'story', isRequired: true }],
  },
  buildDefaultSlots: () => [{ key: 'primaryStory', contentType: 'story', isRequired: true }],
  buildViewModel: ({ edition, slots, stories }) => {
    const story = findBoundStory(slots, stories);
    const sanitizedBody = sanitizeEditorialBody(story?.body);
    const sanitizedTitle = sanitizeEditorialTitle(story?.title, sanitizedBody, `From the editor: ${edition.title}`) ?? `From the editor: ${edition.title}`;
    const standfirst = sanitizeEditorialStandfirst(story?.standfirst);
    const heroImg = safeImageUrl(story?.heroImage?.src);
    const pullQuote = story?.pullQuotes?.[0];

    return {
      // Gen 1 PageEditorial data shape
      title: sanitizedTitle,
      author: story?.author,
      quote: pullQuote,
      text: sanitizedBody ?? '',
      intro: standfirst ?? '',
      featureImage: heroImg,
      image: heroImg,
      pullQuotes: story?.pullQuotes ?? (pullQuote ? [pullQuote] : []),
    };
  },
  render: EditorNoteTemplate,
};

const adEntry: TemplateRegistryEntry = {
  definition: {
    family: 'ad',
    variant: 'standard',
    label: 'Advertisement',
    editorSchemaKey: 'ad.standard',
    rendererKey: 'ad/standard',
    allowedSlots: [{ key: 'adPanel', contentType: 'ad', isRequired: true }],
  },
  buildDefaultSlots: () => [{ key: 'adPanel', contentType: 'ad', isRequired: true }],
  buildViewModel: ({ slots }) => {
    const adSlot = findSlotByContentType(slots, 'ad');
    const label = getOverrideString(adSlot, 'label') ?? 'Advertisement';
    const advertiserName = getOverrideString(adSlot, 'advertiserName');
    const headline = getOverrideString(adSlot, 'headline');
    const imageSrc = safeImageUrl(getOverrideString(adSlot, 'imageSrc'));
    const ctaHref = safeLinkUrl(getOverrideString(adSlot, 'ctaHref'));

    return {
      // Gen 1 PageFullPageAd data shape
      image: imageSrc,
      label,
      alt: advertiserName || headline || 'Advertisement',
      linkUrl: ctaHref,
    };
  },
  render: AdTemplate,
};

const backCoverEntry: TemplateRegistryEntry = {
  definition: {
    family: 'back-cover',
    variant: 'editorial',
    label: 'Back Cover',
    editorSchemaKey: 'back-cover.editorial',
    rendererKey: 'back-cover/editorial',
    allowedSlots: [
      { key: 'closingNote', contentType: 'static_copy', isRequired: true },
      { key: 'coverAsset', contentType: 'gallery', isRequired: false },
    ],
  },
  buildDefaultSlots: () => [
    { key: 'closingNote', contentType: 'static_copy', isRequired: true },
    { key: 'coverAsset', contentType: 'gallery', isRequired: false },
  ],
  buildViewModel: ({ edition, slots }) => {
    const staticCopySlot = findSlotByContentType(slots, 'static_copy');
    const manualGallery = findManualGalleryItems(slots);
    const title = getOverrideString(staticCopySlot, 'title') ?? edition.title;
    const body = getOverrideString(staticCopySlot, 'body') ?? edition.description ?? '';
    const eyebrow = getOverrideString(staticCopySlot, 'eyebrow') ?? 'Until Next Time';
    const ctaLabel = getOverrideString(staticCopySlot, 'ctaLabel');
    const ctaHref = getOverrideString(staticCopySlot, 'ctaHref');
    const imgSrc =
      safeImageUrl(manualGallery[0]?.src) ??
      safeImageUrl(getOverrideString(staticCopySlot, 'imageSrc')) ??
      safeImageUrl(edition.coverImage) ?? '';

    return {
      // Gen 1 PageBackCover data shape
      title,
      text: body,
      featureImage: imgSrc,
      image: imgSrc,
      kicker: eyebrow,
      cta: ctaLabel || 'Join the Community',
      linkUrl: ctaHref,
      socials: [],
    };
  },
  render: BackCoverTemplate,
};

/**
 * Split an HTML body string into `totalSegments` roughly equal segments
 * so long articles can flow across multiple flatplan pages without repeating
 * from the beginning. Uses DOMParser on the client where it is available.
 */
function segmentHtmlBody(html: string, segmentIndex: number, totalSegments: number): string {
  if (totalSegments <= 1 || !html) return html;

  const paragraphs = html
    .split(/(?:<\/p>\s*<p[^>]*>)|(?:\n\s*\n+)/i)
    .map((segment) => segment.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '').trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return html;

  const boundedIndex = Math.min(Math.max(segmentIndex, 0), totalSegments - 1);
  const remainingParagraphs = paragraphs.length - boundedIndex;
  const remainingSegments = totalSegments - boundedIndex;
  const segmentSize = Math.max(1, Math.ceil(remainingParagraphs / remainingSegments));
  const start = Math.min(boundedIndex * segmentSize, Math.max(paragraphs.length - 1, 0));
  const end = boundedIndex === totalSegments - 1
    ? paragraphs.length
    : Math.min(start + segmentSize, paragraphs.length);
  const chosen = paragraphs.slice(start, Math.max(end, start + 1));

  if (chosen.length === 0) {
    return paragraphs[paragraphs.length - 1] ? `<p>${paragraphs[paragraphs.length - 1]}</p>` : html;
  }

  return chosen.map((paragraph) => `<p>${paragraph}</p>`).join('');
}

/**
 * Map a story's contentType + priority to a 1–4 importance weight.
 * 1 = lead/most prominent, 4 = utility/least prominent.
 */
function storyImportanceWeight(story: Story | null): 1 | 2 | 3 | 4 {
  if (!story) return 3;
  const ct = story.contentType;
  if (ct === 'lead') return 1;
  if (ct === 'editorial' || ct === 'profile') return 2;
  if (ct === 'column' || ct === 'partner' || ct === 'utility') return 4;
  // 'feature' or unknown — fall back to numeric priority if set
  if (typeof story.priority === 'number') {
    if (story.priority >= 75) return 1;
    if (story.priority >= 50) return 2;
    if (story.priority >= 25) return 3;
    return 4;
  }
  return 3;
}

function makeFeatureEntry(variant: 'left-media' | 'right-media' | 'full-bleed'): TemplateRegistryEntry {
  return {
    definition: {
      family: 'feature',
      variant,
      label: `Feature ${variant}`,
      editorSchemaKey: `feature.${variant}`,
      rendererKey: `feature/${variant}`,
      allowedSlots: [
        { key: 'primaryStory', contentType: 'story', isRequired: true },
        { key: 'quoteRail', contentType: 'quote', isRequired: false },
        { key: 'galleryRail', contentType: 'gallery', isRequired: false },
      ],
    },
    buildDefaultSlots: () => [
      { key: 'primaryStory', contentType: 'story', isRequired: true },
      { key: 'quoteRail', contentType: 'quote', isRequired: false },
      { key: 'galleryRail', contentType: 'gallery', isRequired: false },
    ],
    buildViewModel: ({ edition, slots, stories, assets, storyOccurrenceIndex, storyTotalPages }) => {
      const story = findBoundStory(slots, stories);
      const asset = findBoundAsset(slots, assets);
      const quoteSlot = findSlotByContentType(slots, 'quote');
      const adSlot = findSlotByContentType(slots, 'ad');
      const sponsorSlot = findSlotByContentType(slots, 'sponsor');
      const staticCopySlot = findSlotByContentType(slots, 'static_copy');
      const manualGallery = findManualGalleryItems(slots);
      const storyGallery = buildSafeStoryGallery(story?.gallery ?? []);

      const fallbackTitle =
        getOverrideString(adSlot, 'headline') ??
        getOverrideString(staticCopySlot, 'title') ??
        getOverrideString(sponsorSlot, 'sponsorName') ??
        edition.title;
      const fallbackBody =
        getOverrideString(adSlot, 'body') ??
        getOverrideString(staticCopySlot, 'body') ??
        getOverrideString(sponsorSlot, 'body') ??
        '';
      const fallbackImage = pickFirstImageUrl(
        asset?.src,
        manualGallery[0]?.src,
        getOverrideString(adSlot, 'imageSrc'),
        getOverrideString(sponsorSlot, 'imageSrc'),
        story?.heroImage?.src,
        storyGallery[0]?.src,
        edition.coverImage,
      );
      const sanitizedBody = sanitizeEditorialBody(story?.body ?? fallbackBody);
      const sanitizedTitle = story
        ? sanitizeEditorialTitle(story.title, sanitizedBody, fallbackTitle) ?? fallbackTitle
        : fallbackTitle;
      const pullQuote = getOverrideString(quoteSlot, 'quote') ?? story?.pullQuotes?.[0];
      const gallery = manualGallery.length > 0 ? manualGallery : storyGallery;
      const kicker = story?.contentType ? humanizeContentType(story.contentType) : 'Feature';

      // ── Pagination context ──────────────────────────────────────────────
      const occurrenceIndex = storyOccurrenceIndex ?? 0;
      const totalPages = storyTotalPages ?? 1;
      const isContinuation = occurrenceIndex > 0;

      // Segment body text evenly across the pages this story spans.
      // On the first page, show the opening segment; on later pages, continue.
      const fullBody = sanitizedBody ?? fallbackBody;
      const bodySegment = segmentHtmlBody(fullBody, occurrenceIndex, totalPages);

      // Importance weight (1 = lead, 4 = utility) drives typography emphasis
      const weight = storyImportanceWeight(story);

      // ── Continuation page ───────────────────────────────────────────────
      // Strip the opening spread elements (image, standfirst, pull-quote,
      // gallery) so continuation pages show only body text continuation.
      if (isContinuation) {
        return {
          isContinuation: true,
          continuationLabel: sanitizedTitle,
          title: sanitizedTitle,
          kicker,
          name: story?.author,
          text: bodySegment,
          featureImage: '',
          image: '',
          intro: '',
          quote: '',
          pullQuotes: [],
          gallery: [],
          stats: [],
          weight,
        };
      }

      // ── First page of the story ─────────────────────────────────────────
      return {
        // Gen 1 PageFeatureLeft/Right data shape
        // (mediaLayout: 'background' is added by the renderer for full-bleed variant)
        title: sanitizedTitle,
        kicker,
        name: story?.author,
        intro: sanitizeEditorialStandfirst(story?.standfirst) ?? '',
        text: bodySegment,
        featureImage: safeImageUrl(fallbackImage) ?? '',
        image: safeImageUrl(fallbackImage) ?? '',
        quote: pullQuote ?? '',
        pullQuotes: story?.pullQuotes ?? (pullQuote ? [pullQuote] : []),
        gallery,
        stats: [],
        weight,
      };
    },
    render: FeatureTemplate,
  };
}

export const MAGAZINE_TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry> = {
  'cover:editorial': coverEntry,
  'editor-note:standard': editorNoteEntry,
  'contents:standard': contentsEntry,
  'feature:left-media': makeFeatureEntry('left-media'),
  'feature:right-media': makeFeatureEntry('right-media'),
  'feature:full-bleed': makeFeatureEntry('full-bleed'),
  'ad:standard': adEntry,
  'back-cover:editorial': backCoverEntry,
};

export function getTemplateRegistryKey(family: string, variant: string): string {
  return `${family}:${variant}`;
}

export function getTemplateRegistryEntry(family: string, variant: string): TemplateRegistryEntry | null {
  return MAGAZINE_TEMPLATE_REGISTRY[getTemplateRegistryKey(family, variant)] ?? null;
}
