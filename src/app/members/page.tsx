import { MembersDirectoryClient } from '@/components/MembersDirectoryClient';
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

function isConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.PGHOST ||
    process.env.PGDATABASE ||
    process.env.PGUSER ||
    process.env.PGPASSWORD,
  );
}

async function getMembers() {
  try {
    if (!isConfigured()) {
      return [];
    }

    const store = getMemberStore();
    const snapshots = await store.getAll();
    const docs = snapshots.map((profile) => ({
      id: profile.clerkId,
      data: profile,
    }));

    const mappedMembers = docs.map((doc: any) => {
      const data = doc.data;
      
      // Manually sanitize data to avoid JSON circular issues or other serialization errors
      const sanitizedData: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && value !== null && '_seconds' in value) {
          sanitizedData[key] = new Date((value as any)._seconds * 1000).toISOString();
        } else {
          sanitizedData[key] = value;
        }
      }

      // Find the best image URL, preferring storage over gravatar
      const avatarUrl = sanitizedData.avatarUrl || "";
      const profileImage = sanitizedData.profileImage || "";
      const profileImageSource = sanitizedData.profileImageSource || "";
      const imageCandidates = [avatarUrl, profileImage, profileImageSource, sanitizedData.image];
      const realPhotosFirst = imageCandidates.filter(url =>
        url && typeof url === 'string' && (
          url.startsWith('/uploads/') ||
          (url.startsWith('http') && !url.includes('gravatar.com/avatar'))
        )
      );
      const image = realPhotosFirst[0] || profileImage || avatarUrl;

      return {
        ...sanitizedData,
        // The stable Clerk id must win over any legacy `data.id` in the JSONB
        // blob, otherwise the directory can hand out an ambiguous link target.
        id: doc.id,
        name: sanitizedData.displayName || `${sanitizedData.firstName || ''} ${sanitizedData.lastName || ''}`.trim() || sanitizedData.name,
        company: sanitizedData.companyName || sanitizedData.company,
        role: sanitizedData.jobTitle || sanitizedData.role,
        bio: sanitizedData.bio,
        location: sanitizedData.location || sanitizedData.city,
        image: image,
        linkedin: sanitizedData.linkedinUrl || sanitizedData.linkedin,
        website: sanitizedData.websiteUrl || sanitizedData.website
      };
    });

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

    const members = mappedMembers.map((member: any) => {
      const slug = typeof member.memberSlug === 'string' ? member.memberSlug.trim() : '';
      const uniqueSlug = slug && slugCounts.get(slug) === 1 ? slug : undefined;
      return { ...member, memberSlug: uniqueSlug };
    }).filter((member: any) => {
      // 1. MUST NOT be userInactive
      const isActiveMember = member.userInactive !== true;
      
      // 2. MUST be one of the authorized tiers (or have no tier, treated as free)
      const isValidTier = !member.membershipTier || ['free', 'paid', 'paid_monthly', 'paid_annual', 'complimentary', 'premium', 'founder'].includes(member.membershipTier);
      
      // 3. MUST have a name
      const hasName = member.name && member.name.trim().length > 0;

      // 4. MUST read as a person. A card renders "<name>, <role/company>", so a
      // single-token name ("liz", "Amanda") looks broken, and a business-only
      // sign-up is not a member at all.
      const looksLikePerson = hasName && /\s/.test(String(member.name).trim());
      const slugKeys = [member.memberSlug, member.slug, member.id].filter(
        (v): v is string => typeof v === 'string'
      );
      const isOrganisation = slugKeys.some((k) => ORGANISATION_SLUGS.has(k));

      return isActiveMember && isValidTier && hasName && looksLikePerson && !isOrganisation;
    });

    return members;
  } catch (error: any) {
    console.error('Failed to fetch members from newMemberCollection:', error);
    return [];
  }
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

      {/* Content Section */}
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
