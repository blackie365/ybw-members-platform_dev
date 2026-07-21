export type EditionStatus =
  | 'draft'
  | 'assembling'
  | 'ready_for_review'
  | 'review_changes_requested'
  | 'approved'
  | 'scheduled'
  | 'live'
  | 'archived';

export type ReaderMode = 'custom' | 'issuu_fallback' | 'issuu_only';

export type SlotContentType =
  | 'story'
  | 'editorial_note'
  | 'contents'
  | 'ad'
  | 'sponsor'
  | 'quote'
  | 'gallery'
  | 'static_copy';

export type StoryStatus = 'candidate' | 'approved' | 'placed' | 'archived';

export type StoryContentType =
  | 'lead'
  | 'feature'
  | 'profile'
  | 'column'
  | 'editorial'
  | 'partner'
  | 'utility';

export type SlotBindingMode = 'auto' | 'manual' | 'locked';

export interface IssuuSource {
  publicationId?: string;
  publicationSlug?: string;
  shareUrl?: string;
  embedUrl?: string;
  downloadUrl?: string;
  coverImage?: string;
  publishDate?: string;
  syncedAt?: string;
}

export interface Edition {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  publishDate: string;
  coverImage: string;
  status: EditionStatus;
  readerMode: ReaderMode;
  themeVariant: string;
  isLive: boolean;
  presetId?: string;
  latestRevisionId?: string;
  issuu: IssuuSource;
  createdAt: string;
  updatedAt: string;
  liveAt?: string;
}

export type FlatplanIntent =
  | 'cover'
  | 'editor_note'
  | 'contents'
  | 'feature_primary'
  | 'feature_secondary'
  | 'feature_supporting'
  | 'ad'
  | 'back_cover';

export interface FlatplanPage {
  id: string;
  editionId: string;
  position: number;
  spreadId?: string;
  spreadIndex?: number;
  pageIndexInSpread?: number;
  spreadPageCount?: number;
  spreadPageIds?: string[];
  spreadPagePositions?: number[];
  templateFamily: string;
  templateVariant: string;
  intent: FlatplanIntent;
  status: 'empty' | 'filled' | 'needs_review' | 'approved';
  slotIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SlotPlacementRules {
  acceptsStoryTags?: string[];
  excludesStoryIds?: string[];
  maxAssets?: number;
  requiredSource?: 'ghost' | 'manual' | 'sponsor';
}

export interface SlotBinding {
  storyId?: string;
  assetIds?: string[];
  sponsorId?: string;
  adPlacementId?: string;
  generatedContentId?: string;
  staticBlockId?: string;
}

export interface Slot {
  id: string;
  editionId: string;
  flatplanPageId: string;
  key: string;
  contentType: SlotContentType;
  isRequired: boolean;
  bindingMode?: SlotBindingMode;
  placementRules?: SlotPlacementRules;
  binding?: SlotBinding;
  automationConfidence?: number;
  reviewReason?: string;
  manualOverride?: boolean;
  overrideData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StoryAssetRef {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface Story {
  id: string;
  source: 'ghost' | 'manual' | 'imported' | 'legacy';
  sourceRef?: string;
  title: string;
  standfirst?: string;
  body?: string;
  author?: string;
  tags: string[];
  priority?: number;
  contentType?: StoryContentType;
  includedInEditionCandidatePool?: boolean;
  editorialConfidence?: number;
  placementConfidence?: number;
  issueTags?: string[];
  manualNotes?: string;
  heroImage?: StoryAssetRef;
  gallery?: StoryAssetRef[];
  pullQuotes?: string[];
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MagazineAsset {
  id: string;
  type: 'image' | 'video' | 'pdf';
  role: 'cover' | 'hero' | 'inline' | 'gallery' | 'ad' | 'sponsor' | 'download';
  src: string;
  alt?: string;
  caption?: string;
  editionId?: string;
  storagePath?: string;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SponsorBlock {
  id: string;
  editionId?: string;
  sponsorName: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageSrc?: string;
  placementTags?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdPlacement {
  id: string;
  editionId?: string;
  advertiserName: string;
  headline?: string;
  body?: string;
  imageSrc?: string;
  targetHref?: string;
  placementTags?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EditionPresetPage {
  position: number;
  templateFamily: string;
  templateVariant: string;
  intent: FlatplanIntent;
  slotDefinitions: Array<{
    key: string;
    contentType: SlotContentType;
    isRequired: boolean;
    placementRules?: SlotPlacementRules;
  }>;
}

export interface EditionPreset {
  id: string;
  label: string;
  issueType: 'standard_monthly' | 'awards_special' | 'sponsored_issue';
  themeVariant: string;
  pages: EditionPresetPage[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDefinition {
  family: string;
  variant: string;
  label: string;
  description?: string;
  editorSchemaKey: string;
  rendererKey: string;
  allowedSlots: Array<{
    key: string;
    contentType: SlotContentType;
    isRequired: boolean;
  }>;
  supportsFallbackToIssuu?: boolean;
}

export interface MagazineAuditEvent {
  id: string;
  editionId?: string;
  type:
    | 'edition_created_from_issuu'
    | 'edition_updated_from_issuu'
    | 'preset_applied'
    | 'slot_auto_filled'
    | 'slot_overridden'
    | 'manual_override_saved'
    | 'contents_generated'
    | 'edition_published'
    | 'edition_unpublished'
    | 'edition_live_switched'
    | 'review_requested';
  actorType: 'system' | 'admin';
  actorId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface IssuuPublicationSummary {
  documentId?: string;
  title: string;
  slug: string;
  description?: string;
  publishDate?: string;
  createdAt?: string;
  updatedAt?: string;
  coverUrl?: string;
  coverUrlLarge?: string;
  shareUrl?: string;
  readerShareUrl?: string;
  embedUrl?: string;
  ownerUsername?: string;
  tags?: string[];
  downloadUrl?: string;
}

export interface SyncIssuuEditionsResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface AutoFillSlotsResult {
  filledSlots: number;
  unresolvedSlots: string[];
  warnings: string[];
}
