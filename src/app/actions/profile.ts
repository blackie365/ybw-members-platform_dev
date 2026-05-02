'use server';

import { adminDb } from '@/lib/firebase-admin';

export async function getProfile(uid: string) {
  try {
    if (!uid) throw new Error('User ID is required');
    
    const docRef = adminDb.collection('newMemberCollection').doc(uid);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      
      // Sanitize the data to remove any Timestamps before sending to the client
      const sanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
          return new Date(value._seconds * 1000).toISOString();
        }
        return value;
      }));
      
      return { success: true, data: sanitizedData, id: docSnap.id };
    }
    
    return { success: true, data: null };
  } catch (error: any) {
    console.error('Error fetching profile from admin SDK:', error);
    return { success: false, error: error.message || 'Failed to fetch profile' };
  }
}

export async function updateProfile(uid: string, email: string, profileData: any) {
  try {
    if (!uid) throw new Error('User ID is required');
    
    const docRef = adminDb.collection('newMemberCollection').doc(uid);
    
    await docRef.set({
      ...profileData,
      email: email,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating profile from admin SDK:', error);
    return { success: false, error: error.message || 'Failed to update profile' };
  }
}
