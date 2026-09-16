import { getMemberStore } from "@/features/members/server";
import { getPosts } from "@/lib/ghost";
import { getDailyNewsletterTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { getMagazinePgPool } from "@/features/magazine/server/read-store/pg-client";

export const NEWSLETTER_BATCH_SIZE = 40;
export const NEWSLETTER_DEFAULT_SUBJECT = "Your Weekly Briefing | Yorkshire Businesswoman";

export interface WeeklyNewsletterSendResult {
  success: boolean;
  count: number;
  unique: number;
  batches: number;
  mock?: boolean;
  /** Present when this send was skipped because a send already completed this ISO week. */
  deduped?: boolean;
  error?: string;
}

declare global {
  var __newsletterSendLogReady: boolean | undefined;
}

/**
 * Return the ISO week key for a given date (e.g. "2026-W38").
 * Two sends with the same key are considered duplicates for the weekly
 * newsletter — only one should actually go out.
 */
export function isoWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Lazy-init the newsletter_send_log table (created once, lives forever).
 * Safe to call repeatedly — the IF NOT EXISTS is a no-op after first run.
 */
async function ensureSendLogTable(): Promise<boolean> {
  const pool = getMagazinePgPool();
  if (!pool) return false;
  if (globalThis.__newsletterSendLogReady) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_send_log (
        id         SERIAL PRIMARY KEY,
        week_key   TEXT NOT NULL UNIQUE,
        sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        count      INTEGER NOT NULL DEFAULT 0,
        unique_count INTEGER NOT NULL DEFAULT 0,
        batches    INTEGER NOT NULL DEFAULT 0,
        mock       BOOLEAN NOT NULL DEFAULT FALSE,
        deduped    BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    globalThis.__newsletterSendLogReady = true;
    return true;
  } catch (err) {
    console.warn("[newsletter-send] failed to init send_log table:", err);
    return false;
  }
}

/** Read whether a send already completed this ISO week. */
export async function wasNewsletterSentThisWeek(
  weekKey: string = isoWeekKey()
): Promise<boolean> {
  const pool = getMagazinePgPool();
  if (!pool) return false;
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM newsletter_send_log WHERE week_key = $1 LIMIT 1",
      [weekKey],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Record a completed send for the given ISO week. */
async function logNewsletterSend(
  weekKey: string,
  count: number,
  uniqueCount: number,
  batches: number,
  mock: boolean,
): Promise<void> {
  const pool = getMagazinePgPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO newsletter_send_log (week_key, count, unique_count, batches, mock)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (week_key) DO NOTHING`,
      [weekKey, count, uniqueCount, batches, mock],
    );
  } catch (err) {
    console.warn("[newsletter-send] failed to log send:", err);
  }
}

/**
 * Build the newsletter recipient list from the member store only:
 *   (a) explicit newsletter recipients (homepage popup / inline sign-ups)
 *   (b) registered, active members
 * All deduplicated by email. Ghost CMS members are intentionally excluded —
 * the weekly send is scoped to platform members + popup sign-ups.
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

  return Array.from(seen);
}

/**
 * Send the weekly newsletter to everyone on the list.
 * Used by both the manual admin "send" action and the Wednesday cron route so
 * the automated send and the dashboard button behave identically.
 *
 * Deduplication: the first call in any given ISO week actually sends and
 * records the send in `newsletter_send_log`. Subsequent calls within the same
 * week (whether from the cron route or the admin button) return early without
 * re-sending.  This prevents the well-known GitHub Actions `schedule` delay
 * at :00 from causing a duplicate broadcast.
 */
export async function sendWeeklyNewsletter(options?: {
  editorNote?: string;
  subject?: string;
}): Promise<WeeklyNewsletterSendResult> {
  const editorNote = options?.editorNote;
  const subject = options?.subject || NEWSLETTER_DEFAULT_SUBJECT;

  // --- deduplication (Postgres-backed, per ISO week) ---
  const weekKey = isoWeekKey();
  const tableReady = await ensureSendLogTable();
  if (tableReady) {
    const alreadySent = await wasNewsletterSentThisWeek(weekKey);
    if (alreadySent) {
      console.log(`[newsletter-send] skip — already sent this week (${weekKey})`);
      return { success: true, count: 0, unique: 0, batches: 0, deduped: true };
    }
  }

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

  // --- record the send (table may not exist on older deploys) ---
  if (tableReady) {
    const totalBatches = Math.ceil(emails.length / NEWSLETTER_BATCH_SIZE);
    await logNewsletterSend(weekKey, successCount, emails.length, totalBatches, !!mock);
  }

  return {
    success: true,
    count: successCount,
    unique: emails.length,
    batches: Math.ceil(emails.length / NEWSLETTER_BATCH_SIZE),
    mock: mock || undefined,
  };
}