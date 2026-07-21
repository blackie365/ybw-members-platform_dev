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

export interface TemplateRegistryEntry {
  definition: TemplateDefinition;
  buildDefaultSlots: () => EditionPresetPage['slotDefinitions'];
  buildViewModel: (input: {
    edition: Edition;
    page: FlatplanPage;
    slots: Slot[];
    stories: Story[];
    assets: MagazineAsset[];
  }) => Record<string, unknown>;
  render: ComponentType<{
    edition: Edition;
    page: FlatplanPage;
    viewModel: Record<string, unknown>;
  }>;
}

interface ManualGalleryItem {
  src: string;
  alt?: string;
  caption?: string;
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

    return {
      title: story?.title ?? edition.title,
      standfirst: story?.standfirst ?? edition.description,
      coverImage:
        safeImageUrl(asset?.src) ??
        safeImageUrl(manualGallery[0]?.src) ??
        safeImageUrl(story?.heroImage?.src) ??
        safeImageUrl(edition.coverImage),
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
  buildViewModel: ({ page, slots, stories }) => {
    const story = findBoundStory(slots, stories);
    const generatedEntries = slots.find((slot) => slot.contentType === 'contents')?.overrideData?.entries;
    const staticCopySlot = findSlotByContentType(slots, 'static_copy');

    return {
      mode: page.intent === 'back_cover' ? 'closing' : 'contents',
      pageLabel: page.position,
      highlightTitle: story?.title,
      entries: Array.isArray(generatedEntries) ? generatedEntries : [],
      closingEyebrow: getOverrideString(staticCopySlot, 'eyebrow'),
      closingTitle: getOverrideString(staticCopySlot, 'title'),
      closingBody: getOverrideString(staticCopySlot, 'body'),
      closingCtaLabel: getOverrideString(staticCopySlot, 'ctaLabel'),
      closingCtaHref: getOverrideString(staticCopySlot, 'ctaHref'),
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

    return {
      title: story?.title ?? `From the editor: ${edition.title}`,
      standfirst: story?.standfirst,
      body: story?.body,
      author: story?.author,
      heroImage: safeImageUrl(story?.heroImage?.src),
      pullQuote: story?.pullQuotes?.[0],
      pullQuoteAttribution: story?.author,
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
  buildViewModel: ({ edition, slots }) => {
    const adSlot = findSlotByContentType(slots, 'ad');

    return {
      label: getOverrideString(adSlot, 'label') ?? 'Advertisement',
      advertiserName: getOverrideString(adSlot, 'advertiserName'),
      headline: getOverrideString(adSlot, 'headline') ?? edition.title,
      body: getOverrideString(adSlot, 'body'),
      imageSrc: safeImageUrl(getOverrideString(adSlot, 'imageSrc')),
      pdfSrc: safeLinkUrl(getOverrideString(adSlot, 'pdfSrc')),
      ctaLabel: getOverrideString(adSlot, 'ctaLabel'),
      ctaHref: safeLinkUrl(getOverrideString(adSlot, 'ctaHref')),
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

    return {
      eyebrow: getOverrideString(staticCopySlot, 'eyebrow') ?? 'Back Cover',
      title: getOverrideString(staticCopySlot, 'title') ?? edition.title,
      body: getOverrideString(staticCopySlot, 'body') ?? edition.description,
      ctaLabel: getOverrideString(staticCopySlot, 'ctaLabel'),
      ctaHref: getOverrideString(staticCopySlot, 'ctaHref'),
      imageSrc:
        safeImageUrl(manualGallery[0]?.src) ??
        safeImageUrl(getOverrideString(staticCopySlot, 'imageSrc')) ??
        safeImageUrl(edition.coverImage),
    };
  },
  render: BackCoverTemplate,
};

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
    buildViewModel: ({ edition, slots, stories, assets }) => {
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
      const fallbackStandfirst =
        getOverrideString(quoteSlot, 'quote') ??
        getOverrideString(adSlot, 'advertiserName') ??
        getOverrideString(staticCopySlot, 'eyebrow') ??
        edition.description ??
        '';
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

      return {
        title: story?.title ?? fallbackTitle,
        standfirst: story?.standfirst ?? fallbackStandfirst,
        body: story?.body ?? fallbackBody,
        heroImage: fallbackImage,
        author: story?.author,
        contentType: story?.contentType,
        pullQuote: getOverrideString(quoteSlot, 'quote') ?? story?.pullQuotes?.[0],
        pullQuoteAttribution: getOverrideString(quoteSlot, 'attribution') ?? story?.author,
        galleryImages:
          manualGallery.length > 0
            ? manualGallery
            : storyGallery,
        ctaLabel:
          getOverrideString(adSlot, 'ctaLabel') ??
          getOverrideString(sponsorSlot, 'ctaLabel') ??
          getOverrideString(staticCopySlot, 'ctaLabel'),
        ctaHref:
          safeLinkUrl(getOverrideString(adSlot, 'ctaHref')) ??
          safeLinkUrl(getOverrideString(sponsorSlot, 'ctaHref')) ??
          safeLinkUrl(getOverrideString(staticCopySlot, 'ctaHref')),
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
