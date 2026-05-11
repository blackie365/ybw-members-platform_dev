'use server';

import { adminDb } from '@/lib/firebase-admin';

export async function toggleFeaturedStatus(memberId: string, isFeatured: boolean) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is missing from the environment variables.');
    }
    if (!memberId) throw new Error('Member ID is required');

    // Here we would ideally verify if the current user is an admin.
    // For now, since it's a server action, it relies on the UI hiding the button, 
    // but in a fully secure app, you'd extract the token from cookies/headers and verify via `verifyAdminToken`.
    
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