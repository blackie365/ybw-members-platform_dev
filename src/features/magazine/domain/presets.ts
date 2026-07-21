import type { EditionPreset } from './types';

const NOW = '2026-07-19T00:00:00.000Z';

export const STANDARD_MONTHLY_PRESET: EditionPreset = {
  id: 'standard_monthly',
  label: 'Standard Monthly Issue',
  issueType: 'standard_monthly',
  themeVariant: 'ybw-editorial',
  createdAt: NOW,
  updatedAt: NOW,
  pages: [
    {
      position: 1,
      templateFamily: 'cover',
      templateVariant: 'editorial',
      intent: 'cover',
      slotDefinitions: [
        { key: 'heroStory', contentType: 'story', isRequired: true },
        { key: 'coverAsset', contentType: 'gallery', isRequired: false, placementRules: { maxAssets: 1 } },
      ],
    },
    {
      position: 2,
      templateFamily: 'contents',
      templateVariant: 'standard',
      intent: 'contents',
      slotDefinitions: [
        { key: 'contentsList', contentType: 'contents', isRequired: true },
        {
          key: 'contentsHighlight',
          contentType: 'story',
          isRequired: false,
          placementRules: { acceptsStoryTags: ['highlight', 'featured'] },
        },
      ],
    },
    {
      position: 3,
      templateFamily: 'feature',
      templateVariant: 'left-media',
      intent: 'feature_primary',
      slotDefinitions: [
        { key: 'primaryStory', contentType: 'story', isRequired: true },
        { key: 'quoteRail', contentType: 'quote', isRequired: false },
        { key: 'galleryRail', contentType: 'gallery', isRequired: false, placementRules: { maxAssets: 2 } },
      ],
    },
    {
      position: 4,
      templateFamily: 'feature',
      templateVariant: 'right-media',
      intent: 'feature_secondary',
      slotDefinitions: [
        { key: 'primaryStory', contentType: 'story', isRequired: true },
        { key: 'quoteRail', contentType: 'quote', isRequired: false },
        { key: 'galleryRail', contentType: 'gallery', isRequired: false, placementRules: { maxAssets: 2 } },
      ],
    },
    {
      position: 5,
      templateFamily: 'feature',
      templateVariant: 'full-bleed',
      intent: 'feature_supporting',
      slotDefinitions: [
        { key: 'primaryStory', contentType: 'story', isRequired: true },
        { key: 'galleryRail', contentType: 'gallery', isRequired: false, placementRules: { maxAssets: 1 } },
      ],
    },
    {
      position: 6,
      templateFamily: 'feature',
      templateVariant: 'left-media',
      intent: 'feature_supporting',
      slotDefinitions: [
        { key: 'primaryStory', contentType: 'story', isRequired: true },
        { key: 'quoteRail', contentType: 'quote', isRequired: false },
      ],
    },
    {
      position: 7,
      templateFamily: 'feature',
      templateVariant: 'full-bleed',
      intent: 'ad',
      slotDefinitions: [{ key: 'adPanel', contentType: 'ad', isRequired: true }],
    },
    {
      position: 8,
      templateFamily: 'contents',
      templateVariant: 'standard',
      intent: 'back_cover',
      slotDefinitions: [{ key: 'closingNote', contentType: 'static_copy', isRequired: false }],
    },
  ],
};

export const MAGAZINE_PRESETS: Record<string, EditionPreset> = {
  [STANDARD_MONTHLY_PRESET.id]: STANDARD_MONTHLY_PRESET,
};

export function getMagazinePreset(presetId: string): EditionPreset | null {
  return MAGAZINE_PRESETS[presetId] ?? null;
}
