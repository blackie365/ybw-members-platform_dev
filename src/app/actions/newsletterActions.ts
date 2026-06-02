'use server';

import { getGhostMembers } from "@/lib/ghost-admin";
import { adminDb } from "@/lib/firebase-admin";
import { getPosts } from "@/lib/ghost";
import { getDailyNewsletterTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { checkAdmin } from "@/lib/server/auth-utils";

export async function getBeehiivPostStatsAction() {
  try {
    await checkAdmin();
    const publicationId = process.env.BEEHIIV_PUBLICATION_ID;
    const apiKey = process.env.BEEHIIV_API_KEY;

    if (!publicationId || !apiKey) {
      throw new Error("Beehiiv configuration missing");
    }

    const response = await fetch(`https://api.beehiiv.com/v2/publications/${publicationId}/posts?limit=5&status=published`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) throw new Error("Failed to fetch Beehiiv posts");
    const data = await response.json();
    const posts = data.data || [];

    const stats = await Promise.all(posts.map(async (post: any) => {
      const statsRes = await fetch(`https://api.beehiiv.com/v2/publications/${publicationId}/posts/${post.id}/stats`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      const statsData = await statsRes.json();
      return {
        id: post.id,
        title: post.title,
        sent_at: post.published_at,
        opens: statsData.data?.email?.opens || 0,
        clicks: statsData.data?.email?.clicks || 0,
        open_rate: statsData.data?.email?.open_rate || 0,
        click_rate: statsData.data?.email?.click_rate || 0
      };
    }));

    return { success: true, stats };
  } catch (error: any) {
    console.error("Error in getBeehiivPostStatsAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getGhostStatsAction() {
  try {
    await checkAdmin();
    const members = await getGhostMembers({ limit: 'all' });
    
    if (!members || !Array.isArray(members)) {
      return { total: 0, newsletter: 0 };
    }

    const total = members.length;
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
    await checkAdmin();
    const posts = await getPosts({ 
      limit: 5, 
      order: 'published_at DESC' 
    });
    const html = await getDailyNewsletterTemplate(posts, "Subscriber", editorNote);
    return { success: true, html };
  } catch (error) {
    console.error("Error in previewNewsletterAction:", error);
    return { success: false, error: "Failed to generate preview" };
  }
}

export async function sendBulkNewsletterAction(editorNote?: string, subject?: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const posts = await getPosts({ 
      limit: 5, 
      order: 'published_at DESC' 
    });
    
    const snapshot = await adminDb.collection('newMemberCollection')
      .where('userInactive', '==', false)
      .get();
    
    const members = snapshot.docs.map(doc => doc.data());
    const emails = members.map(m => m.email).filter(Boolean);

    if (emails.length === 0) {
      return { success: false, error: "No active members found" };
    }

    const batchSize = 40;
    let successCount = 0;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const html = await getDailyNewsletterTemplate(posts, "Member", editorNote);
      
      await sendEmail({
        to: "newsletter@yorkshirebusinesswoman.co.uk",
        bcc: batch,
        subject: subject || "Your Weekly Briefing | Yorkshire Businesswoman",
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

export async function sendTestNewsletterAction(email: string, editorNote?: string, subject?: string) {
  try {
    await checkAdmin();
    if (!email || !email.includes('@')) {
      throw new Error("Invalid email address");
    }

    const posts = await getPosts({ 
      limit: 5, 
      order: 'published_at DESC' 
    });
    const html = await getDailyNewsletterTemplate(posts, "Test Subscriber", editorNote);
    
    await sendEmail({
      to: email,
      subject: `[TEST] ${subject || "Your Weekly Briefing | Yorkshire Businesswoman"}`,
      html
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error in sendTestNewsletterAction:", error);
    return { success: false, error: error.message };
  }
}
