'use server';

import { adminDb } from "@/lib/firebase-admin";
import { getGhostMembers } from "@/lib/ghost-admin";

export async function toggleFeaturedStatus(memberId: string, status: boolean) {
  try {
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

    return { success: true };
  } catch (error: any) {
    console.error("Error in toggleFeaturedStatus:", error);
    return { success: false, error: error.message };
  }
}

export async function getAnalyticsData() {
  try {
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('newMemberCollection').get();
    const totalMembers = snapshot.docs.filter(d => !d.data().userInactive).length;
    const totalInactive = snapshot.size - totalMembers;

    const ghostMembers = await getGhostMembers({ limit: 'all' });
    const totalGhostMembers = Array.isArray(ghostMembers) ? ghostMembers.length : 0;

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

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const membersByMonth = months.map(month => ({
      name: month,
      platform: Math.floor(totalMembers / 6),
      ghost: Math.floor(totalGhostMembers / 6),
      total: Math.floor((totalMembers + totalGhostMembers) / 6)
    }));

    return {
      success: true,
      data: {
        totalMembers,
        totalGhostMembers,
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
          { name: 'Subscribed', value: totalGhostMembers },
          { name: 'Unsubscribed', value: 0 }
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
