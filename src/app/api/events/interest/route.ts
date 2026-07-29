import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { addBeehiivSubscriber } from '@/lib/beehiiv';
import { addGhostMember } from '@/lib/ghost-admin';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { config } from '@/lib/config';

interface EventInterestPayload {
  email?: unknown;
  firstName?: unknown;
  source?: unknown;
  eventId?: unknown;
  eventTitle?: unknown;
  eventDateLabel?: unknown;
  eventLocation?: unknown;
  newsletterOptIn?: unknown;
  consent?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stringify(input: unknown, max = 200): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, max);
}

function buildAdminNotificationHtml(params: {
  email: string;
  firstName: string;
  eventTitle: string;
  eventId: string;
  newsletterOptIn: boolean;
  consent: string;
}) {
  const { email, firstName, eventTitle, eventId, newsletterOptIn, consent } = params;
  return `
    <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; color: #0c0a09;">
      <h2 style="margin: 0 0 12px; font-size: 22px;">New event interest</h2>
      <p style="margin: 0 0 16px;">Someone submitted their email for the event below via the translucent pop-up.</p>
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr>
            <td style="padding: 8px 0; width: 140px; color: #78716c;">Event</td>
            <td style="padding: 8px 0;"><strong>${eventTitle}</strong> <span style="color:#78716c;">(${eventId})</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78716c;">Name</td>
            <td style="padding: 8px 0;">${firstName || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78716c;">Email</td>
            <td style="padding: 8px 0;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78716c;">Newsletter opt-in</td>
            <td style="padding: 8px 0;">${newsletterOptIn ? 'Yes' : 'No'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78716c;">Consent</td>
            <td style="padding: 8px 0;">${consent || 'event_updates'}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin: 18px 0 0; font-size: 12px; color: #78716c;">
        Sent automatically by yorkshirebusinesswoman.co.uk.
      </p>
    </div>
  `;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`events:interest:${ip}`, 5, 60_000);

  if (!rateLimit.allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  let body: EventInterestPayload = {};
  try {
    body = (await request.json()) as EventInterestPayload;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request' },
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const emailRaw = stringify(body.email);
  const email = emailRaw.toLowerCase();
  const firstName = stringify(body.firstName, 60);
  const source = stringify(body.source, 80) || 'event-interest';
  const eventId = stringify(body.eventId, 200);
  const eventTitle = stringify(body.eventTitle, 200);
  const eventDateLabel = stringify(body.eventDateLabel, 120);
  const eventLocation = stringify(body.eventLocation, 200);
  const newsletterOptIn =
    typeof body.newsletterOptIn === 'boolean' ? body.newsletterOptIn : false;
  const consent = stringify(body.consent, 80) || 'event_updates';

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: 'A valid email is required.' },
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (!eventId) {
    return NextResponse.json(
      { error: 'Event id is required.' },
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 1) Core event interest record (deduped by email + event)
  const interestRecordId = Buffer.from(`${eventId}::${email}`).toString('base64url');
  let interestCreated = false;
  let beehiivResult: {
    success: boolean;
    alreadyExists: boolean;
    disabled?: boolean;
    error?: string;
    httpStatus?: number;
  } = { success: false, alreadyExists: false };
  let ghostResult = false;
  let adminEmailResult: { success?: boolean; mock?: boolean; id?: string } | null = null;

  try {
    if (adminDb) {
      const interestRef = adminDb
        .collection('eventInterests')
        .doc(interestRecordId);
      const existing = await interestRef.get();
      const createdAt = new Date().toISOString();
      const baseData = {
        email,
        emailLower: email,
        firstName,
        source,
        eventId,
        eventTitle,
        eventDateLabel,
        eventLocation,
        newsletterOptIn,
        consent,
        updatedAt: createdAt,
      };
      if (!existing.exists) {
        await interestRef.set({ ...baseData, createdAt }, { merge: true });
        interestCreated = true;
      } else {
        await interestRef.update(baseData);
      }

      // Mirror to newMemberCollection ONLY if an actual member record already
      // exists for this email. We deliberately do NOT promote a pure event
      // interest or newsletter checkbox into a brand-new "free tier member" —
      // that conflates "someone who wants event updates / the newsletter"
      // with "someone who created a YBW account". Real members come through
      // /sign-up, Ghost auth webhooks (api/revalidate/ghost), or Stripe.
      // We still append the eventId + newsletter flags onto the existing
      // member profile so the admin record stays consistent when someone is
      // already an account-holding member.
      const membersRef = adminDb.collection('newMemberCollection');
      const existingMember = await membersRef
        .where('emailLower', '==', email)
        .limit(1)
        .get();

      if (!existingMember.empty) {
        const memberPayload = {
          firstName: firstName || (existingMember.docs[0].data() as any)?.firstName || '',
          isNewsletterRecipient:
            newsletterOptIn ||
            (existingMember.docs[0].data() as any)?.isNewsletterRecipient === true,
          newsletterSubscribed:
            newsletterOptIn ||
            (existingMember.docs[0].data() as any)?.newsletterSubscribed === true,
          eventInterests: Array.from(
            new Set([
              ...((existingMember.docs[0].data() as any)?.eventInterests || []),
              eventId,
            ]),
          ),
          updatedAt: createdAt,
        };
        await existingMember.docs[0].ref.update(memberPayload);
      }
    }
  } catch (error: any) {
    console.warn('[API/Events/Interest] Firestore sync skipped:', error?.message || error);
  }

  // 2) Beehiiv sync (newsletter opt-in or always with event custom fields)
  {
    const res = await addBeehiivSubscriber({
      email,
      customFields: {
        first_name: firstName || '',
        source,
        ybw_event_id: eventId,
        ybw_event_title: eventTitle,
        consent,
        newsletter_opt_in: newsletterOptIn ? 'yes' : 'no',
      },
      utmMedium: 'event_popover',
      utmCampaign: eventId || 'event-popover',
      // Only send the general newsletter welcome if they explicitly opted in.
      sendWelcomeEmail: newsletterOptIn,
    });
    beehiivResult = {
      success: Boolean(res?.success),
      alreadyExists: Boolean(res?.alreadyExists),
      disabled: Boolean(res?.disabled),
      error: res?.error,
      httpStatus: res?.httpStatus,
    };
    if (!beehiivResult.success && !beehiivResult.disabled) {
      console.error(
        '❌ [API/Events/Interest] Beehiiv sync failed:',
        beehiivResult.error,
        'httpStatus=', beehiivResult.httpStatus,
        'event=', eventId,
        'subscriber=', email
      );
    } else if (beehiivResult.disabled) {
      console.warn(
        '⚠️ [API/Events/Interest] Beehiiv sync skipped (disabled/not configured). event=',
        eventId,
        'subscriber=',
        email
      );
    }
  }

  // 3) Ghost member sync (non-critical)
  try {
    const ghostRes = await addGhostMember({
      email,
      name: firstName || email.split('@')[0],
      labels: ['event-interest', eventId || 'event-popover'].filter(Boolean),
    });
    ghostResult = !!ghostRes;
  } catch (error: any) {
    console.warn('[API/Events/Interest] Ghost sync skipped:', error?.message || error);
  }

  // 4) Admin notification email (non-critical)
  // Fallback chain: explicit ADMIN_NOTIFICATION_EMAIL override (Vercel secret)
  // → config.adminEmail (ADMIN_EMAIL env var → editor@… default). This matches
  // the pattern used by /api/emails/welcome and ensures we always have a valid
  // recipient in production (previously we read ADMIN_NOTIFICATION_EMAIL only
  // and fell back to null, so alerts were silently skipped when the usual
  // ADMIN_EMAIL secret was the only one configured on Vercel).
  try {
    const adminEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || config.adminEmail;
    if (adminEmail && (interestCreated || newsletterOptIn)) {
      adminEmailResult = await sendEmail({
        to: adminEmail,
        subject: `${eventTitle ? `[${eventTitle}] ` : ''}New event interest — ${email}`,
        html: buildAdminNotificationHtml({
          email,
          firstName,
          eventTitle: eventTitle || eventId,
          eventId,
          newsletterOptIn,
          consent,
        }),
      });
    }
  } catch (error: any) {
    console.warn('[API/Events/Interest] Admin email skipped:', error?.message || error);
  }

  const successMessage = newsletterOptIn
    ? "You're on the list — we'll be in touch with event updates and the weekly newsletter."
    : "You're on the list — we'll be in touch with event updates.";

  return NextResponse.json(
    {
      success: true,
      message: beehiivResult.alreadyExists
        ? `You're already on our list. We've updated your preferences for this event.`
        : successMessage,
      details: {
        interestCreated,
        beehiiv: beehiivResult,
        ghost: ghostResult,
        adminNotified: adminEmailResult ? adminEmailResult.success || adminEmailResult.mock : false,
      },
    },
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
