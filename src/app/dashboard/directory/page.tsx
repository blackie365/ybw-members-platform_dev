import { adminDb } from '@/lib/firebase-admin';
import { BusinessDirectoryClient } from '@/components/BusinessDirectoryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDirectoryMembers() {
  try {
    if (!adminDb) return [];

    const snapshot = await adminDb.collection('newMemberCollection')
      .where('userInactive', '==', false)
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      
      // Sanitization
      const sanitizedData: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && value !== null && '_seconds' in value) {
          sanitizedData[key] = new Date((value as any)._seconds * 1000).toISOString();
        } else {
          sanitizedData[key] = value;
        }
      }

      const avatarUrl = sanitizedData.avatarUrl || "";
      const profileImage = sanitizedData.profileImage || "";
      const image = [avatarUrl, profileImage, sanitizedData.profileImageSource, sanitizedData.image].find(url => 
        url && typeof url === 'string' && (url.includes('storage.googleapis.com') || url.includes('firebasestorage.app') || url.includes('firebasestorage.googleapis.com'))
      ) || avatarUrl || profileImage;

      return {
        id: doc.id,
        name: sanitizedData.displayName || `${sanitizedData.firstName || ''} ${sanitizedData.lastName || ''}`.trim() || sanitizedData.name,
        company: sanitizedData.companyName || sanitizedData.company || 'Private Business',
        role: sanitizedData.jobTitle || sanitizedData.role || 'Member',
        bio: sanitizedData.bio || '',
        image: image,
        isFeatured: sanitizedData.isFeatured === true,
        membershipTier: sanitizedData.membershipTier,
        industrySector: sanitizedData.industrySector,
        location: sanitizedData.location || sanitizedData.city,
        website: sanitizedData.websiteUrl || sanitizedData.website,
        linkedin: sanitizedData.linkedinUrl || sanitizedData.linkedin
      };
    }).filter((member: any) => {
      const isValidTier = ['free', 'paid', 'paid_monthly', 'paid_annual', 'complimentary', 'premium', 'founder'].includes(member.membershipTier);
      const hasName = member.name && member.name.trim().length > 0;
      return isValidTier && hasName;
    });
  } catch (error) {
    console.error('Failed to fetch directory members:', error);
    return [];
  }
}

export default async function DashboardDirectoryPage() {
  const members = await getDirectoryMembers();

  return (
    <div className="space-y-8">
      <div className="bg-stone-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-accent blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl font-serif font-bold italic tracking-tight">Business Directory</h1>
          <p className="text-stone-400 text-sm max-w-xl">
            Discover and connect with Yorkshire&apos;s most influential businesswomen. 
            Browse by sector or explore our curated Power-List of featured members.
          </p>
        </div>
      </div>

      <BusinessDirectoryClient initialMembers={members} />
    </div>
  );
}
