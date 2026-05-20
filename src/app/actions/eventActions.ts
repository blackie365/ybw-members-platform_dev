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

/**
 * Updates event metadata in Firestore.
 */
export async function updateEventMetadata(slug: string, data: Partial<Event>) {
  try {
    if (!adminDb) return { success: false, error: 'Database not initialized' };

    await adminDb.collection('events').doc(slug).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating event metadata:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all event metadata from Firestore.
 */
export async function getAllEventsMetadata() {
  try {
    if (!adminDb) return { success: false, error: 'Database not initialized' };

    const snapshot = await adminDb.collection('events').get();
    const events: Record<string, any> = {};
    
    snapshot.forEach(doc => {
      events[doc.id] = doc.data();
    });

    return { success: true, data: events };
  } catch (error: any) {
    console.error('Error fetching all events metadata:', error);
    return { success: false, error: error.message };
  }
}
