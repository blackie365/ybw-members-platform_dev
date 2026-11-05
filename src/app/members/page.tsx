import { MembersDirectoryClient } from '@/components/MembersDirectoryClient';
import type { DirectoryMember } from '@/components/MemberCard';
import {
  asString,
  displayNameOf,
  initialsFor,
  isPremiumTier,
  locationFacet,
  resolvePortrait,
} from '@/features/members/display';
import { getMemberStore } from '@/features/members/server';
import type { Metadata } from 'next';
import Link from 'next/link';

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

function isConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.PGHOST ||
    process.env.PGDATABASE ||
    process.env.PGUSER ||
    process.env.PGPASSWORD,
  );
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
      const name = displayNameOf(data);

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
      const portrait = resolvePortrait(data);

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
        ...portrait,
        tier,
        isPremium: isPremiumTier(tier),
        openToMentoring: data.openToMentoring === true,
        seekingMentorship: data.seekingMentorship === true,
        openToBoardRoles: data.openToBoardRoles === true,
        linkedin: asString(data.linkedinUrl) || asString(data.linkedin),
        website: asString(data.websiteUrl) || asString(data.website),
        joinedAt: asString(data.createdAt),
      });
    }

    return members;
  } catch (error: any) {
    console.error('Failed to fetch members from newMemberCollection:', error);
    return [];
  }
}

const EYEBROW = 'text-[11px] font-medium uppercase tracking-[0.17em] text-ink-muted';

/**
 * Shown only when the Postgres connection is missing from the environment. A
 * register with no records is worse than an honest notice, and the connection
 * details are development-only: a visitor has no use for them.
 */
function DirectoryUnavailable() {
  const showDiagnostics = process.env.NODE_ENV !== 'production';

  return (
    <div className="bg-background">
      <section className="mx-auto w-full max-w-[1180px] px-4 pt-14 sm:px-6">
        <p className={EYEBROW}>Yorkshire BusinessWoman</p>
        <h1 className="mt-3 font-serif text-[38px] leading-none tracking-[-0.01em] text-foreground sm:text-[50px]">
          Member directory
        </h1>

        <div className="mt-9 max-w-[620px] border border-rule-strong bg-card px-7 py-8">
          <p className="font-serif text-lg leading-snug text-foreground">
            The directory is unavailable.
          </p>
          <p className="mt-2 text-sm leading-[1.65] text-ink-soft">
            Member records are read from the site database. This environment has no database
            connection configured, so there is nothing to list.
          </p>

          {showDiagnostics && (
            <div className="mt-5 border-t border-border pt-4">
              <p className={EYEBROW}>Set one of</p>
              <ul className="mt-2 space-y-1 font-mono text-[12.5px] text-ink-soft">
                <li>DATABASE_URL</li>
                <li>PGHOST / PGDATABASE / PGUSER / PGPASSWORD</li>
              </ul>
            </div>
          )}

          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center border border-foreground px-5 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Back to the homepage
          </Link>
        </div>
      </section>
    </div>
  );
}

export default async function MembersPage() {
  if (!isConfigured()) {
    return <DirectoryUnavailable />;
  }

  const members = await getMembers();

  return (
    <div className="min-h-screen bg-background">
      <MembersDirectoryClient initialMembers={members} />
    </div>
  );
}
