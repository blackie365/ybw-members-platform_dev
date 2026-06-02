'use server';

import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';
import { getGhostMembers } from '@/lib/ghost-admin';

export async function getAdminOverviewStats() {
  try {
    await checkAdmin();
    
    if (!adminDb) throw new Error('Database not initialized');

    // Fetch Firestore stats
    const [membersSnap, eventsSnap, messagesSnap] = await Promise.all([
      adminDb.collection('newMemberCollection').where('userInactive', '==', false).get(),
      adminDb.collection('events').get(),
      adminDb.collection('messageThreads').get()
    ]);

    const totalMembers = membersSnap.size;
    const totalEvents = eventsSnap.size;
    const totalMessages = messagesSnap.size;

    let upcomingEvents = 0;
    const now = new Date();
    eventsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.startDate && new Date(data.startDate) >= now) {
        upcomingEvents++;
      }
    });

    // Fetch Ghost stats
    let ghostMembers = 0;
    try {
      const members = await getGhostMembers({ limit: 'all' });
      ghostMembers = Array.isArray(members) ? members.length : 0;
    } catch (e) {
      console.error("Failed to fetch Ghost stats:", e);
    }

    // Fetch Beehiiv stats
    let beehiivMembers = 0;
    try {
      const response = await fetch(`https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}`, {
        headers: {
          'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        beehiivMembers = data.data?.stats?.active_subscribers || 0;
      }
    } catch (e) {
      console.error("Failed to fetch Beehiiv stats:", e);
    }

    // Fetch recent members
    const recentMembersSnap = await adminDb.collection('newMemberCollection')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const recentMembers = recentMembersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
        membershipTier: data.membershipTier || 'free',
      };
    });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newMembersThisMonthSnap = await adminDb.collection('newMemberCollection')
      .where('createdAt', '>=', startOfMonth.toISOString())
      .get();
    const newMembersThisMonth = newMembersThisMonthSnap.size;

    return {
      success: true,
      data: {
        totalMembers,
        newMembersThisMonth,
        memberGrowth: totalMembers > 0 ? Math.round((newMembersThisMonth / totalMembers) * 100) : 0,
        totalEvents,
        upcomingEvents,
        totalMessages,
        ghostMembers,
        beehiivMembers,
        recentMembers,
        lastUpdated: new Date().toISOString()
      }
    };
  } catch (error: any) {
    console.error("Error in getAdminOverviewStats:", error);
    return { success: false, error: error.message };
  }
}
