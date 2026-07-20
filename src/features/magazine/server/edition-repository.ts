import { adminDb } from '@/lib/firebase-admin';
import type {
  AdPlacement,
  Edition,
  FlatplanPage,
  MagazineAsset,
  MagazineAuditEvent,
  Slot,
  SponsorBlock,
  Story,
} from '../domain/types';

const EDITIONS_COLLECTION = 'magazine_editions';
const STORY_LIBRARY_COLLECTION = 'magazine_story_library';
const ASSETS_COLLECTION = 'magazine_assets';
const SPONSORS_COLLECTION = 'magazine_sponsor_blocks';
const AD_PLACEMENTS_COLLECTION = 'magazine_ad_placements';
const AUDIT_COLLECTION = 'magazine_audit_log';

function requireAdminDb() {
  if (!adminDb) {
    throw new Error('Firebase Admin is not configured for magazine edition operations.');
  }

  return adminDb;
}

function serializeRecord<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => serializeRecord(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') {
    return maybeTimestamp.toDate().toISOString() as T;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, serializeRecord(entry)]),
  ) as T;
}

export async function getEditionById(editionId: string): Promise<Edition | null> {
  const db = requireAdminDb();
  const snapshot = await db.collection(EDITIONS_COLLECTION).doc(editionId).get();

  if (!snapshot.exists) return null;

  return serializeRecord({
    id: snapshot.id,
    ...snapshot.data(),
  } as Edition);
}

export async function getEditionBySlug(slug: string): Promise<Edition | null> {
  const db = requireAdminDb();
  const snapshot = await db
    .collection(EDITIONS_COLLECTION)
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return serializeRecord({
    id: doc.id,
    ...doc.data(),
  } as Edition);
}

export async function listEditions(limitCount = 24): Promise<Edition[]> {
  const db = requireAdminDb();
  const snapshot = await db
    .collection(EDITIONS_COLLECTION)
    .orderBy('publishDate', 'desc')
    .limit(limitCount)
    .get();

  return snapshot.docs.map((doc) =>
    serializeRecord({
      id: doc.id,
      ...doc.data(),
    } as Edition),
  );
}

export async function upsertEdition(edition: Edition): Promise<void> {
  const db = requireAdminDb();
  await db.collection(EDITIONS_COLLECTION).doc(edition.id).set(edition, { merge: true });
}

export async function upsertFlatplanPages(editionId: string, pages: FlatplanPage[]): Promise<void> {
  if (pages.length === 0) return;

  const db = requireAdminDb();
  const collectionRef = db.collection(EDITIONS_COLLECTION).doc(editionId).collection('flatplan_pages');
  const batch = db.batch();

  pages.forEach((page) => {
    batch.set(collectionRef.doc(page.id), page, { merge: true });
  });

  batch.set(
    db.collection(EDITIONS_COLLECTION).doc(editionId),
    {
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await batch.commit();
}

export async function replaceFlatplan(
  editionId: string,
  pages: FlatplanPage[],
  slots: Slot[],
): Promise<void> {
  const db = requireAdminDb();
  const pagesCollection = db.collection(EDITIONS_COLLECTION).doc(editionId).collection('flatplan_pages');
  const slotsCollection = db.collection(EDITIONS_COLLECTION).doc(editionId).collection('slots');

  const [existingPages, existingSlots] = await Promise.all([pagesCollection.get(), slotsCollection.get()]);
  const batch = db.batch();

  existingPages.docs.forEach((doc) => batch.delete(doc.ref));
  existingSlots.docs.forEach((doc) => batch.delete(doc.ref));

  pages.forEach((page) => {
    batch.set(pagesCollection.doc(page.id), page);
  });

  slots.forEach((slot) => {
    batch.set(slotsCollection.doc(slot.id), slot);
  });

  batch.set(
    db.collection(EDITIONS_COLLECTION).doc(editionId),
    {
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await batch.commit();
}

export async function listFlatplanPages(editionId: string): Promise<FlatplanPage[]> {
  const db = requireAdminDb();
  const snapshot = await db
    .collection(EDITIONS_COLLECTION)
    .doc(editionId)
    .collection('flatplan_pages')
    .orderBy('position', 'asc')
    .get();

  return snapshot.docs.map((doc) =>
    serializeRecord({
      id: doc.id,
      ...doc.data(),
    } as FlatplanPage),
  );
}

export async function listSlots(editionId: string): Promise<Slot[]> {
  const db = requireAdminDb();
  const snapshot = await db.collection(EDITIONS_COLLECTION).doc(editionId).collection('slots').get();

  return snapshot.docs.map((doc) =>
    serializeRecord({
      id: doc.id,
      ...doc.data(),
    } as Slot),
  );
}

export async function upsertSlots(editionId: string, slots: Slot[]): Promise<void> {
  const db = requireAdminDb();
  const collectionRef = db.collection(EDITIONS_COLLECTION).doc(editionId).collection('slots');
  const batch = db.batch();

  slots.forEach((slot) => {
    batch.set(collectionRef.doc(slot.id), slot, { merge: true });
  });

  await batch.commit();
}

export async function upsertStories(stories: Story[]): Promise<void> {
  if (stories.length === 0) return;

  const db = requireAdminDb();
  const batch = db.batch();

  stories.forEach((story) => {
    batch.set(db.collection(STORY_LIBRARY_COLLECTION).doc(story.id), story, { merge: true });
  });

  await batch.commit();
}

export async function listMagazineAssets(editionId?: string, limitCount = 100): Promise<MagazineAsset[]> {
  const db = requireAdminDb();
  let query = db.collection(ASSETS_COLLECTION).limit(limitCount);

  if (editionId) {
    query = query.where('editionId', '==', editionId);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) =>
    serializeRecord({
      id: doc.id,
      ...doc.data(),
    } as MagazineAsset),
  );
}

export async function upsertMagazineAssets(assets: MagazineAsset[]): Promise<void> {
  if (assets.length === 0) return;

  const db = requireAdminDb();
  const batch = db.batch();

  assets.forEach((asset) => {
    batch.set(db.collection(ASSETS_COLLECTION).doc(asset.id), asset, { merge: true });
  });

  await batch.commit();
}

export async function listSponsorBlocks(editionId?: string, limitCount = 50): Promise<SponsorBlock[]> {
  const db = requireAdminDb();
  let query = db.collection(SPONSORS_COLLECTION).limit(limitCount);

  if (editionId) {
    query = query.where('editionId', '==', editionId);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) =>
    serializeRecord({
      id: doc.id,
      ...doc.data(),
    } as SponsorBlock),
  );
}

export async function upsertSponsorBlocks(blocks: SponsorBlock[]): Promise<void> {
  if (blocks.length === 0) return;

  const db = requireAdminDb();
  const batch = db.batch();

  blocks.forEach((block) => {
    batch.set(db.collection(SPONSORS_COLLECTION).doc(block.id), block, { merge: true });
  });

  await batch.commit();
}

export async function listAdPlacements(editionId?: string, limitCount = 50): Promise<AdPlacement[]> {
  const db = requireAdminDb();
  let query = db.collection(AD_PLACEMENTS_COLLECTION).limit(limitCount);

  if (editionId) {
    query = query.where('editionId', '==', editionId);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) =>
    serializeRecord({
      id: doc.id,
      ...doc.data(),
    } as AdPlacement),
  );
}

export async function upsertAdPlacements(placements: AdPlacement[]): Promise<void> {
  if (placements.length === 0) return;

  const db = requireAdminDb();
  const batch = db.batch();

  placements.forEach((placement) => {
    batch.set(db.collection(AD_PLACEMENTS_COLLECTION).doc(placement.id), placement, { merge: true });
  });

  await batch.commit();
}

export async function listCandidateStories(limitCount = 50): Promise<Story[]> {
  const db = requireAdminDb();
  const snapshot = await db
    .collection(STORY_LIBRARY_COLLECTION)
    .where('status', 'in', ['candidate', 'approved'])
    .limit(limitCount)
    .get();

  return snapshot.docs.map((doc) =>
    serializeRecord({
      id: doc.id,
      ...doc.data(),
    } as Story),
  );
}

export async function writeMagazineAuditEvent(event: MagazineAuditEvent): Promise<void> {
  const db = requireAdminDb();
  await db.collection(AUDIT_COLLECTION).doc(event.id).set(event, { merge: false });
}

export async function listMagazineAuditEvents(options?: {
  editionId?: string;
  limitCount?: number;
}): Promise<MagazineAuditEvent[]> {
  const db = requireAdminDb();
  const limitCount = options?.limitCount ?? 50;
  let query = db.collection(AUDIT_COLLECTION).orderBy('createdAt', 'desc').limit(limitCount);

  if (options?.editionId) {
    query = query.where('editionId', '==', options.editionId).orderBy('createdAt', 'desc').limit(limitCount);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) =>
    serializeRecord({
      id: doc.id,
      ...doc.data(),
    } as MagazineAuditEvent),
  );
}
