import { db } from './firebase';
import { collection, getDocs, getDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import { siteContent } from './site-content';

export interface MagazineIssue {
  id: string;
  title: string;
  coverImage: string;
  publishDate: string;
  description: string;
  pdfUrl: string;
  downloadUrl?: string;
  isLatest: boolean;
  tags: string[];
  readerType?: 'custom' | 'issuu';
}

export interface MagazinePage {
  id: number;
  type: string;
  content: any;
}

/**
 * Fetches all magazine issues from Firestore
 */
export async function getMagazineIssues(): Promise<MagazineIssue[]> {
  try {
    const issuesRef = collection(db, 'magazine_issues');
    const q = query(issuesRef, orderBy('publishDate', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MagazineIssue));
  } catch (error) {
    console.error('Error fetching magazine issues:', error);
    return [];
  }
}

/**
 * Fetches a single magazine issue by ID
 */
export async function getMagazineIssue(id: string): Promise<MagazineIssue | null> {
  try {
    const issueRef = doc(db, 'magazine_issues', id);
    const issueDoc = await getDoc(issueRef);
    
    if (issueDoc.exists()) {
      return { id: issueDoc.id, ...issueDoc.data() } as MagazineIssue;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching issue ${id}:`, error);
    return null;
  }
}

/**
 * Fetches all pages for a specific magazine issue
 * Falls back to siteContent example pages if Firestore is empty or fetch fails
 */
export async function getMagazinePages(issueId: string): Promise<MagazinePage[]> {
  try {
    const pagesRef = collection(db, 'magazine_issues', issueId, 'pages');
    const q = query(pagesRef, orderBy('id', 'asc'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log(`No pages found in Firestore for issue ${issueId}, falling back to example data`);
      return siteContent.magazinePages as unknown as MagazinePage[];
    }
    
    return snapshot.docs.map(doc => ({
      ...doc.data()
    } as MagazinePage));
  } catch (error) {
    console.error(`Error fetching pages for issue ${issueId}:`, error);
    return siteContent.magazinePages as unknown as MagazinePage[];
  }
}

/**
 * Fetches the latest magazine issue
 */
export async function getLatestIssue(): Promise<MagazineIssue | null> {
  try {
    const issuesRef = collection(db, 'magazine_issues');
    const q = query(issuesRef, orderBy('publishDate', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as MagazineIssue;
    }
    return null;
  } catch (error) {
    console.error('Error fetching latest issue:', error);
    return null;
  }
}
