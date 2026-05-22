import { MembersDirectoryClient } from '@/components/MembersDirectoryClient';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getMembers() {
  try {
    if (!adminDb) {
      return [];
    }

    const snapshot = await adminDb.collection('newMemberCollection').get();

    const members = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      
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
      
      // 2. MUST be one of the authorized tiers
      const isValidTier = ['free', 'paid', 'paid_monthly', 'paid_annual', 'complimentary', 'premium'].includes(member.membershipTier);
      
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
        <section className="relative border-b border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
            <div className="max-w-3xl">
              <span className="inline-block text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground mb-6">
                Our Network
              </span>
              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-foreground leading-[1.1]">
                Member Directory
              </h1>
              <p className="mt-8 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                Connect with inspiring businesswomen across Yorkshire.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-16">
          <div className="bg-destructive/5 border border-destructive/20 text-destructive p-8">
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
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground mb-6">
              Our Network
            </span>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-foreground leading-[1.1]">
              Member Directory
            </h1>
            <p className="mt-8 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Connect with inspiring businesswomen across Yorkshire.
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-20">
        {members.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border bg-card/50">
            <p className="text-muted-foreground font-serif text-lg">No active members found in the directory.</p>
          </div>
        ) : (
          <MembersDirectoryClient initialMembers={members} />
        )}
      </section>
    </div>
  );
}
