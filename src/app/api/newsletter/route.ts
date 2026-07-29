import { addGhostMember } from '@/lib/ghost-admin';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getNewsletterWelcomeEmailTemplate, getNewsletterSignupAlertTemplate } from '@/lib/email-templates';
import { addBeehiivSubscriber } from '@/lib/beehiiv';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { config } from '@/lib/config';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;

const sanitize = (value: unknown, maxLen = 200): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed;
};

interface NewsletterRequestBody {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  industry?: unknown;
  source?: unknown;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`newsletter:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    let body: NewsletterRequestBody;
    try {
      body = (await request.json()) as NewsletterRequestBody;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const firstName = sanitize(body.firstName, 100);
    const lastName = sanitize(body.lastName, 100);
    const industry = sanitize(body.industry, 100);
    const source = sanitize(body.source, 100);

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      console.warn('⚠️ [API/Newsletter] Invalid or missing email');
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const email = rawEmail;

    // Step 1: Add to Beehiiv (Primary)
    let beehiivResult = { success: false, alreadyExists: false };
    try {
      const res = await addBeehiivSubscriber({
        email,
        customFields: {
          first_name: firstName,
          last_name: lastName,
          industry,
        },
      });
      beehiivResult = { success: !!res?.success, alreadyExists: !!res?.alreadyExists };
    } catch (beehiivError: unknown) {
      const msg = beehiivError instanceof Error ? beehiivError.message : String(beehiivError);
      console.error('❌ [API/Newsletter] Beehiiv failed:', msg);
    }

    // Step 2: Add to Ghost (Non-critical)
    let ghostResult = false;
    try {
      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
      const ghostRes = await addGhostMember({
        email,
        name: displayName || undefined,
        labels: ['newsletter-signup', 'beehiiv-sync'],
      });
      ghostResult = !!ghostRes;
    } catch (ghostError: unknown) {
      const msg = ghostError instanceof Error ? ghostError.message : String(ghostError);
      console.warn('⚠️ [API/Newsletter] Ghost sync skipped:', msg);
    }

    // Step 3: Add to Firebase (Non-critical)
    try {
      if (adminDb) {
        const membersRef = adminDb.collection('newMemberCollection');
        const querySnapshot = await membersRef.where('email', '==', email).limit(1).get();

        const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const nowIso = new Date().toISOString();

        const memberData: Record<string, unknown> = {
          email,
          emailLower: email,
          firstName,
          lastName,
          displayName,
          updatedAt: nowIso,
        };
        if (industry) memberData.industrySector = industry;
        if (source) memberData.signupSource = source;
        if (querySnapshot.empty) {
          memberData.status = 'active';
          memberData.newsletterSubscribed = true;
          memberData.isNewsletterRecipient = true;
          memberData.membershipTier = 'free';
          memberData.createdAt = nowIso;
        } else {
          memberData.status = 'active';
          memberData.newsletterSubscribed = true;
          memberData.isNewsletterRecipient = true;
        }

        if (querySnapshot.empty) {
          const newsletterDocId = `newsletter_${Buffer.from(email, 'utf8').toString('base64url')}`;
          await membersRef.doc(newsletterDocId).set(memberData, { merge: true });
        } else {
          await querySnapshot.docs[0].ref.update(memberData);
        }
      }
    } catch (firebaseError: unknown) {
      const msg = firebaseError instanceof Error ? firebaseError.message : String(firebaseError);
      console.warn('⚠️ [API/Newsletter] Firebase sync failed:', msg);
    }

    // Step 4: Send Welcome Email (Non-critical)
    try {
      const html = await getNewsletterWelcomeEmailTemplate(firstName || 'there');
      await sendEmail({
        to: email,
        subject: 'Welcome to Yorkshire Businesswoman',
        html,
      });
    } catch (emailError: unknown) {
      const msg = emailError instanceof Error ? emailError.message : String(emailError);
      console.warn('⚠️ [API/Newsletter] Welcome email failed:', msg);
    }

    // Step 5: Send Admin Alert Email for NEW sign-ups only (Non-critical)
    if (!beehiivResult.alreadyExists) {
      try {
        const alertHtml = await getNewsletterSignupAlertTemplate(
          email,
          firstName || undefined,
          lastName || undefined,
          source || undefined
        );
        await sendEmail({
          to: config.contactRecipients,
          subject: `🔔 New Newsletter Sign-Up: ${email}`,
          html: alertHtml,
        });
        console.log(`✅ [API/Newsletter] Admin alert sent for new sign-up: ${email}`);
      } catch (alertError: unknown) {
        const msg = alertError instanceof Error ? alertError.message : String(alertError);
        console.warn('⚠️ [API/Newsletter] Admin alert email failed:', msg);
      }
    }

    const responseData = {
      success: true as const,
      message: beehiivResult.alreadyExists
        ? "You're already subscribed to our newsletter! We've updated your preferences."
        : 'Successfully subscribed',
      details: {
        beehiiv: beehiivResult.success,
        ghost: ghostResult,
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (fatalError: unknown) {
    const msg = fatalError instanceof Error ? fatalError.message : String(fatalError);
    console.error('❌ [API/Newsletter] FATAL ERROR:', msg);

    return new Response(
      JSON.stringify({
        success: false,
        error: msg || 'An internal error occurred. Please try again later.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
