import { getMemberStore } from '@/features/members/server';

export async function getTotalMembers() {
  try {
    return await getMemberStore().countActive();
  } catch (err) {
    console.error('Error fetching total members count:', err);
    return 0;
  }
}
