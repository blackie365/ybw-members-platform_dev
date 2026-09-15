import { getMemberStore } from "@/features/members/server";
import { getPosts } from "@/lib/ghost";
import { getDailyNewsletterTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { getGhostMembers } from "@/lib/ghost-admin";

export const NEWSLETTER_BATCH_SIZE = 40;
export const NEWSLETTER_DEFAULT_SUBJECT = "Your Weekly Briefing | Yorkshire Businesswoman";

export interface WeeklyNewsletterSendResult {
  success: boolean;
  count: number;
  unique: number;
  batches: number;
  mock?: boolean;
  error?: string;
}

/**
 * Build the newsletter recipient list: the union of
 *   (a) explicit newsletter recipients (popup/inline sign-ups)
 *   (b) registered active members
 * plus Ghost CMS members, all deduplicated by email.
 */
export async function collectNewsletterRecipients(): Promise<string[]> {
  const seen = new Set<string>();
  const pushUnique = (raw: unknown) => {
    if (typeof raw !== "string") return;
    const e = raw.trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    seen.add(e);
  };

  const allMembers = await getMemberStore().getAll();
  allMembers.forEach((m: any) => {
    if (m.isNewsletterRecipient === true || m.userInactive !== true) {
      pushUnique(m.email);
    }
  });

  // Merge in Ghost members so the weekly send matches what admins expect when
  // Beehiiv is disabled on the VPS deploy (env vars missing there).
  try {
    const ghostMembers = await getGhostMembers({ limit: "all" });
    if (Array.isArray(ghostMembers)) {
      ghostMembers.forEach((m: any) => pushUnique(m?.email));
    }
  } catch (err) {
    console.warn("[collectNewsletterRecipients] Ghost member sync skipped:", err instanceof Error ? err.message : err);
  }

  return Array.from(seen);
}

/**
 * Send the weekly newsletter to everyone on the list.
 * Used by both the manual admin "send" action and the Wednesday cron route so
 * the automated send and the dashboard button behave identically.
 */
export async function sendWeeklyNewsletter(options?: {
  editorNote?: string;
  subject?: string;
}): Promise<WeeklyNewsletterSendResult> {
  const editorNote = options?.editorNote;
  const subject = options?.subject || NEWSLETTER_DEFAULT_SUBJECT;

  const posts = await getPosts({
    limit: 5,
    order: "published_at DESC",
  });

  const emails = await collectNewsletterRecipients();
  if (emails.length === 0) {
    return { success: false, count: 0, unique: 0, batches: 0, error: "No newsletter recipients found" };
  }

  let successCount = 0;
  let mock = false;

  for (let i = 0; i < emails.length; i += NEWSLETTER_BATCH_SIZE) {
    const batch = emails.slice(i, i + NEWSLETTER_BATCH_SIZE);
    const html = await getDailyNewsletterTemplate(posts, undefined, editorNote);

    const result = await sendEmail({
      to: "newsletter@yorkshirebusinesswoman.co.uk",
      bcc: batch,
      subject,
      html,
    });

    if (result.success) {
      successCount += batch.length;
      if (result.mock) mock = true;
    }
  }

  return {
    success: true,
    count: successCount,
    unique: emails.length,
    batches: Math.ceil(emails.length / NEWSLETTER_BATCH_SIZE),
    mock: mock || undefined,
  };
}