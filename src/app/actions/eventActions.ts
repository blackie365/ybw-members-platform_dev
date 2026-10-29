'use server';

import { Event } from '@/lib/events';
import { checkAdmin } from '@/lib/server/auth-utils';
import { currentUser } from '@clerk/nextjs/server';
import { getSystemStore } from '@/features/system/server/system-store';
import { getPgEventStore, getPgEventAttendeeStore } from '@/features/events/server/pg-events-store';
import { getMemberStore } from '@/features/members/server';
import type { MemberProfile } from '@/features/members/server/member-store';

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

/**
 * Admin UI: off-site guest names per event slug, for the "Off-site sign-ups"
 * editor on the Events tab.
 */
export async function getAllEventGuests() {
  try {
    const data = await getPgEventAttendeeStore().listGuestsBySlug();
    return { success: true as const, data };
  } catch (error: any) {
    console.error('Error fetching event guests:', error);
    return { success: false as const, error: error.message };
  }
}

const HONORIFICS = new Set(['mr', 'mrs', 'miss', 'ms', 'dr', 'sir', 'lady', 'prof', 'professor', 'rev']);

function normaliseName(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Name tokens with any leading title ("MRS", "Dr") removed. */
function nameTokens(value: string): string[] {
  const tokens = normaliseName(value).split(' ').filter(Boolean);
  while (tokens.length > 1 && HONORIFICS.has(tokens[0])) tokens.shift();
  return tokens;
}

interface MemberMatch {
  clerkId: string;
  image: string;
}

interface MemberIndex {
  byFullName: Map<string, MemberMatch[]>;
  bySurnameInitial: Map<string, MemberMatch[]>;
}

/**
 * Index visible, active members so an off-site guest name can be matched back
 * to a profile: first on the full name, then on surname + first-name initial
 * (catches profiles stored as initials, e.g. "C L Strachan").
 */
function buildMemberIndex(members: MemberProfile[]): MemberIndex {
  const byFullName = new Map<string, MemberMatch[]>();
  const bySurnameInitial = new Map<string, MemberMatch[]>();
  const add = (map: Map<string, MemberMatch[]>, key: string, match: MemberMatch) => {
    if (!key) return;
    const list = map.get(key);
    if (list) list.push(match);
    else map.set(key, [match]);
  };

  for (const profile of members) {
    const name = String(profile.displayName ?? '').trim();
    const clerkId = String(profile.clerkId ?? '').trim();
    if (!name || !clerkId) continue;
    const tokens = nameTokens(name);
    if (!tokens.length) continue;
    const match: MemberMatch = {
      clerkId,
      image: typeof profile.profileImage === 'string' ? profile.profileImage : '',
    };
    add(byFullName, tokens.join(' '), match);
    if (tokens.length >= 2) {
      add(bySurnameInitial, `${tokens[tokens.length - 1]}|${tokens[0][0]}`, match);
    }
  }
  return { byFullName, bySurnameInitial };
}

/** Only accept an unambiguous match, so we never link the wrong profile. */
function matchMember(name: string, index: MemberIndex): MemberMatch | null {
  const tokens = nameTokens(name);
  if (!tokens.length) return null;
  const onlyMatch = (list?: MemberMatch[]) => (list && list.length === 1 ? list[0] : null);

  const exact = onlyMatch(index.byFullName.get(tokens.join(' ')));
  if (exact) return exact;
  if (tokens.length >= 2) {
    const byInitial = onlyMatch(
      index.bySurnameInitial.get(`${tokens[tokens.length - 1]}|${tokens[0][0]}`),
    );
    if (byInitial) return byInitial;
  }
  return null;
}

/**
 * Admin UI: replace the off-site guest list for one event.
 * Names already held as a real web RSVP are skipped so they don't appear twice.
 */
export async function setEventGuests(slug: string, names: string[]) {
  try {
    await checkAdmin();
    if (!slug) return { success: false as const, error: 'Missing event slug' };

    const store = getPgEventAttendeeStore();
    const existing = await store.list(slug);
    const existingNames = new Set(
      existing
        .filter((a) => !a.attendeeKey.startsWith('guest:'))
        .map((a) => normaliseName(String(a.data?.name ?? '')))
        .filter(Boolean),
    );

    const memberIndex = buildMemberIndex(await getMemberStore().getAllActive());

    const cleaned: Array<{ name: string; memberUid?: string; image?: string }> = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(names) ? names : []) {
      const name = String(raw ?? '').trim();
      if (!name) continue;
      const key = normaliseName(name);
      if (!key || seen.has(key) || existingNames.has(key)) continue;
      seen.add(key);
      const match = matchMember(name, memberIndex);
      cleaned.push(
        match ? { name, memberUid: match.clerkId, image: match.image } : { name },
      );
    }

    const count = await store.replaceGuests(slug, cleaned);
    return { success: true as const, count };
  } catch (error: any) {
    console.error('Error saving event guests:', error);
    return { success: false as const, error: error.message };
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
