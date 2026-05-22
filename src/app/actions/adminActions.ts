'use server';

import { getGhostMembers } from "@/lib/ghost-admin";
import { adminDb } from "@/lib/firebase-admin";
import { getPosts } from "@/lib/ghost";
import { getDailyNewsletterTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";

export async function getGhostStatsAction() {
  try {
    const members = await getGhostMembers({ limit: 'all' });
    
    if (!members || !Array.isArray(members)) {
      return { total: 0, newsletter: 0 };
    }

    // Total Ghost members (includes newsletter signups + full members)
    const total = members.length;
    
    // Specifically count newsletter subscribers (those with 'newsletter-signup' label or just anyone in Ghost since Ghost is our newsletter source)
    const newsletter = total; 

    return {
      total,
      newsletter
    };
  } catch (error) {
    console.error("Error in getGhostStatsAction:", error);
    return { total: 0, newsletter: 0 };
  }
}

export async function previewNewsletterAction(editorNote?: string) {
  try {
    const posts = await getPosts({ limit: 5, order: 'published_at DESC' });
    const html = await getDailyNewsletterTemplate(posts, "Subscriber", editorNote);
    return { success: true, html };
  } catch (error) {
    console.error("Error in previewNewsletterAction:", error);
    return { success: false, error: "Failed to generate preview" };
  }
}

export async function sendBulkNewsletterAction(editorNote?: string, subject?: string) {
  try {
    if (!adminDb) throw new Error("Database not initialized");

    // 1. Get latest posts
    const posts = await getPosts({ limit: 5, order: 'published_at DESC' });
    
    // 2. Get all active members
    const snapshot = await adminDb.collection('newMemberCollection')
      .where('userInactive', '==', false)
      .get();
    
    const members = snapshot.docs.map(doc => doc.data());
    const emails = members.map(m => m.email).filter(Boolean);

    if (emails.length === 0) {
      return { success: false, error: "No active members found" };
    }

    // 3. Send in batches (Resend supports up to 50 recipients per call for batching)
    const batchSize = 40;
    let successCount = 0;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const html = await getDailyNewsletterTemplate(posts, "Member", editorNote);
      
      await sendEmail({
        to: "newsletter@yorkshirebusinesswoman.co.uk", // From address essentially
        bcc: batch,
        subject: subject || "Your Daily Briefing | Yorkshire Businesswoman",
        html
      });
      
      successCount += batch.length;
    }

    return { success: true, count: successCount };
  } catch (error: any) {
    console.error("Error in sendBulkNewsletterAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getAnalyticsData() {
  try {
    if (!adminDb) throw new Error("Database not initialized");

    // 1. Fetch Firestore Members
    const snapshot = await adminDb.collection('newMemberCollection').get();
    const totalMembers = snapshot.docs.filter(d => !d.data().userInactive).length;
    const totalInactive = snapshot.size - totalMembers;

    // 2. Fetch Ghost Members
    const ghostMembers = await getGhostMembers({ limit: 'all' });
    const totalGhostMembers = Array.isArray(ghostMembers) ? ghostMembers.length : 0;

    // 3. Fetch Events
    const eventsSnapshot = await adminDb.collection('events').get();
    const totalEvents = eventsSnapshot.size;

    // 4. Group Members by Tier
    const tierCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      const tier = doc.data().membershipTier || 'free';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    // 5. Group by Industry
    const industryCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      const industry = doc.data().industrySector || 'Other';
      industryCounts[industry] = (industryCounts[industry] || 0) + 1;
    });

    // 6. Group by Location
    const locationCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      let loc = doc.data().location || doc.data().city || 'Unknown';
      
      // Dynamic Normalization for Charting
      loc = loc.toString().split(',')[0].split('/')[0].trim(); // Take just the primary city name
      if (loc.toLowerCase() === 'wakefield') loc = 'Wakefield';
      if (loc.toLowerCase() === 'leeds') loc = 'Leeds';
      if (loc.toLowerCase() === 'huddersfield') loc = 'Huddersfield';
      if (loc.toLowerCase() === 'harrogate') loc = 'Harrogate';
      if (loc.toLowerCase() === 'manchester') loc = 'Manchester';
      if (loc.toLowerCase() === 'york') loc = 'York';
      
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    // 7. Mock Growth Data (for now, can be improved with real timestamps)
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
