import crypto from 'crypto';

/**
 * Signed tokens for the one-click approve/skip links in the daily social email.
 *
 * The links are unauthenticated (they land in an inbox, not a logged-in
 * session), so the token is the only thing standing between a stranger and
 * publishing to the brand's Facebook page. An HMAC over `${id}:${decision}`
 * means a token cannot be replayed for a different queue row or flipped from
 * skip to approve.
 */

function secret(): string | null {
  return process.env.SOCIAL_APPROVAL_SECRET || process.env.CRON_SECRET || null;
}

export type SocialDecision = 'approved' | 'skipped';

/**
 * Everything a signed one-click link may do. `unskip` puts a skipped row back
 * in the queue, so it is signed separately — a token for one action can never
 * be replayed as another.
 */
export type SocialLinkAction = SocialDecision | 'unskip';

function payload(id: number, action: SocialLinkAction): string {
  return `${id}:${action}`;
}

export function signApprovalToken(id: number, action: SocialLinkAction): string {
  const key = secret();
  if (!key) {
    throw new Error('SOCIAL_APPROVAL_SECRET (or CRON_SECRET) is not configured');
  }
  return crypto.createHmac('sha256', key).update(payload(id, action)).digest('base64url');
}

export function verifyApprovalToken(
  id: number,
  action: SocialLinkAction,
  token: string,
): boolean {
  if (!token) return false;
  let expected: string;
  try {
    expected = signApprovalToken(id, action);
  } catch {
    // No secret configured — refuse rather than silently allow a publish.
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Build the approve/skip URLs embedded in the approval email. */
export function approvalLinks(id: number, baseUrl: string): { approve: string; skip: string } {
  const base = baseUrl.replace(/\/$/, '');
  const q = (decision: SocialDecision) =>
    `${base}/api/social/approve?id=${id}&decision=${decision}&token=${encodeURIComponent(
      signApprovalToken(id, decision),
    )}`;
  return { approve: q('approved'), skip: q('skipped') };
}
