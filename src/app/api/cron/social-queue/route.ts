import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runSocialQueue } from '@/features/social/server/queue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Daily social queue job — triggered at 09:00 by deploy/ybw-social-queue.timer.
 *
 * Picks the newest never-queued Ghost article, renders the cards, stores a
 * pending row and emails them for approval. Publishing happens only from
 * /api/social/approve, and only when SOCIAL_PUBLISH_ENABLED=true.
 *
 * Optional, mainly for testing:
 *   ?slug=<ghost-slug>   queue that specific article instead of the newest
 *   ?dryRun=1            render and report without storing or emailing
 */
function secretsEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function isAuthorized(req: Request): 'ok' | 'not-configured' | 'denied' {
  const envSecret = process.env.CRON_SECRET || process.env.SOCIAL_CRON_SECRET;
  if (!envSecret) return 'not-configured';
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return 'denied';
  return secretsEqual(token, envSecret) ? 'ok' : 'denied';
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const auth = isAuthorized(req);
  if (auth === 'not-configured') {
    return NextResponse.json(
      {
        success: false,
        error:
          'CRON_SECRET is not configured on this deploy. Add CRON_SECRET to /srv/ybw-frontend/.env.local and restart ybw-frontend.service.',
      },
      { status: 503 },
    );
  }
  if (auth === 'denied') {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — missing or invalid Authorization: Bearer token.' },
      { status: 401 },
    );
  }

  const url = new URL(req.url);

  try {
    const result = await runSocialQueue({
      slug: url.searchParams.get('slug') || undefined,
      dryRun: url.searchParams.get('dryRun') === '1',
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/social-queue] failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
