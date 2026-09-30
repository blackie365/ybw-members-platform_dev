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

/**
 * Atomically claim the current ISO week for a newsletter send.
 * Returns one of:
 *   - "claimed"       — this caller won the week and must do the send
 *   - "already-sent"  — another send (cron/timer/admin) already owns this week
 *   - "no-pg"         — Postgres unavailable; caller should send unguarded
 *
 * The claim is made in the same statement as the dedup check
 * (INSERT ... ON CONFLICT DO NOTHING + rowCount), so two overlapping
 * triggers — e.g. the VPS systemd timer and the GitHub Actions cron firing in
 * the same minute — can never both pass the check and double-send.
 */
async function claimNewsletterSendWeek(
  weekKey: string,
): Promise<"claimed" | "already-sent" | "no-pg"> {
  const pool = getMagazinePgPool();
  if (!pool) return "no-pg";
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO newsletter_send_log (week_key)
       VALUES ($1)
       ON CONFLICT (week_key) DO NOTHING`,
      [weekKey],
    );
    return rowCount === 1 ? "claimed" : "already-sent";
  } catch (err) {
    console.warn("[newsletter-send] failed to claim week:", err);
    return "no-pg";
  }
}

/** Update a claimed week with the actual send outcome. */
async function updateNewsletterSend(
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
      `UPDATE newsletter_send_log
       SET count = $2, unique_count = $3, batches = $4, mock = $5, deduped = FALSE
       WHERE week_key = $1`,
      [weekKey, count, uniqueCount, batches, mock],
    );
  } catch (err) {
    console.warn("[newsletter-send] failed to update send log:", err);
  }
}

/** Release a claimed week when the send failed, so it can be retried. */
async function releaseNewsletterSend(weekKey: string): Promise<void> {
  const pool = getMagazinePgPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM newsletter_send_log WHERE week_key = $1", [weekKey]);
  } catch (err) {
    console.warn("[newsletter-send] failed to release week:", err);
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
  // Claim the week first: only the caller that wins the INSERT gets to send.
  // Anything that fires later (GitHub cron, VPS timer, admin button) sees an
  // existing row and returns without broadcasting — exactly one send per week.
  const weekKey = isoWeekKey();
  const tableReady = await ensureSendLogTable();
  const weekClaim = tableReady ? await claimNewsletterSendWeek(weekKey) : "no-pg";
  if (weekClaim === "already-sent") {
    console.log(`[newsletter-send] skip — already sent this week (${weekKey})`);
    return { success: true, count: 0, unique: 0, batches: 0, deduped: true };
  }

  const posts = await getPosts({
    limit: 5,
    order: "published_at DESC",
  });

  const emails = await collectNewsletterRecipients();
  if (emails.length === 0) {
    if (weekClaim === "claimed") await releaseNewsletterSend(weekKey);
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

  // --- record the send only if emails were actually delivered, so a failed
  // send (all batches errored) is not swallowed by the weekly dedup and can
  // be retried ---
  if (successCount === 0) {
    if (weekClaim === "claimed") await releaseNewsletterSend(weekKey);
    return {
      success: false,
      count: 0,
      unique: emails.length,
      batches: Math.ceil(emails.length / NEWSLETTER_BATCH_SIZE),
      error: "No newsletter recipients could be reached (all batches failed)",
    };
  }

  if (weekClaim === "claimed") {
    await updateNewsletterSend(
      weekKey,
      successCount,
      emails.length,
      Math.ceil(emails.length / NEWSLETTER_BATCH_SIZE),
      !!mock,
    );
  } else if (tableReady) {
    const totalBatches = Math.ceil(emails.length / NEWSLETTER_BATCH_SIZE);
    const pool = getMagazinePgPool();
    if (pool) {
      await pool
        .query(
          `INSERT INTO newsletter_send_log (week_key, count, unique_count, batches, mock)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (week_key) DO NOTHING`,
          [weekKey, successCount, emails.length, totalBatches, !!mock],
        )
        .catch((err: unknown) =>
          console.warn("[newsletter-send] failed to log send:", err),
        );
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