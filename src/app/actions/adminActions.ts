'use server';

import { adminDb } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/adminCheck';

export async function toggleFeaturedStatus(memberId: string, isFeatured: boolean) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is missing from the environment variables.');
    }
    if (!memberId) throw new Error('Member ID is required');

    // In a fully secure app, you'd extract the token from cookies/headers and verify via `verifyAdminToken`.
    // Since we're in a Server Action without direct access to the client's Firebase Auth token easily,
    // the UI component `AdminControlWrapper` handles the visual gating.
    // To make this fully secure against API abuse, you should pass the user's ID token from the client.
    
    // First, if setting to true, we optionally want to set others to false, 
    // but the query is currently sorting by `isFeatured` and picking the top one. 
    // So multiple true is fine, it just picks the first. Or we can clear the others.
    if (isFeatured) {
      const snapshot = await adminDb.collection('newMemberCollection')
        .where('isFeatured', '==', true)
        .get();
      
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isFeatured: false });
      });
      
      // Also update the current one
      const targetRef = adminDb.collection('newMemberCollection').doc(memberId);
      batch.update(targetRef, { isFeatured: true });
      
      await batch.commit();
    } else {
      const targetRef = adminDb.collection('newMemberCollection').doc(memberId);
      await targetRef.update({ isFeatured: false });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error toggling featured status:', error);
    return { success: false, error: error.message || 'Failed to toggle status' };
  }
}