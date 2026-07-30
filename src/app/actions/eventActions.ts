'use server';

import { adminDb } from '@/lib/firebase-admin';
import { Event } from '@/lib/events';
import { checkAdmin } from '@/lib/server/auth-utils';
import { currentUser } from '@clerk/nextjs/server';

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
    await checkAdmin();
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

export interface FeaturedHomepageEvent {
  slug: string;
  updatedAt: string;
  updatedBy?: string;
}

export async function getFeaturedHomepageEvent(): Promise<{
  success: boolean;
  error?: string;
  data?: FeaturedHomepageEvent | null;
}> {
  try {
    if (!adminDb) return { success: false, error: 'Database not initialized' };
    const doc = await adminDb.collection('settings').doc('featured-homepage-event').get();
    if (!doc.exists) return { success: true, data: null };
    const raw = doc.data() as Partial<FeaturedHomepageEvent> | undefined;
    if (!raw || typeof raw.slug !== 'string' || !raw.slug.trim()) {
      return { success: true, data: null };
    }
    return {
      success: true,
      data: {
        slug: raw.slug,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
        updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
      },
    };
  } catch (error: any) {
    console.error('Error fetching featured homepage event:', error);
    return { success: false, error: error.message };
  }
}

export async function setFeaturedHomepageEvent(slug: string | null): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await checkAdmin();
    const clerkUser = await currentUser();
    if (!adminDb) return { success: false, error: 'Database not initialized' };
    const ref = adminDb.collection('settings').doc('featured-homepage-event');
    const now = new Date().toISOString();
    if (!slug || !slug.trim()) {
      await ref.delete();
      return { success: true };
    }
    const emailAddr =
      typeof clerkUser?.primaryEmailAddress?.emailAddress === 'string'
        ? clerkUser.primaryEmailAddress.emailAddress
        : undefined;
    await ref.set(
      {
        slug: slug.trim(),
        updatedAt: now,
        updatedBy: emailAddr,
      },
      { merge: false }
    );
    return { success: true };
  } catch (error: any) {
    console.error('Error setting featured homepage event:', error);
    return { success: false, error: error.message };
  }
}
