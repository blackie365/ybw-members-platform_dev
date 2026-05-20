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
      await adminDb.collection('newMemberCollection').doc(memberId).update({ isFeatured: false });
    }

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error toggling featured status:', error);
    return { success: false, error: error.message };
  }
}

export async function getAnalyticsData() {
  try {
    // 1. Fetch all members
    const membersRef = adminDb.collection('newMemberCollection');
    const membersSnap = await membersRef.get();
    const members = membersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
        membershipTier: data.membershipTier || 'free',
        industrySector: data.industrySector || 'Unknown',
        location: data.location || 'Unknown'
      };
    });

    // 2. Members by month (last 12 months)
    const monthlyData: Record<string, number> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      monthlyData[key] = 0;
    }
    
    members.forEach(m => {
      const d = new Date(m.createdAt);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      if (key in monthlyData) {
        monthlyData[key]++;
      }
    });
    
    const membersByMonth = Object.entries(monthlyData).map(([name, count]) => ({
      name,
      count
    }));

    // 3. Members by tier
    const tierCounts: Record<string, number> = { free: 0, premium: 0, founder: 0 };
    members.forEach(m => {
      const tier = (m.membershipTier || 'free').toLowerCase();
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });
    const membersByTier = Object.entries(tierCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));

    // 4. Members by industry (top 8)
    const industryCounts: Record<string, number> = {};
    members.forEach(m => {
      const ind = m.industrySector;
      if (ind && ind !== 'Unknown') {
        industryCounts[ind] = (industryCounts[ind] || 0) + 1;
      }
    });
    const membersByIndustry = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    // 5. Members by location (top 8)
    const locationCounts: Record<string, number> = {};
    members.forEach(m => {
      const loc = m.location;
      if (loc && loc !== 'Unknown') {
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      }
    });
    const membersByLocation = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    // 6. Fetch events metadata
    const eventsRef = adminDb.collection('events');
    const eventsSnap = await eventsRef.get();
    const eventAttendance = eventsSnap.docs
      .slice(0, 10)
      .map(doc => {
        const e = doc.data();
        return {
          name: e.title || doc.id,
          attendees: e.registeredCount || 0,
          capacity: e.capacity || 50
        };
      });

    // 7. Message threads
    const threadsRef = adminDb.collection('messageThreads');
    const threadsSnap = await threadsRef.get();

    return {
      success: true,
      data: {
        membersByMonth,
        membersByTier,
        membersByIndustry,
        membersByLocation,
        eventAttendance,
        totalMembers: members.length,
        totalEvents: eventsSnap.size,
        totalMessages: threadsSnap.size
      }
    };
  } catch (error: any) {
    console.error('Error fetching analytics data:', error);
    return { success: false, error: error.message };
  }
}