import type { IdmlCanonicalBundle } from '../importers/idml-canonical';
import {
  getEditionById,
  replaceFlatplan,
  upsertEdition,
  upsertMagazineAssets,
  upsertStories,
  writeMagazineAuditEvent,
} from './edition-repository';
import type { Edition, MagazineAsset, Slot, Story } from '../domain/types';

export interface ImportCanonicalBundleOptions {
  publish?: boolean;
  overwriteExistingEdition?: boolean;
  markBoundStoriesPlaced?: boolean;
  sourceFilePath?: string;
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

  const edition = normalizeEdition(bundle, options.publish);
  const stories = options.markBoundStoriesPlaced === false ? bundle.stories : markPlacedStories(bundle);
  const assets = normalizeAssets(bundle, edition.id);
  const slots = normalizeSlots(bundle, edition.id);

  await upsertEdition(edition);
  await upsertStories(stories);
  await upsertMagazineAssets(assets);
  await replaceFlatplan(edition.id, bundle.pages, slots);
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
