import { MembersDirectoryClient } from '@/components/MembersDirectoryClient';
import { adminDb } from '@/lib/firebase-admin';

export const revalidate = 60; // Revalidate every 60 seconds

async function getMembers() {
  try {
    const snapshot = await adminDb.collection('newMemberCollection').get();
    const members = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      
      // Sanitize the data to remove non-serializable objects (like Firebase Timestamps)
      const sanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
          return new Date(value._seconds * 1000).toISOString();
        }
        return value;
      }));

      return {
        id: doc.id,
        ...sanitizedData,
        // Map common fields in case they differ slightly
        name: sanitizedData.displayName || `${sanitizedData.firstName || ''} ${sanitizedData.lastName || ''}`.trim() || sanitizedData.name,
        company: sanitizedData.companyName || sanitizedData.company,
        role: sanitizedData.jobTitle || sanitizedData.role,
        bio: sanitizedData.bio,
        location: sanitizedData.location || sanitizedData.city,
        image: sanitizedData.profileImage || sanitizedData.image || sanitizedData.avatarUrl,
        linkedin: sanitizedData.linkedinUrl || sanitizedData.linkedin,
        website: sanitizedData.websiteUrl || sanitizedData.website
      };
    }).filter((member: any) => {
      // Filter out members without an image, or without a bio (or a bio that is too short)
      const hasImage = !!member.image;
      const hasBio = member.bio && member.bio.trim().length > 20; // Ensure bio is at least a few words
      const hasName = member.name && member.name.trim().length > 0;
      
      return hasImage && hasBio && hasName;
    });
    return members;
  } catch (error: any) {
    console.error('Failed to fetch members from newMemberCollection:', error);
    // Return empty array so the build succeeds in environments with limited
    // credentials (e.g. preview deployments). The page renders with no members.
    return [];
  }
}

export default async function MembersPage() {
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-2">Configuration Error</h2>
          <p>The members directory cannot load because the Firebase Admin credentials are missing from this environment.</p>
          <p className="mt-2 text-sm font-mono">Please add FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL to your Vercel Environment Variables.</p>
        </div>
      </div>
    );
  }

  const members = await getMembers();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <MembersDirectoryClient initialMembers={members} />
    </div>
  );
}
