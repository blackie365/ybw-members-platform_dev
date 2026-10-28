'use server';

import { revalidatePath } from 'next/cache';
import { checkAdmin } from '@/lib/server/auth-utils';
import { recentQueueRows, type SocialQueueRow } from '@/features/social/server/social-store';
import { runSocialQueue, type SocialQueueResult } from '@/features/social/server/queue';
import { decideQueuedPost, type DecisionResult } from '@/features/social/server/decision';
import { publishEnabled } from '@/features/social/server/publisher';

/**
 * Server actions behind the admin Social screen (/admin/social).
 *
 * Same guard as every other admin surface — the Clerk admin check, not the
 * cron token. The cron token is only for the scheduled job.
 */

export interface SocialOverview {
  rows: SocialQueueRow[];
  /** SOCIAL_PUBLISH_ENABLED — the deploy-level master switch. */
  publishEnabled: boolean;
  /** Whether the daily timer's CRON_SECRET is present on this deploy. */
  cronConfigured: boolean;
}

export async function getSocialOverviewAction(): Promise<{
  success: boolean;
  error?: string;
  overview?: SocialOverview;
}> {
  try {
    await checkAdmin();
    const rows = await recentQueueRows(20);
    return {
      success: true,
      overview: {
        rows,
        publishEnabled: publishEnabled(),
        cronConfigured: Boolean(process.env.CRON_SECRET || process.env.SOCIAL_CRON_SECRET),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load queue' };
  }
}

/** Queue the newest unposted article now — the same work the 08:00 timer does. */
export async function queueNextSocialPostAction(): Promise<{
  success: boolean;
  error?: string;
  result?: SocialQueueResult;
}> {
  try {
    await checkAdmin();
    const result = await runSocialQueue();
    revalidatePath('/admin/social');
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Queueing failed' };
  }
}

/** Post or skip a queued article. Identical logic to the email approval link. */
export async function decideSocialPostAction(
  id: number,
  decision: 'approved' | 'skipped',
): Promise<{ success: boolean; error?: string; result?: DecisionResult }> {
  try {
    await checkAdmin();
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: 'Invalid queue id' };
    }
    const result = await decideQueuedPost(id, decision);
    revalidatePath('/admin/social');
    return {
      success: result.status !== 'error' && result.status !== 'not-found',
      result,
      error: result.status === 'error' || result.status === 'not-found' ? result.message : undefined,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Action failed' };
  }
}
