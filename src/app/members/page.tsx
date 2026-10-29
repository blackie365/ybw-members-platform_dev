import { MembersDirectoryClient } from '@/components/MembersDirectoryClient';
import type { DirectoryMember } from '@/components/MemberCard';
import { getMemberStore } from '@/features/members/server';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Members Directory',
  description: 'Discover and connect with talented businesswomen across Yorkshire in our members directory.',
  openGraph: {
    title: 'Members Directory | Yorkshire BusinessWoman',
    description: 'Discover and connect with talented businesswomen across Yorkshire.',
    type: 'website',
  },
};

/**
 * Business-only sign-ups: the member record carries the company name and no
 * individual, so there is no one to list in a member directory. Keep this list
 * small and explicit rather than guessing from the name.
 */
const ORGANISATION_SLUGS = new Set(['focus-4hope', 'mexi-bean']);

const VALID_TIERS = new Set([
  'free',
  'paid',
  'paid_monthly',
  'paid_annual',
  'complimentary',
  'premium',
  'founder',
]);

/**
 * Tier drives the quiet gold accent on a card. Membership the member is paying
 * for (or founded) is marked; complimentary and free memberships are not, so
 * the accent keeps meaning something rather than decorating the whole grid.
 */
const PREMIUM_TIERS = new Set(['paid', 'paid_monthly', 'paid_annual', 'premium', 'founder']);

function isConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.PGHOST ||
    process.env.PGDATABASE ||
    process.env.PGUSER ||
    process.env.PGPASSWORD,
  );
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A photograph is only usable if it is a real picture of the member. Clerk hands
 * every account a generic grey silhouette, and legacy records often carry a blank
 * gravatar; rendering either produces rows of identical placeholders, which is
 * worse than the typographic monogram we draw instead.
 */
function isUsablePhoto(url: string): boolean {
  if (!url) return false;
  if (url.includes('gravatar.com/avatar')) return false;
  // Clerk's default avatar is a base64 slug starting `{"type":"default"…`.
  if (url.includes('img.clerk.com') && url.includes('eyJ0eXBlIjoiZGVmYXVsdCI')) return false;
  return url.startsWith('/') || url.startsWith('http');
}

/**
 * Hosts the image optimiser is allowed to fetch, mirroring the
 * `images.remotePatterns` allow-list in next.config.mjs. A photo from any other
 * host has to be served as-is: the optimiser throws on an unknown host.
 */
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
 * Photos we host ourselves are stored as "/uploads/…". The optimiser rejects a
 * relative path with a 400 ("The requested resource isn't a valid image"), so
 * they have to be handed over as an absolute same-origin URL.
 */
function absolutise(url: string): string {
  if (!url.startsWith('/')) return url;
  return SITE_URL ? `${SITE_URL}${url}` : url;
}

function isOptimizable(url: string): boolean {
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
function locationFacet(location: string): string {
  if (!location) return '';
  return location.split(/[/,]/)[0].trim();
}

function initialsFor(firstName: string, lastName: string, name: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

async function getMembers(): Promise<DirectoryMember[]> {
  try {
    if (!isConfigured()) {
      return [];
    }

    const store = getMemberStore();
    const snapshots = await store.getAll();

    // Guard against ambiguous slugs. When a member signs up without a name the
    // slug falls back to the email local-part, so several members can share the
    // same slug (e.g. 'hello'). A slug used by more than one profile resolves
    // unpredictably on the profile page, so we drop it and let the card link to
    // the stable Clerk id instead. We count every value the profile resolver can
    // match on (memberSlug, legacy slug, legacy id) across all visible profiles
    // (before the active/tier filter) so an inactive twin cannot shadow a slug.
    const slugCounts = new Map<string, number>();
    for (const profile of snapshots) {
      const keys = new Set<string>();
      for (const value of [profile.memberSlug, profile.slug, profile.id]) {
        if (typeof value === 'string' && value.trim()) keys.add(value.trim());
      }
      for (const key of keys) slugCounts.set(key, (slugCounts.get(key) || 0) + 1);
    }

    const members: DirectoryMember[] = [];

    for (const profile of snapshots) {
      const data = profile as Record<string, unknown>;

      // 1. MUST NOT be userInactive
      if (data.userInactive === true) continue;

      // 2. MUST be one of the authorized tiers (or have no tier, treated as free)
      const rawTier = asString(data.membershipTier);
      const tier = rawTier || 'free';
      if (!VALID_TIERS.has(tier)) continue;

      const firstName = asString(data.firstName);
      const lastName = asString(data.lastName);
      const name =
        asString(data.displayName) ||
        `${firstName} ${lastName}`.trim() ||
        asString(data.name);

      // 3. MUST have a name that reads as a person. A card renders
      // "<name>, <role/company>", so a single-token name ("liz", "Amanda")
      // looks broken.
      if (!name || !/\s/.test(name)) continue;

      const id = profile.clerkId;
      const slug = asString(profile.memberSlug);
      const uniqueSlug = slug && slugCounts.get(slug) === 1 ? slug : '';

      // 4. A business-only sign-up is not a member at all.
      const slugKeys = [slug, asString(profile.slug), id];
      if (slugKeys.some((key) => ORGANISATION_SLUGS.has(key))) continue;

      const location = asString(data.location) || asString(data.city);

      // Prefer a photo the member uploaded themselves over the one Clerk supplied,
      // which is frequently the generic placeholder.
      const image = absolutise(
        [
          asString(data.profileImage),
          asString(data.profileImageSource),
          asString(data.image),
          asString(data.avatarUrl),
        ].find(isUsablePhoto) || '',
      );

      members.push({
        id,
        linkTarget: uniqueSlug || id,
        name,
        firstName,
        lastName,
        initials: initialsFor(firstName, lastName, name),
        role: asString(data.jobTitle) || asString(data.role),
        company: asString(data.companyName) || asString(data.company),
        location,
        locationFacet: locationFacet(location),
        bio: asString(data.bio),
        image,
        hasImage: Boolean(image),
        optimizable: Boolean(image) && isOptimizable(image),
        tier,
        isPremium: PREMIUM_TIERS.has(tier),
        openToMentoring: data.openToMentoring === true,
        seekingMentorship: data.seekingMentorship === true,
        openToBoardRoles: data.openToBoardRoles === true,
        linkedin: asString(data.linkedinUrl) || asString(data.linkedin),
        website: asString(data.websiteUrl) || asString(data.website),
      });
    }

    return members;
  } catch (error: any) {
    console.error('Failed to fetch members from newMemberCollection:', error);
    return [];
  }
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-serif text-2xl text-foreground">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function MembersPage() {
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative bg-primary py-24 sm:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/15 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-6">
                Our Network
              </p>
              <h1 className="font-serif text-4xl font-medium tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl text-balance">
                Member Directory
              </h1>
              <p className="mt-8 text-lg text-primary-foreground/70 max-w-2xl mx-auto leading-relaxed">
                Connect with inspiring businesswomen across Yorkshire.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-16">
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-8 rounded-lg">
            <h2 className="font-serif text-xl font-medium mb-3">Configuration Required</h2>
            <p className="text-sm leading-relaxed">
              The members directory cannot load because the Firebase Admin credentials are missing from this environment.
            </p>
            <p className="mt-3 text-xs font-mono opacity-80">
              Please add FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL to your Vercel Environment Variables.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const members = await getMembers();
  const locationCount = new Set(members.map((member) => member.locationFacet).filter(Boolean)).size;
  const coachingCount = members.filter((member) => member.openToMentoring).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Masthead */}
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
              Our Network
            </p>
            <h1 className="mt-5 font-serif text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
              Member Directory
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Connect with inspiring businesswomen across Yorkshire.
            </p>

            {members.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-x-12 gap-y-6 border-t border-border pt-6">
                <Stat value={members.length} label="Members listed" />
                <Stat value={locationCount} label="Yorkshire locations" />
                <Stat value={coachingCount} label="Open to coaching" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Directory */}
      <section className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-20">
        {members.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg bg-card/50">
            <p className="text-muted-foreground italic font-serif">No active members found in the directory.</p>
          </div>
        ) : (
          <MembersDirectoryClient initialMembers={members} />
        )}
      </section>
    </div>
  );
}
