'use server';

import { Event } from '@/lib/events';
import { checkAdmin } from '@/lib/server/auth-utils';
import { currentUser } from '@clerk/nextjs/server';
import { getSystemStore } from '@/features/system/server/system-store';
import { getPgEventStore } from '@/features/events/server/pg-events-store';

/**
 * Fetches event metadata from Postgres by its slug.
 * This is used to get the price, capacity, and other data not easily stored in Ghost.
 */
export async function getEventMetadata(slug: string) {
  try {
    const res = await getPgEventStore().get(slug);
    if (res.success) {
      return { success: true as const, data: res.data as Event };
    }
    return { success: false as const, error: res.error ?? 'Event not found in database' };
  } catch (error: any) {
    console.error('Error fetching event metadata:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates event metadata in Postgres.
 */
export async function updateEventMetadata(slug: string, data: Partial<Event>) {
  try {
    await checkAdmin();
    const res = await getPgEventStore().upsert(slug, data);
    if (!res.success) return res;
    return { success: true as const };
  } catch (error: any) {
    console.error('Error updating event metadata:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all event metadata from Postgres.
 */
export async function getAllEventsMetadata() {
  try {
    const records = await getPgEventStore().listAllBySlug();
    const events: Record<string, any> = {};
    for (const [slug, data] of Object.entries(records)) events[slug] = data;
    return { success: true as const, data: events };
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
    const store = getSystemStore();
    const rec = await store.get('settings:featured-homepage-event');
    const raw = rec?.data as Partial<FeaturedHomepageEvent> | undefined;
    if (!raw || typeof raw.slug !== 'string' || !raw.slug.trim()) {
      return { success: true, data: null };
    }
    return {
      success: true,
      data: {
        slug: raw.slug,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : rec?.updatedAt ?? new Date(0).toISOString(),
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
    const store = getSystemStore();
    const now = new Date().toISOString();
    if (!slug || !slug.trim()) {
      await store.delete('settings:featured-homepage-event');
      return { success: true };
    }
    const emailAddr =
      typeof clerkUser?.primaryEmailAddress?.emailAddress === 'string'
        ? clerkUser.primaryEmailAddress.emailAddress
        : undefined;
    const payload: Record<string, unknown> = {
      slug: slug.trim(),
      updatedAt: now,
      updatedBy: emailAddr,
    };
    await store.set('settings:featured-homepage-event', payload, { merge: false });
    return { success: true };
  } catch (error: any) {
    console.error('Error setting featured homepage event:', error);
    return { success: false, error: error.message };
  }
}
