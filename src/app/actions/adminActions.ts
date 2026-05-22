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
