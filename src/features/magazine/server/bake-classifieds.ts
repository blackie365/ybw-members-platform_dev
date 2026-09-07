import type { ReaderPage } from '../domain/types';
import { buildClassifiedEntries } from '../domain/classifieds';
import { getMagazineReadStore } from './read-store';
import { getMagazineWriteStore } from './write-store';
import { getMemberStore } from '@/features/members/server';

/**
 * Bake the members directory into an edition as a frozen "Classifieds" page.
 *
 * This is the snapshot step: it reads the paid/featured active members once,
 * serialises them into `ClassifiedEntry` rows and writes a `classifieds`
 * ReaderPage into `magazine_reader_editions`. The reader renders whatever was
 * frozen here; it never re-queries members at read time.
 *
 * Insertion order: replaces an existing classifieds page if one is present,
 * otherwise splices one in ahead of the back cover (or at the end). Page
 * positions are renumbered 1..N so the reader sort stays stable.
 */
export interface BakeClassifiedsResult {
  ok: boolean;
  editionId?: string;
  slug?: string;
  count?: number;
  reason?: string;
}

export async function bakeClassifiedsIntoEdition(input: {
  editionId?: string;
  slug?: string;
} = {}): Promise<BakeClassifiedsResult> {
  const read = getMagazineReadStore();
  let edition = input.editionId
    ? await read.getReaderEditionById(input.editionId)
    : input.slug
      ? await read.getReaderEditionBySlug(input.slug)
      : null;

  // No explicit target → bake into the most recently published edition.
  if (!edition) {
    const latest = await read.listReaderEditions(1);
    edition = latest[0] ?? null;
  }
  if (!edition || !Array.isArray(edition.pages)) {
    return { ok: false, reason: 'Edition not found' };
  }

  const members = await getMemberStore().getAllActive();
  const entries = buildClassifiedEntries(members);
  const generatedAt = new Date().toISOString();

  const classifiedPage: ReaderPage = {
    id: 'classifieds',
    position: 0,
    template: 'classifieds',
    content: {
      title: 'Classifieds',
      body: '',
      kicker: 'Business Directory',
      intro:
        'Paid and featured members of Yorkshire BusinessWoman — a snapshot of the community, printed as it stood at publication.',
      entries,
      generatedAt,
    },
  };

  const pages = [...edition.pages];
  const existingIdx = pages.findIndex(
    (p) => String(p.template || '').trim().toLowerCase() === 'classifieds',
  );
  if (existingIdx >= 0) {
    classifiedPage.position = pages[existingIdx].position;
    pages[existingIdx] = { ...classifiedPage };
  } else {
    const backIdx = pages.findIndex(
      (p) => String(p.template || '').trim().toLowerCase() === 'back-cover',
    );
    pages.splice(backIdx >= 0 ? backIdx : pages.length, 0, classifiedPage);
  }

  const renumbered = pages.map((page, index) => ({ ...page, position: index + 1 }));

  await getMagazineWriteStore().upsertReaderEdition({
    ...edition,
    pages: renumbered,
    pageCount: renumbered.length,
  });

  return { ok: true, editionId: edition.id, slug: edition.slug, count: entries.length };
}