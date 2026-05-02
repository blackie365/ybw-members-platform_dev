import { MembersDirectoryClient } from '@/components/MembersDirectoryClient';
import { adminDb } from '@/lib/firebase-admin';

async function getMembers() {
  try {
    const snapshot = await adminDb.collection('newMemberCollection').get();
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Map common fields in case they differ slightly
        name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name,
        company: data.companyName || data.company,
        role: data.jobTitle || data.role,
        bio: data.bio,
        location: data.location || data.city,
        image: data.profileImage || data.image,
        linkedin: data.linkedinUrl || data.linkedin,
        website: data.websiteUrl || data.website
      };
    });
    return members;
  } catch (error) {
    console.error('Failed to fetch members from newMemberCollection:', error);
    return [];
  }
}

export default async function MembersPage() {
  const members = await getMembers();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <MembersDirectoryClient initialMembers={members} />
    </div>
  );
}
