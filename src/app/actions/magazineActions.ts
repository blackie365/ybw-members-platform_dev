'use server';

import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';
import { revalidatePath } from 'next/cache';

export async function getMagazineIssuesAction() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .get();

    const issues = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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
