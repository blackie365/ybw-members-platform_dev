import { ENDPOINTS } from '@/lib/firebase-functions';
import { MembersDirectoryClient } from '@/components/MembersDirectoryClient';

async function getMembers() {
  const res = await fetch(ENDPOINTS.getMembers);
  if (!res.ok) {
    throw new Error('Failed to fetch members');
  }
  const data = await res.json();
  const members = data.members || [];
  return members;
}

export default async function MembersPage() {
  const members = await getMembers();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <MembersDirectoryClient initialMembers={members} />
    </div>
  );
}
