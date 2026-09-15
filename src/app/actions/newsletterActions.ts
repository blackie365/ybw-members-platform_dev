'use server';

import { getMemberStore } from "@/features/members/server";
import { getPosts } from "@/lib/ghost";
import { getDailyNewsletterTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { sendWeeklyNewsletter, NEWSLETTER_DEFAULT_SUBJECT } from "@/lib/newsletter-send";
import { checkAdmin } from "@/lib/server/auth-utils";
import { isBeehiivConfigured } from "@/lib/beehiiv";

type RecipientCountBreakdown = {
  newsletter: number;
  registered: number;
  total: number;
  unique: number;
  beehiivEnabled: boolean;
};

export async function getNewsletterRecipientStatsAction(): Promise<{ success: boolean; error?: string; stats?: RecipientCountBreakdown }> {
  try {
    await checkAdmin();
    const breakdown: RecipientCountBreakdown = {
      newsletter: 0,
      registered: 0,
      total: 0,
      unique: 0,
      beehiivEnabled: isBeehiivConfigured(),
    };
    const seen = new Set<string>();
    const memberEmail = (m: any): string =>
      typeof m?.email === 'string' ? m.email.trim().toLowerCase() : '';

    const allMembers = await getMemberStore().getAll();
    const newsletterEmails = allMembers.filter((m: any) => m.isNewsletterRecipient === true);
    const registeredEmails = allMembers.filter((m: any) => m.userInactive !== true);

    newsletterEmails.forEach((m) => {
      const e = memberEmail(m);
      if (!e) return;
      breakdown.newsletter += 1;
      if (!seen.has(e)) seen.add(e);
    });
    registeredEmails.forEach((m) => {
      const e = memberEmail(m);
      if (!e) return;
      breakdown.registered += 1;
      if (!seen.has(e)) seen.add(e);
    });

    breakdown.unique = seen.size;
    breakdown.total = breakdown.newsletter + breakdown.registered;
    return { success: true, stats: breakdown };
  } catch (error: any) {
    console.error("Error in getNewsletterRecipientStatsAction:", error);
    return { success: false, error: error.message };
  }
}

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

export async function previewNewsletterAction(editorNote?: string) {
  try {
    await checkAdmin();
    const posts = await getPosts({ 
      limit: 5, 
      order: 'published_at DESC' 
    });
    const html = await getDailyNewsletterTemplate(posts, undefined, editorNote);
    return { success: true, html };
  } catch (error) {
    console.error("Error in previewNewsletterAction:", error);
    return { success: false, error: "Failed to generate preview" };
  }
}

export async function sendBulkNewsletterAction(editorNote?: string, subject?: string) {
  try {
    await checkAdmin();
    return await sendWeeklyNewsletter({ editorNote, subject });
  } catch (error: any) {
    console.error("Error in sendBulkNewsletterAction:", error);
    return { success: false, count: 0, unique: 0, batches: 0, error: error.message };
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
    const html = await getDailyNewsletterTemplate(posts, undefined, editorNote);
    
    await sendEmail({
      to: email,
      subject: `[TEST] ${subject || NEWSLETTER_DEFAULT_SUBJECT}`,
      html
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error in sendTestNewsletterAction:", error);
    return { success: false, error: error.message };
  }
}
