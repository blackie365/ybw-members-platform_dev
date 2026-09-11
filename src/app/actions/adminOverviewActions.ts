'use server';

import { checkAdmin } from '@/lib/server/auth-utils';
import { getMemberStore } from '@/features/members/server';
import { getGhostMembers } from '@/lib/ghost-admin';
import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';
import { getPgEventStore } from '@/features/events/server/pg-events-store';
import { getPgMessageThreadStore } from '@/features/messaging/server/pg-messages-store';

export async function getAdminOverviewStats() {
  try {
    await checkAdmin();

    const pgPool = getMagazinePgPool();
    if (!pgPool) {
      throw new Error('Postgres pool not initialized');
    }

    // Fetch stats
    const [allMembers, totalEvents, upcomingEvents, totalMessages] = await Promise.all([
      getMemberStore().getAll(),
      getPgEventStore().countAll(),
      getPgEventStore().countUpcoming(),
      getPgMessageThreadStore().countAll(),
    ]);

    const totalMembers = allMembers.filter((m) => m.userInactive !== true).length;

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
    const recentMembers = allMembers
      .slice()
      .sort((a, b) => {
        const da = a.createdAt ? Date.parse(String(a.createdAt)) : 0;
        const db = b.createdAt ? Date.parse(String(b.createdAt)) : 0;
        return db - da;
      })
      .slice(0, 5)
      .map((data: any) => ({
        id: data.clerkId,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
        membershipTier: data.membershipTier || 'free',
      }));

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newMembersThisMonth = allMembers.filter((m: any) => {
      const createdAt = String(m.createdAt || '');
      return createdAt.length > 0 && Date.parse(createdAt) >= startOfMonth.getTime();
    }).length;

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
