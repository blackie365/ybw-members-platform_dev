'use server';

import { getGhostMembers } from "@/lib/ghost-admin";
import { adminDb } from "@/lib/firebase-admin";
import { getPosts } from "@/lib/ghost";
import { getDailyNewsletterTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { checkAdmin } from "@/lib/server/auth-utils";
import { isBeehiivConfigured } from "@/lib/beehiiv";

type RecipientCountBreakdown = {
  newsletter: number;
  registered: number;
  ghost: number;
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
      ghost: 0,
      total: 0,
      unique: 0,
      beehiivEnabled: isBeehiivConfigured(),
    };
    const seen = new Set<string>();

    if (adminDb) {
      const newsletterSnap = await adminDb
        .collection('newMemberCollection')
        .where('isNewsletterRecipient', '==', true)
        .get();
      const registeredSnap = await adminDb
        .collection('newMemberCollection')
        .where('userInactive', '==', false)
        .get();
      const emailsFromFirestore = (snap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>) => {
        const out: string[] = [];
        snap.forEach((doc) => {
          const d = doc.data() as { email?: unknown };
          if (typeof d.email === 'string') out.push(d.email.trim().toLowerCase());
        });
        return out;
      };
      emailsFromFirestore(newsletterSnap).forEach((e) => {
        breakdown.newsletter += 1;
        if (!seen.has(e)) seen.add(e);
      });
      emailsFromFirestore(registeredSnap).forEach((e) => {
        breakdown.registered += 1;
        if (!seen.has(e)) seen.add(e);
      });
    }

    const ghostMembers = await getGhostMembers({ limit: 'all' }).catch(() => null);
    if (Array.isArray(ghostMembers)) {
      ghostMembers.forEach((m: any) => {
        const e = typeof m?.email === 'string' ? m.email.trim().toLowerCase() : null;
        if (!e) return;
        breakdown.ghost += 1;
        if (!seen.has(e)) seen.add(e);
      });
    }
    breakdown.unique = seen.size;
    breakdown.total = breakdown.newsletter + breakdown.registered + breakdown.ghost;
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

    const posts = await getPosts({ 
      limit: 5, 
      order: 'published_at DESC' 
    });
    
    const seen = new Set<string>();
    const pushUnique = (raw: unknown) => {
      if (typeof raw !== 'string') return;
      const e = raw.trim().toLowerCase();
      if (!e || !e.includes('@')) return;
      seen.add(e);
    };

    if (adminDb) {
      // Union: (a) explicit newsletter recipients (includes popup/inline)
      //        (b) registered active members
      const snaps = await Promise.all([
        adminDb.collection('newMemberCollection')
          .where('isNewsletterRecipient', '==', true)
          .get()
          .catch(() => null),
        adminDb.collection('newMemberCollection')
          .where('userInactive', '==', false)
          .get()
          .catch(() => null),
      ]);
      snaps.forEach((snap) => {
        if (!snap) return;
        snap.forEach((doc) => {
          const d = doc.data() as { email?: unknown };
          pushUnique(d.email);
        });
      });
    }

    // Also merge in Ghost members so the weekly Resend send matches what admins
    // expect when Beehiiv is disabled on Vercel production (env vars missing).
    try {
      const ghostMembers = await getGhostMembers({ limit: 'all' });
      if (Array.isArray(ghostMembers)) {
        ghostMembers.forEach((m: any) => pushUnique(m?.email));
      }
    } catch (err) {
      console.warn('[sendBulkNewsletterAction] Ghost member sync skipped:', err instanceof Error ? err.message : err);
    }

    const emails = Array.from(seen);
    if (emails.length === 0) {
      return { success: false, error: "No newsletter recipients found" };
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

    return { success: true, count: successCount, unique: emails.length };
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
