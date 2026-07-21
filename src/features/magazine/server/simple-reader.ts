import { adminDb } from '@/lib/firebase-admin';
import type { ReaderEdition, ReaderPage } from '../domain/types';

const COLLECTION = 'magazine_reader_editions';

function serializeData(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(serializeData);
  if (typeof data !== 'object') return data;

  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && '_seconds' in value) {
      result[key] = new Date((value as any)._seconds * 1000).toISOString();
    } else if (value && typeof value === 'object' && 'seconds' in value) {
      result[key] = new Date((value as any).seconds * 1000).toISOString();
    } else if (value && typeof value === 'object') {
      result[key] = serializeData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function listReaderEditions(limit = 24): Promise<ReaderEdition[]> {
  if (!adminDb) return [];
  const snapshot = await adminDb
    .collection(COLLECTION)
    .orderBy('publishDate', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map(doc => serializeData({ id: doc.id, ...doc.data() }) as ReaderEdition);
}

export async function getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null> {
  if (!adminDb) return null;
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where('slug', '==', slug)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return serializeData({ id: doc.id, ...doc.data() }) as ReaderEdition;
}

export async function getReaderEditionById(id: string): Promise<ReaderEdition | null> {
  if (!adminDb) return null;
  const doc = await adminDb.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return serializeData({ id: doc.id, ...doc.data() }) as ReaderEdition;
}

export async function upsertReaderEdition(edition: ReaderEdition): Promise<void> {
  if (!adminDb) throw new Error('Firebase Admin not configured');
  await adminDb.collection(COLLECTION).doc(edition.id).set(edition, { merge: true });
}

export async function deleteReaderEdition(id: string): Promise<void> {
  if (!adminDb) throw new Error('Firebase Admin not configured');
  await adminDb.collection(COLLECTION).doc(id).delete();
}
