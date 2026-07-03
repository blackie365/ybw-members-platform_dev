import { adminDb } from './firebase-admin';
import { MagazineIssue, MagazinePage } from './magazine-service';
import { siteContent } from './site-content';
import { fixMagazineImageUrl } from './magazine-utils';

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
    if (!adminDb) {
      console.warn('adminDb not initialized, falling back to static content');
      return siteContent.magazine.issues as unknown as MagazineIssue[];
    }
    
    const snapshot = await adminDb.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .get();
    
    if (snapshot.empty) {
      console.log('No issues found in Firestore, falling back to static content');
      return siteContent.magazine.issues as unknown as MagazineIssue[];
    }
    
    return snapshot.docs.map(doc => serializeData({
      ...doc.data(),
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
    if (!adminDb) return null;
    
    const snapshot = await adminDb.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return serializeData({ ...doc.data(), id: doc.id }) as MagazineIssue;
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
    if (!adminDb) return null;
    
    const doc = await adminDb.collection('magazine_issues').doc(issueId).get();
    
    if (doc.exists) {
      return serializeData({ ...doc.data(), id: doc.id }) as MagazineIssue;
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
    if (!adminDb) {
      console.warn('adminDb not initialized, falling back to static content');
      return siteContent.magazinePages as unknown as MagazinePage[];
    }
    
    const snapshot = await adminDb.collection('magazine_issues').doc(issueId).collection('pages')
      .orderBy('id', 'asc')
      .get();
    
    if (snapshot.empty) {
      console.log(`No pages found in Firestore for issue ${issueId} (server). Returning empty array.`);
      return [];
    }
    
    return snapshot.docs.map(doc => serializeData({
      ...doc.data()
    }) as MagazinePage);
  } catch (error) {
    console.error(`Error fetching pages for issue ${issueId} (server):`, error);
    return siteContent.magazinePages as unknown as MagazinePage[];
  }
}
