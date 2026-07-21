import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IdmlCanonicalBundle } from '../importers/idml-canonical';
import {
  getEditionById,
  replaceFlatplan,
  upsertEdition,
  upsertMagazineAssets,
  upsertStories,
  writeMagazineAuditEvent,
} from './edition-repository';
import type { Edition, MagazineAsset, Slot, Story, StoryAssetRef } from '../domain/types';
import { adminStorage } from '@/lib/firebase-admin';

export interface ImportCanonicalBundleOptions {
  publish?: boolean;
  overwriteExistingEdition?: boolean;
  markBoundStoriesPlaced?: boolean;
  sourceFilePath?: string;
  ingestLocalAssets?: boolean;
}

export interface ImportCanonicalBundleResult {
  edition: Edition;
  created: boolean;
  pageCount: number;
  slotCount: number;
  storyCount: number;
  assetCount: number;
  previewHref: string;
}

function markPlacedStories(bundle: IdmlCanonicalBundle): Story[] {
  const placedStoryIds = new Set(
    bundle.slots
      .map((slot) => slot.binding?.storyId)
      .filter((storyId): storyId is string => Boolean(storyId)),
  );

  return bundle.stories.map((story) =>
    placedStoryIds.has(story.id)
      ? {
          ...story,
          status: 'placed',
          updatedAt: new Date().toISOString(),
        }
      : story,
  );
}

function normalizeEdition(bundle: IdmlCanonicalBundle, publish = false): Edition {
  const now = new Date().toISOString();

  return {
    ...bundle.edition,
    status: publish ? 'ready_for_review' : bundle.edition.status,
    readerMode: 'custom',
    updatedAt: now,
  };
}

function normalizeAssets(bundle: IdmlCanonicalBundle, editionId: string): MagazineAsset[] {
  return bundle.assets.map((asset) => ({
    ...asset,
    editionId,
    updatedAt: new Date().toISOString(),
  }));
}

function sanitizeStorageSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function isLocalAssetPath(value?: string): value is string {
  if (!value) return false;
  return value.startsWith('/Users/') || value.startsWith('/Volumes/') || value.startsWith('/private/');
}

function buildStoragePublicUrl(bucketName: string, storagePath: string): string {
  return `https://storage.googleapis.com/${bucketName}/${storagePath}`;
}

async function uploadLocalAssetToStorage(
  localPath: string,
  storagePath: string,
): Promise<string | null> {
  if (!adminStorage || !isLocalAssetPath(localPath)) return null;

  try {
    await fs.access(localPath);
  } catch {
    return null;
  }

  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    await bucket.upload(localPath, {
      destination: storagePath,
      public: true,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });
  }

  return buildStoragePublicUrl(bucket.name, storagePath);
}

function rewriteStoryAssetRef(
  assetRef: Story['heroImage'],
  assetUrlBySource: Map<string, string>,
): Story['heroImage'] {
  if (!assetRef?.src) return assetRef;
  const rewritten = assetUrlBySource.get(assetRef.src);
  if (!rewritten) return assetRef;
  return {
    ...assetRef,
    src: rewritten,
  };
}

function isStoryAssetRef(value: StoryAssetRef | undefined): value is StoryAssetRef {
  return Boolean(value?.src);
}

function rewriteSlotOverrideUrls(
  value: unknown,
  assetUrlBySource: Map<string, string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteSlotOverrideUrls(item, assetUrlBySource));
  }

  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && assetUrlBySource.has(value)) {
      return assetUrlBySource.get(value);
    }
    return value;
  }

  const input = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, entryValue]) => {
    if (typeof entryValue === 'string' && assetUrlBySource.has(entryValue)) {
      next[key] = assetUrlBySource.get(entryValue);
    } else {
      next[key] = rewriteSlotOverrideUrls(entryValue, assetUrlBySource);
    }
  });
  return next;
}

async function ingestBundleAssets(
  bundle: IdmlCanonicalBundle,
  sourceFilePath?: string,
): Promise<{
  assets: MagazineAsset[];
  stories: Story[];
  slots: Slot[];
  edition: Edition;
}> {
  const bucket = adminStorage?.bucket();
  if (!bucket) {
    return {
      assets: bundle.assets,
      stories: bundle.stories,
      slots: bundle.slots,
      edition: bundle.edition,
    };
  }

  const sourceStem = sanitizeStorageSegment(path.basename(sourceFilePath || bundle.manifest.sourceFile.fileName || bundle.edition.slug));
  const assetUrlBySource = new Map<string, string>();
  const ingestedAssets = await Promise.all(
    bundle.assets.map(async (asset) => {
      if (!isLocalAssetPath(asset.src) || asset.type !== 'image') {
        return asset;
      }

      const extension = path.extname(asset.src) || path.extname(asset.storagePath || asset.id) || '.jpg';
      const roleSegment = sanitizeStorageSegment(asset.role);
      const fileSegment = sanitizeStorageSegment(path.basename(asset.src, path.extname(asset.src)) || asset.id);
      const storagePath = `magazine/imported-idml/${bundle.edition.slug}/${sourceStem}/${roleSegment}-${fileSegment}${extension.toLowerCase()}`;
      const publicUrl = await uploadLocalAssetToStorage(asset.src, storagePath);
      if (!publicUrl) return asset;
      assetUrlBySource.set(asset.src, publicUrl);
      return {
        ...asset,
        src: publicUrl,
        storagePath,
      };
    }),
  );

  const rewrittenStories = bundle.stories.map((story) => ({
    ...story,
    heroImage: rewriteStoryAssetRef(story.heroImage, assetUrlBySource),
    gallery: story.gallery?.map((assetRef) => rewriteStoryAssetRef(assetRef, assetUrlBySource)).filter(isStoryAssetRef),
  }));

  const rewrittenSlots = bundle.slots.map((slot) => ({
    ...slot,
    overrideData: slot.overrideData
      ? (rewriteSlotOverrideUrls(slot.overrideData, assetUrlBySource) as Record<string, unknown>)
      : slot.overrideData,
  }));

  const rewrittenEdition: Edition = {
    ...bundle.edition,
    coverImage: assetUrlBySource.get(bundle.edition.coverImage) || bundle.edition.coverImage,
  };

  return {
    assets: ingestedAssets,
    stories: rewrittenStories,
    slots: rewrittenSlots,
    edition: rewrittenEdition,
  };
}
function normalizeSlots(bundle: IdmlCanonicalBundle, editionId: string): Slot[] {
  return bundle.slots.map((slot) => ({
    ...slot,
    editionId,
    updatedAt: new Date().toISOString(),
  }));
}

export async function importCanonicalBundle(
  bundle: IdmlCanonicalBundle,
  options: ImportCanonicalBundleOptions = {},
): Promise<ImportCanonicalBundleResult> {
  const existing = await getEditionById(bundle.edition.id);
  if (existing && !options.overwriteExistingEdition) {
    throw new Error(`Edition ${bundle.edition.id} already exists. Re-run with overwrite enabled to replace its flatplan.`);
  }

  const ingestedBundle = options.ingestLocalAssets === false ? {
    edition: bundle.edition,
    stories: bundle.stories,
    assets: bundle.assets,
    slots: bundle.slots,
  } : await ingestBundleAssets(bundle, options.sourceFilePath);
  const effectiveBundle: IdmlCanonicalBundle = {
    ...bundle,
    edition: ingestedBundle.edition,
    stories: ingestedBundle.stories,
    assets: ingestedBundle.assets,
    slots: ingestedBundle.slots,
  };

  const edition = normalizeEdition(effectiveBundle, options.publish);
  const stories = options.markBoundStoriesPlaced === false ? effectiveBundle.stories : markPlacedStories(effectiveBundle);
  const assets = normalizeAssets(effectiveBundle, edition.id);
  const slots = normalizeSlots(effectiveBundle, edition.id);

  await upsertEdition(edition);
  await upsertStories(stories);
  await upsertMagazineAssets(assets);
  await replaceFlatplan(edition.id, effectiveBundle.pages, slots);
  await writeMagazineAuditEvent({
    id: `idml-import-${edition.id}-${Date.now()}`,
    editionId: edition.id,
    type: 'edition_updated_from_issuu',
    actorType: 'system',
    details: {
      importSource: 'idml',
      sourceFilePath: options.sourceFilePath || bundle.manifest.sourceFile.path,
      pageCount: bundle.pages.length,
      slotCount: slots.length,
      storyCount: stories.length,
      assetCount: assets.length,
      warnings: bundle.summary.warnings,
    },
    createdAt: new Date().toISOString(),
  });

  return {
    edition,
    created: !existing,
    pageCount: bundle.pages.length,
    slotCount: slots.length,
    storyCount: stories.length,
    assetCount: assets.length,
    previewHref: `/magazine/v2/${edition.slug}`,
  };
}
