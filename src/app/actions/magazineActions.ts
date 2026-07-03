'use server';

import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';
import { revalidatePath } from 'next/cache';
import { getPosts } from '@/lib/ghost';

export async function getGhostPostsAction(options?: any) {
  try {
    await checkAdmin();
    const hasGhostKey = Boolean(
      process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || process.env.GHOST_CONTENT_API_KEY
    );
    if (!hasGhostKey) {
      throw new Error('Ghost is not configured (missing Content API key).');
    }
    const posts = await getPosts(options);
    return { success: true, data: posts };
  } catch (error: any) {
    console.error("Error in getGhostPostsAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getMagazineIssuesAction() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    console.log('[magazineActions] Fetching issues...');
    const snapshot = await adminDb.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .get();

    const issues = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convert any Firestore Timestamps to ISO strings for serialization
      const serializedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value && typeof value === 'object' && 'seconds' in value) {
          acc[key] = new Date((value as any).seconds * 1000).toISOString();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      return {
        id: doc.id,
        ...serializedData
      };
    });

    console.log(`[magazineActions] Found ${issues.length} issues`);
    return { success: true, data: issues };
  } catch (error: any) {
    console.error("Error in getMagazineIssuesAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateMagazineIssueAction(issueId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).update({
      ...data,
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/admin/magazine');
    revalidatePath('/magazine');
    
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function setLatestMagazineIssueAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const now = new Date().toISOString();
    const issuesRef = adminDb.collection('magazine_issues');
    const targetRef = issuesRef.doc(issueId);

    await adminDb.runTransaction(async (tx) => {
      const latestSnap = await tx.get(issuesRef.where('isLatest', '==', true));
      for (const doc of latestSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { isLatest: false, updatedAt: now });
      }
      tx.set(targetRef, { isLatest: true, updatedAt: now }, { merge: true });
    });

    revalidatePath('/admin/magazine');
    revalidatePath('/new-edition');
    revalidatePath('/magazine');

    return { success: true };
  } catch (error: any) {
    console.error("Error in setLatestMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function createMagazineIssueAction(data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const docRef = await adminDb.collection('magazine_issues').add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/admin/magazine');
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error in createMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMagazineIssueAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).delete();

    revalidatePath('/admin/magazine');
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getMagazinePagesAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('magazine_issues').doc(issueId).collection('pages')
      .orderBy('id', 'asc')
      .get();

    const pages = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convert any Firestore Timestamps to ISO strings for serialization
      const serializedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value && typeof value === 'object' && 'seconds' in value) {
          acc[key] = new Date((value as any).seconds * 1000).toISOString();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      return {
        docId: doc.id,
        ...serializedData
      };
    });

    return { success: true, data: pages };
  } catch (error: any) {
    console.error("Error in getMagazinePagesAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateMagazinePageAction(issueId: string, pageId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    revalidatePath(`/admin/magazine/builder/${issueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function addMagazinePageAction(issueId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const docRef = await adminDb.collection('magazine_issues').doc(issueId).collection('pages').add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    revalidatePath(`/admin/magazine/builder/${issueId}`);
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error in addMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMagazinePageAction(issueId: string, pageId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).delete();

    revalidatePath(`/admin/magazine/builder/${issueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function fetchIssuuMetadataAction(url: string) {
  try {
    await checkAdmin();
    
    // Issuu oEmbed API endpoint
    const oembedUrl = `https://issuu.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch metadata from Issuu');
    }
    
    const data = await response.json();
    
    // Intelligent Thumbnail Parsing:
    // Issuu oEmbed often returns low-res 'small' or 'medium' thumbnails.
    // We want the high-res version from the isu.pub CDN.
    let highResThumbnail = data.thumbnail_url;
    
    if (data.thumbnail_url) {
      // 1. Try to extract the document ID to build the absolute highest quality URL
      // Pattern: .../image.issuu.com/{ID}/jpg/page_1_thumb_large.jpg
      const idMatch = data.thumbnail_url.match(/(?:image\.issuu\.com|image\.isu\.pub)\/([^\/]+)\//);
      
      if (idMatch && idMatch[1]) {
        // This is the gold standard for Issuu cover images
        highResThumbnail = `https://image.isu.pub/${idMatch[1]}/jpg/page_1.jpg`;
      } else {
        // 2. Fallback: If pattern is different, manually swap quality keywords
        highResThumbnail = data.thumbnail_url
          .replace(/_thumb_(?:small|medium)\.jpg/i, '.jpg')
          .replace(/_thumb_large\.jpg/i, '.jpg')
          .replace(/issuu\.com/i, 'isu.pub');
      }
    }
    
    return { 
      success: true, 
      data: {
        title: data.title,
        thumbnailUrl: highResThumbnail,
        authorName: data.author_name,
        description: data.description
      } 
    };
  } catch (error: any) {
    console.error("Error in fetchIssuuMetadataAction:", error);
    return { success: false, error: error.message };
  }
}
