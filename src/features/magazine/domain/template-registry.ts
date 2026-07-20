import type { ComponentType } from 'react';
import CoverTemplate from '../templates/cover/renderer';
import ContentsTemplate from '../templates/contents/renderer';
import FeatureTemplate from '../templates/feature/renderer';
import type {
  Edition,
  EditionPresetPage,
  FlatplanPage,
  MagazineAsset,
  Slot,
  Story,
  TemplateDefinition,
} from './types';

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

      const src = typeof item.src === 'string' ? item.src.trim() : '';
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
      coverImage: asset?.src ?? manualGallery[0]?.src ?? story?.heroImage?.src ?? edition.coverImage,
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
      mode: staticCopySlot ? 'closing' : 'contents',
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
      const fallbackImage =
        asset?.src ??
        manualGallery[0]?.src ??
        getOverrideString(adSlot, 'imageSrc') ??
        getOverrideString(sponsorSlot, 'imageSrc') ??
        story?.heroImage?.src ??
        edition.coverImage;

      return {
        title: story?.title ?? fallbackTitle,
        standfirst: story?.standfirst ?? fallbackStandfirst,
        body: story?.body ?? fallbackBody,
        heroImage: fallbackImage,
        author: story?.author,
        contentType: story?.contentType,
        pullQuote: getOverrideString(quoteSlot, 'quote'),
        pullQuoteAttribution: getOverrideString(quoteSlot, 'attribution'),
        galleryImages: manualGallery,
        ctaLabel:
          getOverrideString(adSlot, 'ctaLabel') ??
          getOverrideString(sponsorSlot, 'ctaLabel') ??
          getOverrideString(staticCopySlot, 'ctaLabel'),
        ctaHref:
          getOverrideString(adSlot, 'ctaHref') ??
          getOverrideString(sponsorSlot, 'ctaHref') ??
          getOverrideString(staticCopySlot, 'ctaHref'),
      };
    },
    render: FeatureTemplate,
  };
}

export const MAGAZINE_TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry> = {
  'cover:editorial': coverEntry,
  'contents:standard': contentsEntry,
  'feature:left-media': makeFeatureEntry('left-media'),
  'feature:right-media': makeFeatureEntry('right-media'),
  'feature:full-bleed': makeFeatureEntry('full-bleed'),
};

export function getTemplateRegistryKey(family: string, variant: string): string {
  return `${family}:${variant}`;
}

export function getTemplateRegistryEntry(family: string, variant: string): TemplateRegistryEntry | null {
  return MAGAZINE_TEMPLATE_REGISTRY[getTemplateRegistryKey(family, variant)] ?? null;
}
