import { addGhostMember } from '@/lib/ghost-admin';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getNewsletterWelcomeEmailTemplate, getNewsletterSignupAlertTemplate } from '@/lib/email-templates';
import { addBeehiivSubscriber, isBeehiivConfigured } from '@/lib/beehiiv';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { config } from '@/lib/config';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;

/** Matches email.ts — strips "Display Name <addr>" to the bare address. */
const bareEmail = (raw: string | undefined): string => {
  if (!raw) return '';
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
};

/**
 * Splits a flat recipient list into { to, bcc } for an email that will be
 * sent AS `senderDisplay`. Any entry whose bare email matches the sender's
 * bare email is MOVED from `to` → `bcc`.
 *
 * Why this beats the earlier `+<tag>` sub-address trick: some Google Workspace
 * tenancies, hosted MX filters, or alias-only inboxes silently reject
 * or quarantine plus-addressed copies even though the base inbox is valid.
 * By putting the sender mailbox into BCC instead of TO, the sending mailbox NEVER
 * appears in the RFC-5322 `To:`/`Cc:` headers at all — Resend only emits
 * BCC entries as envelope-only RCPT TO. The Resend self-send drop
 * rule inspects DATA headers, not envelope, so editor@ receives its blind copy
 * without any MX deliverability edge-case risk and no alias/bounce risk.
 *
 * If every recipient IS the sender (degenerate case), one entry stays in
 * `to` to satisfy Resend's minimum one-primary-recipient constraint.
 */
const splitSelfToBcc = (
  senderDisplay: string,
  recipients: string[],
): { to: string[]; bcc: string[]; selfMovedToBcc: string[] } => {
  const sender = bareEmail(senderDisplay);
  const selfMatches: string[] = [];
  const others: string[] = [];
  for (const r of recipients) {
    if (!r) continue;
    if (bareEmail(r) === sender) selfMatches.push(r);
    else others.push(r);
  }
  if (others.length) {
    return { to: others, bcc: selfMatches, selfMovedToBcc: selfMatches };
  }
  const [first, ...rest] = selfMatches;
  return { to: first ? [first] : [], bcc: rest, selfMovedToBcc: rest };
};

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

    // Step 1: Add to Beehiiv (Primary Newsletter Delivery Engine)
    let beehiivResult: {
      success: boolean;
      alreadyExists: boolean;
      disabled?: boolean;
      error?: string;
      httpStatus?: number;
    } = { success: false, alreadyExists: false };
    {
      const res = await addBeehiivSubscriber({
        email,
        customFields: {
          first_name: firstName,
          last_name: lastName,
          industry,
        },
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
          '❌ [API/Newsletter] Beehiiv sync failed:',
          beehiivResult.error || 'no error message',
          'httpStatus=', beehiivResult.httpStatus,
          'subscriber=', email
        );
      } else if (beehiivResult.disabled) {
        console.warn(
          '⚠️ [API/Newsletter] Beehiiv sync skipped (disabled / not configured). subscriber=',
          email
        );
      }
    }

    // Step 2: Add to Ghost (Non-critical)
    let ghostResult = false;
    try {
      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
      const ghostLabels = ['newsletter-signup'];
      if (isBeehiivConfigured()) ghostLabels.push('beehiiv-sync');
      const ghostRes = await addGhostMember({
        email,
        name: displayName || undefined,
        labels: ghostLabels,
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
        const listLabels = Array.from(new Set(
          ['newsletter-signup', source ? `source:${source}` : 'source:unknown'].filter(Boolean)
        ));

        const memberData: Record<string, unknown> = {
          email,
          emailLower: email,
          firstName,
          lastName,
          displayName,
          updatedAt: nowIso,
          // Newsletter-only subscribers are also valid recipients for Resend
          // bulk sends: userInactive:false ensures they appear alongside
          // registered members in list queries.
          userInactive: false,
          newsletterSubscribed: true,
          isNewsletterRecipient: true,
          newsletterListLabels: listLabels,
        };
        if (industry) memberData.industrySector = industry;
        if (source) memberData.signupSource = source;
        if (querySnapshot.empty) {
          memberData.status = 'active';
          memberData.membershipTier = 'free';
          memberData.createdAt = nowIso;
        } else {
          const existing = querySnapshot.docs[0].data() as Record<string, unknown>;
          // Preserve existing list labels, merge in the new source label.
          const priorLabels = Array.isArray(existing?.newsletterListLabels)
            ? (existing.newsletterListLabels as string[])
            : [];
          memberData.newsletterListLabels = Array.from(new Set([...priorLabels, ...listLabels]));
          memberData.status = (existing?.status as string) || 'active';
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
    let welcomeEmail: { success: boolean; mock?: boolean; error?: string } = { success: false };
    try {
      const html = await getNewsletterWelcomeEmailTemplate(firstName || 'there');
      const res = await sendEmail({
        to: email,
        subject: 'Welcome to Yorkshire Businesswoman',
        html,
      });
      welcomeEmail = { success: true, mock: Boolean(res?.mock) };
      if (welcomeEmail.mock) {
        console.warn('⚠️ [API/Newsletter] Welcome email MOCKED (RESEND_API_KEY missing or dev-mode fallback). No email actually transmitted to:', email);
      }
    } catch (emailError: unknown) {
      const msg = emailError instanceof Error ? emailError.message : String(emailError);
      console.warn('⚠️ [API/Newsletter] Welcome email failed:', msg);
      welcomeEmail = { success: false, error: msg };
    }

    // Step 5: Send Admin Alert Email for NEW sign-ups only (Non-critical)
    let adminAlert: {
      success: boolean;
      sent: boolean;
      mock?: boolean;
      skipped?: 'already_exists' | 'no_recipients';
      error?: string;
      recipients?: string[];
      recipientsTo?: string[];
      recipientsBcc?: string[];
      selfMovedToBcc?: string[];
      deliveredTo?: string[];
      senderFrom?: string;
      /** @deprecated kept for backwards compatibility; BCC-self-copy no longer uses plus-addressing. */
      recipientsRewritten?: string[];
      /** @deprecated kept for backwards compatibility; BCC-self-copy no longer uses plus-addressing. */
      selfTag?: string;
    } = { success: false, sent: false };
    if (beehiivResult.alreadyExists) {
      adminAlert = { success: true, sent: false, skipped: 'already_exists' };
    } else {
      const recipients = Array.from(new Set(
        config.newsletterAlertRecipients.map((r) => r.trim()).filter((r) => r && r.includes('@'))
      ));
      if (recipients.length === 0) {
        console.error('❌ [API/Newsletter] Admin alert SKIPPED: no valid NEWSLETTER_ALERT_RECIPIENTS / CONTACT_RECIPIENTS. subscriber=', email);
        adminAlert = { success: false, sent: false, skipped: 'no_recipients', recipients };
      } else {
        try {
          const alertHtml = await getNewsletterSignupAlertTemplate(
            email,
            firstName || undefined,
            lastName || undefined,
            source || undefined
          );
          // Sender MUST be a Resend-DKIM-verified identity. We keep editor@
          // here (proven delivers via the welcome email) rather than an
          // unverified noreply@ — Resend was silently dropping the entire
          // payload when an unverified sender was used, even though the API
          // returned success.
          //
          // The previous +alerts sub-address trick was blocked at the MX on
          // some Google Workspace tenancies (inbox accepted the first copy
          // but filtered/bounced later plus-addressed emails). The safer
          // workaround is to split the flat recipient list: any recipient
          // that matches the sender bare-email is MOVED from `to` → `bcc`.
          // BCC never appears in the DATA headers sent to the MX (only
          // envelope RCPT TO sees it), so Resend's self-send drop rule
          // (which inspects header recipients) cannot fire for the editor@
          // copy, yet the editor inbox still receives the blind copy via
          // the envelope. No plus-addressing, no DNS, no MX filter risk.
          const senderFrom = config.emailFrom;
          const { to: recipientsTo, bcc: recipientsBcc, selfMovedToBcc } = splitSelfToBcc(senderFrom, recipients);
          const res = await sendEmail({
            to: recipientsTo,
            bcc: recipientsBcc,
            from: senderFrom,
            subject: `🔔 New Newsletter Sign-Up: ${email}`,
            html: alertHtml,
          });
          const isMock = Boolean(res?.mock);
          adminAlert = {
            success: true,
            sent: !isMock,
            mock: isMock,
            recipients,
            recipientsTo,
            recipientsBcc,
            selfMovedToBcc,
            deliveredTo: res?.deliveredTo,
            senderFrom: res?.senderFrom || senderFrom,
          };
          if (isMock) {
            console.warn(
              '⚠️ [API/Newsletter] Admin alert MOCKED — no real email dispatched. subscriber=',
              email,
              'recipients=',
              recipients.join(', '),
              'to=',
              recipientsTo.join(', '),
              'bcc=',
              recipientsBcc.join(', '),
              'selfMovedToBcc=',
              selfMovedToBcc.join(', '),
              'deliveredTo=',
              (res?.deliveredTo || []).join(', '),
              'from=',
              res?.senderFrom || senderFrom
            );
          } else {
            console.log(
              `✅ [API/Newsletter] Admin alert dispatched for new sign-up: ${email} from=${res?.senderFrom || senderFrom} deliveredTo=${(res?.deliveredTo || []).join(', ')} (requested: ${recipients.join(', ')}; to: ${recipientsTo.join(', ')}; bcc: ${recipientsBcc.join(', ')}; selfMovedToBcc: ${selfMovedToBcc.join(', ')})`
            );
          }
        } catch (alertError: unknown) {
          const msg = alertError instanceof Error ? alertError.message : String(alertError);
          console.error('❌ [API/Newsletter] Admin alert email FAILED:', msg, 'subscriber=', email, 'recipients=', recipients.join(', '));
          adminAlert = { success: false, sent: false, error: msg, recipients };
        }
      }
    }

    const responseData = {
      success: true as const,
      message: beehiivResult.alreadyExists
        ? "You're already subscribed to our newsletter! We've updated your preferences."
        : 'Successfully subscribed',
      details: {
        beehiiv: {
          success: beehiivResult.success,
          alreadyExists: beehiivResult.alreadyExists,
          disabled: Boolean(beehiivResult.disabled),
          error: beehiivResult.error,
          httpStatus: beehiivResult.httpStatus,
        },
        ghost: ghostResult,
        welcomeEmail: {
          sent: welcomeEmail.success && !welcomeEmail.mock,
          mock: Boolean(welcomeEmail.mock),
          error: welcomeEmail.error,
        },
        alert: {
          newSignup: !beehiivResult.alreadyExists,
          skipped: adminAlert.skipped,
          sent: adminAlert.sent,
          mock: Boolean(adminAlert.mock),
          error: adminAlert.error,
          recipientCount: adminAlert.recipients?.length ?? 0,
          recipients: adminAlert.recipients,
          recipientsTo: adminAlert.recipientsTo,
          recipientsBcc: adminAlert.recipientsBcc,
          selfMovedToBcc: adminAlert.selfMovedToBcc,
          recipientsRewritten: adminAlert.recipientsRewritten,
          deliveredTo: adminAlert.deliveredTo,
          senderFrom: adminAlert.senderFrom,
          selfTag: adminAlert.selfTag,
        },
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
