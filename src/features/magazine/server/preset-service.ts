import { getMagazinePreset } from '../domain/presets';
import { replaceFlatplan, upsertEdition, writeMagazineAuditEvent } from './edition-repository';
import type { Edition, FlatplanPage, Slot } from '../domain/types';

function buildFlatplanPageId(editionId: string, position: number): string {
  return `${editionId}-page-${String(position).padStart(2, '0')}`;
}

function buildSlotId(pageId: string, key: string): string {
  return `${pageId}-${key}`;
}

export function buildFlatplanFromPreset(
  editionId: string,
  presetId: string,
): { pages: FlatplanPage[]; slots: Slot[]; themeVariant: string } {
  const preset = getMagazinePreset(presetId);
  if (!preset) {
    throw new Error(`Unknown magazine preset: ${presetId}`);
  }

  const timestamp = new Date().toISOString();
  const pages: FlatplanPage[] = [];
  const slots: Slot[] = [];

  preset.pages.forEach((presetPage) => {
    const pageId = buildFlatplanPageId(editionId, presetPage.position);
    const pageSlotIds = presetPage.slotDefinitions.map((slotDefinition) => buildSlotId(pageId, slotDefinition.key));

    pages.push({
      id: pageId,
      editionId,
      position: presetPage.position,
      templateFamily: presetPage.templateFamily,
      templateVariant: presetPage.templateVariant,
      intent: presetPage.intent,
      status: 'empty',
      slotIds: pageSlotIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    presetPage.slotDefinitions.forEach((slotDefinition) => {
      slots.push({
        id: buildSlotId(pageId, slotDefinition.key),
        editionId,
        flatplanPageId: pageId,
        key: slotDefinition.key,
        contentType: slotDefinition.contentType,
        isRequired: slotDefinition.isRequired,
        placementRules: slotDefinition.placementRules,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  });

  return {
    pages,
    slots,
    themeVariant: preset.themeVariant,
  };
}

export async function applyEditionPreset(edition: Edition, presetId: string): Promise<{
  edition: Edition;
  pages: FlatplanPage[];
  slots: Slot[];
}> {
  if (edition.status !== 'draft' && edition.status !== 'assembling') {
    throw new Error(`Preset application is only allowed for draft or assembling editions. Received: ${edition.status}`);
  }

  const { pages, slots, themeVariant } = buildFlatplanFromPreset(edition.id, presetId);
  const nextEdition: Edition = {
    ...edition,
    presetId,
    themeVariant,
    status: 'assembling',
    updatedAt: new Date().toISOString(),
  };

  await upsertEdition(nextEdition);
  await replaceFlatplan(edition.id, pages, slots);
  await writeMagazineAuditEvent({
    id: `preset-applied-${edition.id}-${Date.now()}`,
    editionId: edition.id,
    type: 'preset_applied',
    actorType: 'system',
    details: { presetId, pageCount: pages.length, slotCount: slots.length },
    createdAt: new Date().toISOString(),
  });

  return {
    edition: nextEdition,
    pages,
    slots,
  };
}
