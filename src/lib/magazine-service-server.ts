import { adminDb } from './firebase-admin';
import { MagazineIssue, MagazinePage } from './magazine-service';
import { siteContent } from './site-content';

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
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MagazineIssue));
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
      return { id: doc.id, ...doc.data() } as MagazineIssue;
    }
    return null;
  } catch (error) {
    console.error('Error fetching latest issue (server):', error);
    return null;
  }
}

/**
 * Server-side version of magazine pages fetcher
 */
export async function getMagazinePagesServer(issueId: string): Promise<MagazinePage[]> {
  try {
    if (!adminDb) return [];
    
    const snapshot = await adminDb.collection('magazine_issues').doc(issueId).collection('pages')
      .orderBy('id', 'asc')
      .get();
    
    return snapshot.docs.map(doc => ({
      ...doc.data()
    } as MagazinePage));
  } catch (error) {
    console.error(`Error fetching pages for issue ${issueId} (server):`, error);
    return [];
  }
}
