/**
 * Shared presentation rules for the members directory and the member profile
 * page.
 *
 * Both routes show the same person, so the decisions that make a record
 * presentable — which photo counts as a real portrait, whether the optimiser is
 * allowed to fetch its host, what a name's initials are — must live in one
 * place. Duplicating them meant the card and the profile page could disagree
 * about the same member.
 */

/** Hosts the image optimiser may fetch, mirroring next.config.mjs. */
const OPTIMIZER_HOSTS = new Set([
  'yorkshirebusinesswoman.co.uk',
  'img.clerk.com',
  'storage.googleapis.com',
  'images.unsplash.com',
  'admin.yorkshirebusinesswoman.co.uk',
  'static.ghost.org',
  'image.isu.pub',
  'image.issuu.com',
  'img.rocket.new',
]);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');

/**
 * Tier drives the quiet gold accent on a portrait: members on a paid membership,
 * monthly or annual. Free and complimentary memberships never carry it, so the
 * accent keeps pointing at the people funding the network.
 */
const PREMIUM_TIERS = new Set(['paid', 'paid_monthly', 'paid_annual']);

export function isPremiumTier(tier: string): boolean {
  return PREMIUM_TIERS.has(tier);
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A photograph is only usable if it is a real picture of the member. Clerk hands
 * every account a generic grey silhouette, and legacy records often carry a
 * blank gravatar; rendering either produces rows of identical placeholders, which
 * is worse than the typographic monogram drawn instead.
 */
export function isUsablePhoto(url: string): boolean {
  if (!url) return false;
  if (url.includes('gravatar.com/avatar')) return false;
  // Clerk's default avatar is a base64 slug starting `{"type":"default"…`.
  if (url.includes('img.clerk.com') && url.includes('eyJ0eXBlIjoiZGVmYXVsdCI')) return false;
  return url.startsWith('/') || url.startsWith('http');
}

/**
 * Photos we host ourselves are stored as "/uploads/…". The optimiser rejects a
 * relative path with a 400 ("The requested resource isn't a valid image"), so
 * they have to be handed over as an absolute same-origin URL.
 */
export function absolutise(url: string): string {
  if (!url.startsWith('/')) return url;
  return SITE_URL ? `${SITE_URL}${url}` : url;
}

/**
 * The three availability booleans the directory exposes. Kept in a module with
 * no 'use client' directive so the server components can read the list itself:
 * a value re-exported from a client module arrives in a server component as a
 * client reference, not the array.
 */
export const AVAILABILITY_FLAGS = [
  { key: 'openToMentoring', label: 'Open to mentoring' },
  { key: 'seekingMentorship', label: 'Seeking a mentor' },
  { key: 'openToBoardRoles', label: 'Board roles' },
] as const;

export type AvailabilityKey = (typeof AVAILABILITY_FLAGS)[number]['key'];

export function availabilityLabels(flags: Record<AvailabilityKey, boolean>): string[] {
  return AVAILABILITY_FLAGS.filter((flag) => flags[flag.key]).map((flag) => flag.label);
}

export function isOptimizable(url: string): boolean {
  try {
    return OPTIMIZER_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Collapse a free-text place into a facet the directory can group on:
 * "Leeds/Wakefield" → "Leeds", "York, North Yorkshire" → "York".
 */
export function locationFacet(location: string): string {
  if (!location) return '';
  return location.split(/[/,]/)[0].trim();
}

/**
 * The two letters a member is monogrammed with. They come from the name that is
 * printed under the monogram, not from the stored first/last pair, because many
 * records carry a middle initial ahead of the surname ("M Beardsell", "M Rhodes")
 * — read literally that produces the middle initial where the surname's belongs,
 * so the monogram stops matching the name beside it.
 *
 * The stored pair is only a fallback, for the odd single-word display name.
 */
export function initialsFor(firstName: string, lastName: string, name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * The name a member is listed under: their own display name first, then the
 * first/last pair, then whatever name the record carries.
 */
export function displayNameOf(data: Record<string, unknown>): string {
  const firstName = asString(data.firstName);
  const lastName = asString(data.lastName);
  return (
    asString(data.displayName) ||
    `${firstName} ${lastName}`.trim() ||
    asString(data.name)
  );
}

/**
 * The portrait a member is shown with. A photo the member uploaded themselves
 * wins over the one Clerk supplied, which is frequently the generic placeholder.
 */
export function resolvePortrait(data: Record<string, unknown>): {
  image: string;
  hasImage: boolean;
  optimizable: boolean;
} {
  const image = absolutise(
    [
      asString(data.profileImage),
      asString(data.profileImageSource),
      asString(data.image),
      asString(data.avatarUrl),
    ].find(isUsablePhoto) || '',
  );

  return {
    image,
    hasImage: Boolean(image),
    optimizable: Boolean(image) && isOptimizable(image),
  };
}
