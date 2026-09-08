/**
 * Classifieds snapshot — pure, serializable helpers for producing the
 * broadsheet "Business Directory" section from member profiles.
 *
 * The snapshot contract: a classifieds page stores a plain array of
 * `ClassifiedEntry` (no timestamps-as-objects, no nested non-JSON types) in
 * `page.content.entries`, baked once at edition publish time. The reader never
 * queries members live — what was frozen at publication is what renders.
 *
 * This module deliberately imports nothing server-ish so it stays unit-testable
 * and safe to import from client rendering code.
 */

export interface ClassifiedLink {
  /** Public social/profile links, only when absolute http(s) URLs. */
  linkedin: string;
  instagram: string;
  twitter: string;
}

export interface ClassifiedEntry {
  /** Stable identity for React keys — the member's Clerk id. */
  key: string;
  name: string;
  role: string;
  company: string;
  location: string;
  /** Safe public website, only when it is an absolute http(s) URL. */
  website: string;
  /** Public profile photo (storage URLs preferred over blank gravatars). */
  image: string;
  /** Shortened bio preview (newlines collapsed, hard-capped) for the card's strapline. */
  bio: string;
  /** Ticker-style expertise tags: services, then industry, then free tags, deduped. */
  tags: string[];
  links: ClassifiedLink;
  featured: boolean;
}

export const PAID_TIERS = [
  'paid',
  'paid_monthly',
  'paid_annual',
  'complimentary',
  'premium',
  'founder',
] as const;

/** A loose structural view of a member profile (subset of MemberProfile). */
export type ClassifiedSourceMember = Record<string, unknown> & {
  clerkId?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  headline?: string;
  companyName?: string;
  company?: string;
  jobTitle?: string;
  role?: string;
  location?: string;
  city?: string;
  websiteUrl?: string;
  website?: string;
  image?: string;
  avatarUrl?: string;
  profileImage?: string;
  profileImageSource?: string;
  bio?: string;
  services?: unknown;
  tags?: unknown;
  industrySector?: unknown;
  linkedinUrl?: string;
  linkedin?: string;
  instagramUrl?: string;
  instagram?: string;
  twitterUrl?: string;
  twitter?: string;
  membershipTier?: string;
  tier?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  status?: string;
  userInactive?: boolean;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function profileIsActive(profile: ClassifiedSourceMember): boolean {
  if (profile.userInactive === true) return false;
  if (profile.isActive === false) return false;
  const status = asString(profile.status).toLowerCase();
  if (status === 'inactive' || status === 'deleted') return false;
  return true;
}

/**
 * Derive a short monogram for the fallback avatar shown when a member has no
 * profile photo: first letter of the first and last words, quietly punting to
 * the first two letters for single-word names. Non-letter characters are
 * stripped so "O'Connor" and "J L Loftus" produce clean initials.
 */
export function initialsFor(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase();
}

export function isPaidOrFeaturedMember(profile: ClassifiedSourceMember): boolean {
  if (profile.isFeatured === true) return true;
  const tier = asString(profile.tier).toLowerCase() || asString(profile.membershipTier).toLowerCase();
  if (!tier) return false;
  return (PAID_TIERS as readonly string[]).includes(tier);
}

function resolveName(profile: ClassifiedSourceMember): string {
  const display = asString(profile.displayName);
  if (display) return display;
  const first = asString(profile.firstName);
  const last = asString(profile.lastName);
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  return asString(profile.name);
}

function resolveWebsite(profile: ClassifiedSourceMember): string {
  const raw = asString(profile.websiteUrl) || asString(profile.website);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return '';
}

/**
 * Resolve the position line. `headline` (e.g. "Director of Coppergate Clinic in
 * York") is used as a fallback so members who never filled a role/jobTitle
 * still read as settled listings rather than bare names.
 */
function resolveRole(profile: ClassifiedSourceMember): string {
  return asString(profile.role) || asString(profile.jobTitle) || asString(profile.headline);
}

const BIO_MAX = 220;

/**
 * Shorten the bio for a listing line: collapse every run of whitespace to a
 * single space (newspaper column rule) and hard-cap the length so the frozen
 * payload stays lean regardless of how verbose a member profile got.
 */
function resolveBio(profile: ClassifiedSourceMember): string {
  const raw = asString(profile.bio);
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  if (collapsed.length <= BIO_MAX) return collapsed;
  return `${collapsed.slice(0, BIO_MAX).trimEnd()}…`;
}

/**
 * Expertise tags by precedence: the member's chosen services, then the single
 * industry sector, then loose expertise tags — deduped and capped at three so
 * a card never turns into a dense chip wall.
 */
function resolveTags(profile: ClassifiedSourceMember): string[] {
  const collect = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((v) => asString(v)).filter(Boolean);
    const single = asString(value);
    return single ? [single] : [];
  };
  const merged = [
    ...collect(profile.services),
    ...collect(profile.industrySector),
    ...collect(profile.tags),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of merged) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 3) break;
  }
  return out;
}

function resolveLink(profile: ClassifiedSourceMember, fields: (keyof ClassifiedSourceMember)[]): string {
  for (const field of fields) {
    const raw = asString(profile[field]);
    if (raw && /^https?:\/\//i.test(raw)) return raw;
  }
  return '';
}

function resolveLinks(profile: ClassifiedSourceMember): ClassifiedLink {
  return {
    linkedin: resolveLink(profile, ['linkedinUrl', 'linkedin']),
    instagram: resolveLink(profile, ['instagramUrl', 'instagram']),
    twitter: resolveLink(profile, ['twitterUrl', 'twitter']),
  };
}

/**
 * Resolve the best public profile photo, mirroring the directory's preference
 * of storage-hosted uploads over (often blank) gravatar fallbacks.
 */
function resolveImage(profile: ClassifiedSourceMember): string {
  const candidates = [profile.image, profile.avatarUrl, profile.profileImage, profile.profileImageSource];
  const urls = candidates.filter((url): url is string => {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
  });
  const isBlankGravatar = (url: string) => url.includes('gravatar.com/avatar') && url.includes('d=blank');
  const real = urls.find((url) => !isBlankGravatar(url));
  // Blank gravatars are placeholders, not photos — don't ship them.
  return real ? real.trim() : '';
}

/**
 * Convert member profiles into the frozen classifieds rows.
 *
 * Eligibility: active member AND (featured OR on a paid tier) AND has a name.
 * Rows are sorted alphabetically by surname then given name (newspaper
 * classified convention), with only public listing fields carried forward.
 */
export function buildClassifiedEntries(members: ClassifiedSourceMember[]): ClassifiedEntry[] {
  const out: ClassifiedEntry[] = [];
  for (const member of Array.isArray(members) ? members : []) {
    const name = resolveName(member);
    if (!name) continue;
    if (!profileIsActive(member)) continue;
    if (!isPaidOrFeaturedMember(member)) continue;

    const first = asString(member.firstName);
    const last = asString(member.lastName);
    out.push({
      key: asString(member.clerkId) || name,
      name,
      role: resolveRole(member),
      company: asString(member.company) || asString(member.companyName),
      location: asString(member.location) || asString(member.city),
      website: resolveWebsite(member),
      image: resolveImage(member),
      bio: resolveBio(member),
      tags: resolveTags(member),
      links: resolveLinks(member),
      featured: member.isFeatured === true,
    });
  }

  return out.sort((a, b) => {
    const aLast = a.name.split(' ').pop() ?? '';
    const bLast = b.name.split(' ').pop() ?? '';
    const byLast = aLast.localeCompare(bLast, 'en-GB');
    if (byLast !== 0) return byLast;
    return a.name.localeCompare(b.name, 'en-GB');
  });
}

export interface ClassifiedGroup {
  initial: string;
  entries: ClassifiedEntry[];
}

/**
 * Group sorted entries into alphabetical A–Z buckets for the classified
 * page's lettered sections. The bucket letter follows the surname (the same
 * sort key the entries are ordered by), so the A–Z jump index maps cleanly
 * onto the sorted list. Buckets without entries are skipped.
 */
export function groupClassifiedEntries(entries: ClassifiedEntry[]): ClassifiedGroup[] {
  const groups: ClassifiedGroup[] = [];
  let current: ClassifiedGroup | null = null;
  for (const entry of entries) {
    const word = entry.name.split(' ').pop() ?? '';
    const initial = word.charAt(0).toUpperCase();
    if (!initial) continue;
    if (!current || current.initial !== initial) {
      current = { initial, entries: [] };
      groups.push(current);
    }
    current.entries.push(entry);
  }
  return groups;
}