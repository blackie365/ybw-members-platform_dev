import { adminDb } from '@/lib/firebase-admin';

export async function getTotalMembers() {
  try {
    if (!adminDb) return 0;
    const snapshot = await adminDb?.collection('newMemberCollection')?.where('userInactive', '==', false)?.count()?.get();
    return snapshot?.data()?.count || 0;
  } catch (err) {
    console.error('Error fetching total members count:', err);
    return 0;
  }
}
