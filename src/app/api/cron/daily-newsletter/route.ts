import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { sendWeeklyNewsletter } from '@/lib/newsletter-send';

export const dynamic = 'force-dynamic';

/**
 * Weekly newsletter send — triggered every Wednesday at 11:00 GMT by the
 * GitHub Actions schedule (.github/workflows/weekly-newsletter.yml), which
 * calls this route with `Authorization: Bearer $CRON_SECRET`.
 *
 * The exact same send is available manually from the admin News Manager:
 *   /admin/newsletter
 *   → "Send to N Recipients" dispatches via Resend, batching 40 per send.
 *   → Recipient list = Firestore (newsletter sign-ups + registered members)
 *                      ∪ Ghost CMS members, deduplicated by email.
 *
 * This route requires the CRON_SECRET env var on the deploy:
 *   /srv/ybw-frontend/.env.local  →  CRON_SECRET=<random string>
 * and the matching GitHub Actions secret:
 *   repo → Settings → Secrets → Actions → CRON_SECRET=<same string>
 */

function secretsEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(req: Request): 'ok' | 'not-configured' | 'denied' {
  const envSecret = process.env.CRON_SECRET || process.env.NEWSLETTER_CRON_SECRET;
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
    return NextResponse.json({
      success: false,
      error: 'CRON_SECRET is not configured on this deploy. Add CRON_SECRET to /srv/ybw-frontend/.env.local and restart ybw-frontend.service.',
    }, { status: 503 });
  }
  if (auth === 'denied') {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized — missing or invalid Authorization: Bearer token.',
    }, { status: 401 });
  }

  try {
    const result = await sendWeeklyNewsletter({});
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (error: any) {
    console.error('[cron/daily-newsletter] send failed:', error?.message || error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Weekly newsletter send failed',
    }, { status: 500 });
  }
}