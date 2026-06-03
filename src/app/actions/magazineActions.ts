'use server';

import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';
import { revalidatePath } from 'next/cache';
import { getPosts } from '@/lib/ghost';

export async function getGhostPostsAction(options?: any) {
  try {
    await checkAdmin();
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

    const issues = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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

    const pages = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));

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
