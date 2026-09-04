import { MembersDirectoryClient } from '@/components/MembersDirectoryClient';
import { getMemberStore } from '@/features/members/server';
import type { Metadata } from 'next';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Members Directory',
  description: 'Discover and connect with talented businesswomen across Yorkshire in our members directory.',
  openGraph: {
    title: 'Members Directory | Yorkshire BusinessWoman',
    description: 'Discover and connect with talented businesswomen across Yorkshire.',
    type: 'website',
  },
};

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

    const members = docs.map((doc: any) => {
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
      const image = [avatarUrl, profileImage, profileImageSource, sanitizedData.image].find(url => 
        url && typeof url === 'string' && (url.includes('storage.googleapis.com') || url.includes('firebasestorage.app') || url.includes('firebasestorage.googleapis.com'))
      ) || [avatarUrl, profileImage, profileImageSource, sanitizedData.image].find(url => 
        url && typeof url === 'string' && url.startsWith('http') && !url.includes('gravatar.com/avatar')
      ) || avatarUrl || profileImage;

      return {
        id: doc.id,
        ...sanitizedData,
        name: sanitizedData.displayName || `${sanitizedData.firstName || ''} ${sanitizedData.lastName || ''}`.trim() || sanitizedData.name,
        company: sanitizedData.companyName || sanitizedData.company,
        role: sanitizedData.jobTitle || sanitizedData.role,
        bio: sanitizedData.bio,
        location: sanitizedData.location || sanitizedData.city,
        image: image,
        linkedin: sanitizedData.linkedinUrl || sanitizedData.linkedin,
        website: sanitizedData.websiteUrl || sanitizedData.website
      };
    }).filter((member: any) => {
      // 1. MUST NOT be userInactive
      const isActiveMember = member.userInactive !== true;
      
      // 2. MUST be one of the authorized tiers (or have no tier, treated as free)
      const isValidTier = !member.membershipTier || ['free', 'paid', 'paid_monthly', 'paid_annual', 'complimentary', 'premium', 'founder'].includes(member.membershipTier);
      
      // 3. MUST have a name
      const hasName = member.name && member.name.trim().length > 0;
      
      return isActiveMember && isValidTier && hasName;
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
