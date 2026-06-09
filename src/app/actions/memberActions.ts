'use server';

import { adminDb } from "@/lib/firebase-admin";
import { getGhostMembers } from "@/lib/ghost-admin";
import { revalidatePath } from "next/cache";
import { checkAdmin } from "@/lib/server/auth-utils";

export async function getMembersAction() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('newMemberCollection')
      .where('userInactive', '==', false)
      .orderBy('createdAt', 'desc')
      .get();

    const members = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, data: members };
  } catch (error: any) {
    console.error("Error in getMembersAction:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleFeaturedStatus(memberId: string, status: boolean) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const memberRef = adminDb.collection('newMemberCollection').doc(memberId);
    
    if (status) {
      const snapshot = await adminDb.collection('newMemberCollection')
        .where('isFeatured', '==', true)
        .get();
      
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isFeatured: false });
      });
      await batch.commit();
    }

    await memberRef.update({ 
      isFeatured: status,
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/directory');

    return { success: true };
  } catch (error: any) {
    console.error("Error in toggleFeaturedStatus:", error);
    return { success: false, error: error.message };
  }
}

export async function getAnalyticsData() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('newMemberCollection').get();
    const totalMembers = snapshot.docs.filter(d => !d.data().userInactive).length;
    const totalInactive = snapshot.size - totalMembers;

    const ghostMembers = await getGhostMembers({ limit: 'all' });
    const totalGhostMembers = Array.isArray(ghostMembers) ? ghostMembers.length : 0;

    // Fetch Beehiiv Stats if possible
    let beehiivStats = { totalSubscribers: 0, activeSubscribers: 0 };
    try {
      const response = await fetch(`https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}`, {
        headers: {
          'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        beehiivStats.totalSubscribers = data.data?.stats?.total_subscribers || 0;
        beehiivStats.activeSubscribers = data.data?.stats?.active_subscribers || 0;
      }
    } catch (e) {
      console.error("Failed to fetch Beehiiv stats:", e);
    }

    const eventsSnapshot = await adminDb.collection('events').get();
    const totalEvents = eventsSnapshot.size;

    const tierCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      const tier = doc.data().membershipTier || 'free';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    const industryCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      const industry = doc.data().industrySector || 'Other';
      industryCounts[industry] = (industryCounts[industry] || 0) + 1;
    });

    const locationCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      let loc = doc.data().location || doc.data().city || 'Unknown';
      
      loc = loc.toString().split(',')[0].split('/')[0].trim();
      if (loc.toLowerCase() === 'wakefield') loc = 'Wakefield';
      if (loc.toLowerCase() === 'leeds') loc = 'Leeds';
      if (loc.toLowerCase() === 'huddersfield') loc = 'Huddersfield';
      if (loc.toLowerCase() === 'harrogate') loc = 'Harrogate';
      if (loc.toLowerCase() === 'manchester') loc = 'Manchester';
      if (loc.toLowerCase() === 'york') loc = 'York';
      
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    // Calculate actual growth by month
    const now = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        platform: 0,
        ghost: 0,
        total: 0
      };
    });

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userInactive || !data.createdAt) return;
      const createdDate = new Date(data.createdAt);
      
      last6Months.forEach(m => {
        if (createdDate.getFullYear() === m.year && createdDate.getMonth() === m.month) {
          m.platform++;
        }
      });
    });

    // For Ghost members, we'll distribute them for now as we don't have historical API data easily
    // but we can at least show real platform growth
    const membersByMonth = last6Months.map(m => ({
      name: m.name,
      platform: m.platform,
      ghost: Math.floor(totalGhostMembers / 6), // still averaged for Ghost
      total: m.platform + Math.floor(totalGhostMembers / 6)
    }));

    return {
      success: true,
      data: {
        totalMembers,
        totalGhostMembers,
        totalBeehiivMembers: beehiivStats.totalSubscribers,
        activeBeehiivMembers: beehiivStats.activeSubscribers,
        totalEvents,
        totalMessages: 0,
        membersByTier: Object.entries(tierCounts).map(([name, value]) => ({ name, value })),
        membersByIndustry: Object.entries(industryCounts).map(([name, value]) => ({ name, value })).slice(0, 8),
        membersByLocation: Object.entries(locationCounts).map(([name, value]) => ({ name, value })).slice(0, 8),
        platformStatusData: [
          { name: 'Active', value: totalMembers },
          { name: 'Inactive', value: totalInactive }
        ],
        ghostStatusData: [
          { name: 'Ghost', value: totalGhostMembers },
          { name: 'Beehiiv', value: beehiivStats.totalSubscribers }
        ],
        membersByMonth,
        eventAttendance: []
      }
    };
  } catch (error: any) {
    console.error("Error in getAnalyticsData:", error);
    return { success: false, error: error.message };
  }
}
