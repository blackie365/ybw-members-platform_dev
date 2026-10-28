import {
  claimDecision,
  getSocialPost,
  recordPublishResult,
  type SocialQueueRow,
} from '@/features/social/server/social-store';
import { publishArticle, publishEnabled, type PublishOutcome } from '@/features/social/server/publisher';

/**
 * Apply an approve/skip decision to a queued post.
 *
 * Shared by the email approval link (/api/social/approve) and the admin Social
 * screen, so both paths are guaranteed to behave identically — in particular
 * the rule that only a `pending` row can be decided, which makes a second click
 * a no-op rather than a second post.
 */

export type DecisionStatus =
  | 'published'
  | 'partly-published'
  | 'publish-disabled'
  | 'skipped'
  | 'already-handled'
  | 'not-found'
  | 'error';

export interface DecisionResult {
  status: DecisionStatus;
  /** Short heading suitable for a page or toast. */
  title: string;
  /** Longer human-readable detail. */
  message: string;
  row?: SocialQueueRow;
  results?: PublishOutcome[];
}

export async function decideQueuedPost(
  id: number,
  decision: 'approved' | 'skipped',
): Promise<DecisionResult> {
  const existing = await getSocialPost(id);
  if (!existing) {
    return { status: 'not-found', title: 'Not found', message: `Queue entry #${id} does not exist.` };
  }

  const claimed = await claimDecision(id, decision);
  if (!claimed) {
    return {
      status: 'already-handled',
      title: 'Already handled',
      message: `Queue entry #${id} was already marked "${existing.status}". Nothing further was done.`,
      row: existing,
    };
  }

  const label = claimed.title || claimed.slug || `#${id}`;

  if (decision === 'skipped') {
    return {
      status: 'skipped',
      title: 'Skipped',
      message: `“${label}” will not be posted.`,
      row: claimed,
    };
  }

  if (!publishEnabled()) {
    const message =
      'Approved, but SOCIAL_PUBLISH_ENABLED is not set on this deploy — nothing was published.';
    await recordPublishResult(id, { ok: false, error: message });
    return { status: 'publish-disabled', title: 'Publishing is switched off', message, row: claimed };
  }

  if (!claimed.slug) {
    const message = 'Queue row has no article slug.';
    await recordPublishResult(id, { ok: false, error: message });
    return { status: 'error', title: 'Cannot publish', message, row: claimed };
  }

  try {
    const results = await publishArticle({
      slug: claimed.slug,
      captionFb: claimed.caption_fb || '',
      captionIg: claimed.caption_ig || '',
      targets: claimed.targets || [],
    });

    const failures = results.filter((r) => !r.ok);
    const allOk = results.length > 0 && failures.length === 0;

    await recordPublishResult(id, {
      ok: allOk,
      result: results,
      error: allOk ? undefined : failures.map((f) => `${f.target}: ${f.error}`).join('; '),
    });

    if (allOk) {
      return {
        status: 'published',
        title: 'Posted',
        message: `“${label}” was posted to ${results.map((r) => r.target).join(', ')}.`,
        row: claimed,
        results,
      };
    }

    return {
      status: 'partly-published',
      title: failures.length === results.length ? 'Nothing was posted' : 'Partly posted',
      message: failures.map((f) => `${f.target}: ${f.error}`).join(' · ') || 'No targets configured.',
      row: claimed,
      results,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordPublishResult(id, { ok: false, error: message });
    return { status: 'error', title: 'Publish failed', message, row: claimed };
  }
}
