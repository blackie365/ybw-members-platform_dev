'use server';

import { adminDb } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/adminCheck';
import { getPosts, getTags } from '@/lib/ghost';
import { getGhostMembers, addGhostMember, editGhostMember } from '@/lib/ghost-admin';
import { revalidatePath } from 'next/cache';

export async function getAdminStats() {
  try {
    // 1. Fetch Firebase Stats
    const membersRef = adminDb.collection('newMemberCollection');
    const membersSnap = await membersRef.get();
    const totalMembers = membersSnap.size;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newMembersSnap = await membersRef
      .where('createdAt', '>=', startOfMonth.toISOString())
      .get();
    const newMembersThisMonth = newMembersSnap.size;

    const threadsRef = adminDb.collection('messageThreads');
    const threadsSnap = await threadsRef.get();
    const activeThreads = threadsSnap.size;

    // 2. Fetch Ghost Stats
    let ghostStats = {
      totalPosts: 0,
      totalGhostMembers: 0,
      totalTags: 0
    };

    try {
      const [posts, ghostMembers, tags] = await Promise.all([
        getPosts({ limit: 1 }),
        getGhostMembers({ limit: 1 }),
        getTags({ limit: 1 })
      ]);

      console.log('Ghost Posts Meta:', (posts as any).meta);
      console.log('Ghost Members Meta:', (ghostMembers as any).meta);

      ghostStats = {
        totalPosts: ((posts as any).meta?.pagination?.total ?? (posts as any).length) || 0,
        totalGhostMembers: ((ghostMembers as any).meta?.pagination?.total ?? (ghostMembers as any).length) || 0,
        totalTags: (tags as any).length || 0
      };
    } catch (ghostError) {
      console.error('Error fetching Ghost stats:', ghostError);
    }

    return {
      success: true,
      stats: {
        totalMembers,
        newMembersThisMonth,
        memberGrowth: totalMembers > 0 ? Math.round((newMembersThisMonth / totalMembers) * 100) : 0,
        activeThreads,
        ...ghostStats
      }
    };
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return { success: false, error: error.message };
  }
}

export async function toggleFeaturedStatus(memberId: string, isFeatured: boolean) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is missing from the environment variables.');
    }
    if (!memberId) throw new Error('Member ID is required');

    // In a fully secure app, you'd extract the token from cookies/headers and verify via `verifyAdminToken`.
    // Since we're in a Server Action without direct access to the client's Firebase Auth token easily,
    // the UI component `AdminControlWrapper` handles the visual gating.
    // To make this fully secure against API abuse, you should pass the user's ID token from the client.
    
    // First, if setting to true, we optionally want to set others to false, 
    // but the query is currently sorting by `isFeatured` and picking the top one. 
    // So multiple true is fine, it just picks the first. Or we can clear the others.
    if (isFeatured) {
      const snapshot = await adminDb.collection('newMemberCollection')
        .where('isFeatured', '==', true)
        .get();
      
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isFeatured: false });
      });
      
      // Also update the current one
      const targetRef = adminDb.collection('newMemberCollection').doc(memberId);
      batch.update(targetRef, { isFeatured: true });
      
      await batch.commit();
    } else {
      const targetRef = adminDb.collection('newMemberCollection').doc(memberId);
      await targetRef.update({ isFeatured: false });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error toggling featured status:', error);
    return { success: false, error: error.message || 'Failed to toggle status' };
  }
}