'use server';

import { adminDb } from '@/lib/firebase-admin';
import { Event } from '@/lib/events';

/**
 * Fetches event metadata from Firestore by its slug.
 * This is used to get the price, capacity, and other data not easily stored in Ghost.
 */
export async function getEventMetadata(slug: string) {
  try {
    if (!adminDb) return { success: false, error: 'Database not initialized' };

    const doc = await adminDb.collection('events').doc(slug).get();
    
    if (doc.exists) {
      return { 
        success: true, 
        data: { id: doc.id, ...doc.data() } as Event 
      };
    }
    
    return { success: false, error: 'Event not found in database' };
  } catch (error: any) {
    console.error('Error fetching event metadata:', error);
    return { success: false, error: error.message };
  }
}
