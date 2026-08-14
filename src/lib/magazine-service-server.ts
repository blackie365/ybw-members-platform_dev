import { adminDb } from './firebase-admin';
import { db as clientFirestoreDb } from './firebase';
import { MagazineIssue, MagazinePage } from './magazine-service';
import { siteContent } from './site-content';
import { fixMagazineImageUrl } from './magazine-utils';

/**
 * Pick a working Firestore instance.
 *
 * Order of preference:
 *   1. Admin SDK (`adminDb`) — available when FIREBASE_PRIVATE_KEY +
 *      FIREBASE_CLIENT_EMAIL are set (local dev, CI, some serverless envs).
 *   2. Client SDK (`clientFirestoreDb`) — always available on Vercel because
 *      it only needs NEXT_PUBLIC_FIREBASE_* env vars (already set there).
 *
 * Both Admin + Client SDKs expose the same `.collection().doc().get()` /
 * `.where().orderBy().limit().get()` surface used below; serializeData()
 * already handles both Timestamp shapes so read results are interchangeable.
 */
function getFirestore(): any {
  if (adminDb) return adminDb;
  if (clientFirestoreDb) return clientFirestoreDb as unknown as any;
  return null;
}

/**
 * Helper to serialize Firestore data for Next.js Server Components.
 * Converts Timestamps to ISO strings and fixes image URLs.
 */
function serializeData(data: any) {
  if (!data) return data;
  
  const serialized = { ...data };
  
  Object.keys(serialized).forEach(key => {
    const value = serialized[key];
    
    // Handle image fields
    if (typeof value === 'string' && (key === 'image' || key === 'coverImage' || key.toLowerCase().includes('imageurl'))) {
      serialized[key] = fixMagazineImageUrl(value);
    }
    
    // Handle Firestore Timestamps (Admin SDK)
    else if (value && typeof value === 'object' && '_seconds' in value) {
      serialized[key] = new Date(value._seconds * 1000).toISOString();
    } 
    // Handle Firestore Timestamps (Client SDK / Some Admin versions)
    else if (value && typeof value === 'object' && 'seconds' in value) {
      serialized[key] = new Date(value.seconds * 1000).toISOString();
    }
    // Handle Dates
    else if (value instanceof Date) {
      serialized[key] = value.toISOString();
    }
    // Recursive for nested objects
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      serialized[key] = serializeData(value);
    }
    // Handle Arrays
    else if (Array.isArray(value)) {
      serialized[key] = value.map(item => 
        (item && typeof item === 'object') ? serializeData(item) : item
      );
    }
  });
  
  return serialized;
}

/**
 * Server-side version of magazine issues fetcher using Firebase Admin SDK
 * Falls back to static siteContent if database fetch fails or is empty.
 */
export async function getMagazineIssuesServer(): Promise<MagazineIssue[]> {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.warn('no firestore available, falling back to static content');
      return siteContent.magazine.issues as unknown as MagazineIssue[];
    }
    
    const snapshot = await firestore.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .get();
    
    if (snapshot.empty) {
      console.log('No issues found in Firestore, falling back to static content');
      return siteContent.magazine.issues as unknown as MagazineIssue[];
    }
    
    const docs = snapshot.docs ?? [];
    return docs.map((doc: any) => serializeData({
      ...(doc.data ? doc.data() : doc),
      id: doc.id,
    }) as MagazineIssue);
  } catch (error) {
    console.error('Error fetching magazine issues (server):', error);
    return siteContent.magazine.issues as unknown as MagazineIssue[];
  }
}

/**
 * Server-side version of latest issue fetcher
 */
export async function getLatestIssueServer(): Promise<MagazineIssue | null> {
  try {
    const firestore = getFirestore();
    if (!firestore) return null;
    
    const snapshot = await firestore.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .limit(1)
      .get();
    
    const docs = snapshot?.docs ?? [];
    if (docs.length > 0) {
      const doc = docs[0];
      return serializeData({ ...(doc.data ? doc.data() : doc), id: doc.id }) as MagazineIssue;
    }
    return null;
  } catch (error) {
    console.error('Error fetching latest issue (server):', error);
    return null;
  }
}

/**
 * Server-side version of single issue fetcher
 */
export async function getMagazineIssueServer(issueId: string): Promise<MagazineIssue | null> {
  try {
    const firestore = getFirestore();
    if (!firestore) return null;
    
    const doc = await firestore.collection('magazine_issues').doc(issueId).get();
    
    const exists = typeof doc.exists === 'boolean' ? doc.exists : Boolean(doc);
    if (exists) {
      return serializeData({ ...(doc.data ? doc.data() : doc), id: issueId }) as MagazineIssue;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching issue ${issueId} (server):`, error);
    return null;
  }
}

/**
 * Server-side version of magazine pages fetcher
 * Falls back to siteContent example pages if Firestore is empty or fetch fails
 */
export async function getMagazinePagesServer(issueId: string): Promise<MagazinePage[]> {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.warn('no firestore available, falling back to static content');
      return siteContent.magazinePages as unknown as MagazinePage[];
    }
    
    const snapshot = await firestore.collection('magazine_issues').doc(issueId).collection('pages')
      .orderBy('id', 'asc')
      .get();
    
    const docs = snapshot?.docs ?? [];
    if (docs.length === 0) {
      console.log(`No pages found in Firestore for issue ${issueId} (server). Returning empty array.`);
      return [];
    }
    
    return docs.map((doc: any) => serializeData({
      ...(doc.data ? doc.data() : doc)
    }) as MagazinePage);
  } catch (error) {
    console.error(`Error fetching pages for issue ${issueId} (server):`, error);
    return siteContent.magazinePages as unknown as MagazinePage[];
  }
}
