import { NextResponse } from 'next/server';
import {
  signApprovalToken,
  verifyApprovalToken,
  type SocialLinkAction,
} from '@/features/social/server/approval-token';
import { decideQueuedPost, reopenQueuedPost } from '@/features/social/server/decision';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIONS: SocialLinkAction[] = ['approved', 'skipped', 'unskip'];

/**
 * One-click approve / skip / undo-skip for a queued social post.
 *
 *   GET /api/social/approve?id=<queueRowId>&decision=approved|skipped|unskip&token=<hmac>
 *
 * The link is clicked from an email, so this is deliberately GET and returns a
 * plain HTML page rather than JSON. Safety comes from the HMAC token, not a
 * session — see src/features/social/server/decision.ts for the shared logic and
 * the "only a pending row can be decided" rule that makes a replayed link a
 * no-op. The same actions are also available on the admin Social screen.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = Number(params.get('id'));
  const decision = params.get('decision') as SocialLinkAction | null;
  const token = params.get('token') || '';

  if (!Number.isInteger(id) || id <= 0) {
    return page('Invalid link', 'The queue id in this link is not valid.', 400);
  }
  if (!decision || !ACTIONS.includes(decision)) {
    return page('Invalid link', 'The decision in this link is not valid.', 400);
  }
  if (!verifyApprovalToken(id, decision, token)) {
    return page('Link not valid', 'This approval link has an invalid or expired signature.', 401);
  }

  // Undoing a skip restores the row; it never publishes, so it is handled apart
  // from the approve/skip decisions.
  if (decision === 'unskip') {
    const result = await reopenQueuedPost(id);
    const httpStatus = result.status === 'not-found' ? 404 : 200;
    const postItNow =
      result.status === 'reopened' && result.row
        ? `<p style="margin:28px 0 0;"><a href="${socialHref(result.row.id, 'approved')}" style="display:inline-block; background:#050505; color:#FAF9F6; padding:12px 22px; text-decoration:none; font-family:Helvetica,Arial,sans-serif; font-size:14px;">Approve &amp; post now</a></p>`
        : '';
    return page(result.title, `<p>${escapeHtml(result.message)}</p>${postItNow}`, httpStatus);
  }

  const result = await decideQueuedPost(id, decision);

  const httpStatus =
    result.status === 'not-found'
      ? 404
      : result.status === 'error' || result.status === 'partly-published'
        ? 500
        : 200;

  const list = result.results?.length
    ? `<ul>${result.results
        .map(
          (r) =>
            `<li>${escapeHtml(r.target)} — ${
              r.ok ? `posted (${escapeHtml(r.id || '')})` : `failed: ${escapeHtml(r.error || '')}`
            }</li>`,
        )
        .join('')}</ul>`
    : '';

  const body =
    result.status === 'publish-disabled'
      ? `<p>“${escapeHtml(result.row?.title || '')}” was approved and recorded, but publishing is switched off on this deploy. Set <code>SOCIAL_PUBLISH_ENABLED=true</code> once the Meta publish scopes are granted, then post it again from the Social screen.</p>`
      : `${result.status === 'skipped' ? '' : `<p>“${escapeHtml(result.row?.title || '')}”</p>`}${list}${
          list ? '' : `<p>${escapeHtml(result.message)}</p>`
        }`;

  // A skip is the one decision worth offering an escape hatch for — a mis-click
  // on the link in the email should not be final.
  const undo =
    result.status === 'skipped' && result.row
      ? `<p style="margin:28px 0 0;">Changed your mind? <a href="${socialHref(result.row.id, 'unskip')}" style="color:#a3413a;">Put it back in the queue</a>.</p>`
      : '';

  return page(result.title, body + undo, httpStatus);
}

/** Relative signed link, so it works from whatever host served the page. */
function socialHref(id: number, action: SocialLinkAction): string {
  return `/api/social/approve?id=${id}&decision=${action}&token=${encodeURIComponent(
    signApprovalToken(id, action),
  )}`;
}

function page(heading: string, bodyHtml: string, status: number) {
  const html = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)} · YBW social</title>
  </head>
  <body style="margin:0; background:#FAF9F6; color:#050505; font-family: Georgia, 'Times New Roman', serif;">
    <main style="max-width:640px; margin:0 auto; padding:64px 24px;">
      <p style="font-family:'Courier New',monospace; font-size:12px; letter-spacing:2px; color:#a3413a; text-transform:uppercase; margin:0 0 12px;">Yorkshire Businesswoman</p>
      <h1 style="font-size:30px; line-height:1.2; margin:0 0 16px;">${escapeHtml(heading)}</h1>
      <div style="font-size:16px; line-height:1.6; color:#3f3f46;">${bodyHtml}</div>
      <hr style="border:none; border-top:1px solid #c9956a; margin:32px 0;" />
      <p style="font-family:Helvetica,Arial,sans-serif; font-size:12px; color:#71717A; margin:0;">You can close this tab.</p>
    </main>
  </body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
