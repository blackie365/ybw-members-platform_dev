export type EventType = 'networking' | 'workshop' | 'conference' | 'social' | 'other';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  networking: 'Networking',
  workshop: 'Workshop',
  conference: 'Conference',
  social: 'Social Event',
  other: 'Other',
};

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  image?: string;
  status: 'published' | 'draft' | 'archived';
  eventType: EventType;
  accessLevel?: 'public' | 'members-only';
  price?: number;
  memberPrice?: number;
  ticketCardEnabled?: boolean;
  capacity?: number;
  registeredCount?: number;
  externalLink?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Post shape as far as the date resolver is concerned (Ghost Content API). */
export interface GhostEventPostLike {
  slug?: string | null;
  tags?: Array<{ slug?: string | null }> | null;
}

/** Tag slug that carries an event's real date, e.g. `event-date-2026-11-12`. */
export const EVENT_DATE_TAG_PREFIX = 'event-date-';

/** Pull a day out of either `YYYY-MM-DD` or UK `DD-MM-YYYY`. */
function parseDayString(value: string | null | undefined): Date | null {
  if (!value) return null;

  let m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  m = value.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * The day an event actually happens on.
 *
 * Ghost exposes no custom fields through the Content API, so the date is kept
 * where the rest of the site already stores post metadata: in a tag slug
 * (`event-date-2026-11-12`, mirroring the existing `ticket-price-10-10`
 * convention). A date baked into the post slug is accepted as a fallback.
 *
 * Returns null when the post carries no date at all — callers must treat that
 * as "unknown", never as "already happened".
 */
export function resolveEventDate(post: GhostEventPostLike): Date | null {
  const tags = Array.isArray(post?.tags) ? post.tags : [];
  for (const tag of tags) {
    const slug = typeof tag?.slug === 'string' ? tag.slug.toLowerCase() : '';
    if (slug.startsWith(EVENT_DATE_TAG_PREFIX)) {
      const parsed = parseDayString(slug.slice(EVENT_DATE_TAG_PREFIX.length));
      if (parsed) return parsed;
    }
  }
  return parseDayString(post?.slug);
}

/** True once the event's day is behind us (an event today still counts as upcoming). */
export function isPastEvent(eventDate: Date, now: Date = new Date()): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return eventDate.getTime() < today;
}
