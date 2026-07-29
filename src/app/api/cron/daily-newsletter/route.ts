import { NextResponse } from 'next/server';
import { isBeehiivConfigured } from '@/lib/beehiiv';

export const dynamic = 'force-dynamic';

/**
 * Newsletter send is a manual operation today, not a cron.
 *
 * Actual newsletters are sent from the admin News Manager:
 *   /admin/newsletter
 *   → "Send to N Recipients" dispatches via Resend, batching 40 per send.
 *   → Recipient list = Firestore (newsletter sign-ups + registered members)
 *                      ∪ Ghost CMS members, deduplicated by email.
 *
 * If/when Beehiiv env vars (BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID) are set
 * in Vercel, the newsletter popup also syncs subscribers to Beehiiv as a
 * secondary list mirror — but that has never been required to actually send.
 */
export async function GET() {
  const beehiivEnabled = isBeehiivConfigured();
  return NextResponse?.json({
    success: true,
    message: beehiivEnabled
      ? 'Sending is handled by the admin News Manager Resend button. Beehiiv subscriber mirror is ENABLED on this deploy.'
      : 'Sending is handled by the admin News Manager Resend button. Beehiiv subscriber mirror is DISABLED on this deploy (BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID missing).',
    status: 'manual_send',
    beehiivEnabled,
  });
}
