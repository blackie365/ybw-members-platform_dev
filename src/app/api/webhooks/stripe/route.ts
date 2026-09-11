import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sendEmail } from '@/lib/email';
import { getEventTicketConfirmationEmailTemplate } from '@/lib/email-templates';
import { upgradeGhostMemberByEmail } from '@/lib/ghost-admin';
import { sendPremiumWelcomeOnce } from '@/lib/member-notifications';
import { getMemberStore } from '@/features/members/server';
import type { MemberProfile } from '@/features/members/server/member-store';
import { config } from '@/lib/config';
import { getStripeWebhookEventStore } from '@/features/shared-ops/server/shared-ops-pg-store';
import {
  getPgEventAttendeeStore,
  getPgEventTicketStore,
} from '@/features/events/server/pg-events-store';

// Need to access raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

async function getAdminRecipients(): Promise<string[]> {
  const fallback = [config.adminEmail];
  try {
    const all = await getMemberStore().getAll();
    const emails = new Set<string>();
    for (const p of all) {
      const role = p.role;
      const isAdmin = (p as any).isAdmin === true || (p as any).isAdmin === 'true';
      if (role === 'admin' || role === 'super_admin' || isAdmin) {
        const e = typeof p.email === 'string' ? p.email : '';
        if (e && e.includes('@')) emails.add(e);
      }
    }
    return emails.size > 0 ? Array.from(emails) : fallback;
  } catch (err) {
    console.error('Failed to fetch admin recipients:', err);
    return fallback;
  }
}

/**
 * Stale-processing reclaim and outcome retention windows (Phase 6c).
 *
 * Previously declared as route-level constants; they live in the store class
 * now (shared-ops-pg-store.ts _internals), because the same parameters need
 * to travel with the PG claim method so its UPDATE...RETURNING stale window
 * matches what the dual-write Firestore fallback uses. Retained here as
 * documentation so the intent is still visible next to the handler:
 *   - PROCESSING_STALE_MS = 15  s (Stripe retries ~30 s after a 5xx)
 *   - OUTCOME_TTL_MS      = 7 d (outcome records kept for audit)
 */

async function findMemberClerkIdBySubscriptionId(subscriptionId: string): Promise<string | null> {
  if (!subscriptionId) return null;
  const store = getMemberStore();
  const bySub = await store.queryOne({ field: 'subscriptionId', value: subscriptionId });
  if (bySub) return bySub.clerkId;
  const byLegacy = await store.queryOne({ field: 'stripeSubscriptionId', value: subscriptionId });
  if (byLegacy) return byLegacy.clerkId;
  return null;
}

async function findMemberClerkIdForSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const store = getMemberStore();

  const userId = typeof sub?.metadata?.userId === 'string' ? sub.metadata.userId : undefined;
  if (userId) {
    const member = await store.getMemberByClerkId(userId);
    if (member) return member.clerkId;
  }

  const subscriptionId = typeof sub?.id === 'string' ? sub.id : '';
  const bySub = await findMemberClerkIdBySubscriptionId(subscriptionId);
  if (bySub) return bySub;

  const customerId = typeof sub?.customer === 'string' ? sub.customer : (sub.customer as any)?.id;
  if (typeof customerId === 'string' && customerId) {
    const byCustomer = await store.queryOne({ field: 'stripeCustomerId', value: customerId });
    if (byCustomer) return byCustomer.clerkId;
  }

  return null;
}

async function demoteMemberToFree(clerkId: string, reason: string) {
  const nowIso = new Date().toISOString();
  const store = getMemberStore();
  const member = await store.getMemberByClerkId(clerkId);
  const data = (member as Record<string, unknown>) || {};
  const alreadyCanceled = data?.subscriptionStatus === 'canceled' || data?.membershipTier === 'free';

  await store.patch(clerkId, {
    membershipTier: 'free',
    subscriptionStatus: 'canceled',
    status: 'active',
    isActive: true,
    userInactive: false,
    updatedAt: nowIso,
  });
  await store.removeFields(clerkId, ['subscriptionId', 'stripeSubscriptionId']);

  const email = typeof data?.email === 'string' ? data.email : '';
  if (email && !alreadyCanceled) {
    const adminRecipients = await getAdminRecipients();
    sendEmail({
      to: adminRecipients,
      subject: `Membership Cancelled: ${email}`,
      html: `
        <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Membership Cancelled</h2>
          <p>A member's subscription has ended and they have been moved to the free tier.</p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Reason:</strong> ${reason}</li>
            <li><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</li>
          </ul>
        </div>
      `,
    }).catch((err) => console.error('Failed to send membership-cancel notification:', err));
  }
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe keys missing' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16' as any,
  });

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    const store = getStripeWebhookEventStore();
    const claimResult = await store.claimProcessing({
      id: event.id,
      type: event.type,
      livemode: (event as any).livemode === true,
    });

    if (claimResult.outcome === 'duplicate') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Handle successful checkout
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const meta = session.metadata || {} as any;
      const { postId, postSlug, plan, cycle } = meta;
      const userId = typeof meta.userId === 'string' ? meta.userId : undefined;
      const guestEmail = typeof meta.guestEmail === 'string' ? meta.guestEmail : undefined;
      const guestName = typeof meta.guestName === 'string' ? meta.guestName : undefined;
      
      // If this was a subscription checkout, update the user immediately.
      // We check if it's a subscription mode checkout OR if they passed 'premium' plan metadata.
      if ((session.mode === 'subscription' || plan === 'premium') && userId) {
        const nowIso = new Date().toISOString();
        const emailFromStripe = session.customer_details?.email || session.customer_email || '';
        const emailLower = typeof emailFromStripe === 'string' ? emailFromStripe.toLowerCase() : '';

        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id;
        const stripeSubscriptionId =
          typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id;

        let billingInterval: 'month' | 'year' = cycle === 'annually' ? 'year' : 'month';
        if (cycle !== 'annually' && cycle !== 'monthly') billingInterval = 'month';

        if (typeof stripeSubscriptionId === 'string') {
          try {
            const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            const interval = sub.items.data[0]?.plan?.interval;
            billingInterval = interval === 'year' ? 'year' : 'month';
          } catch (err) {
            console.warn('Failed to retrieve subscription interval (non-fatal):', err);
          }
        }

        const membershipTier = billingInterval === 'year' ? 'paid_annual' : 'paid_monthly';

        const membershipUpdate: Record<string, any> = {
          status: 'active',
          isActive: true,
          membershipTier,
          billingInterval,
          stripeCustomerId,
          subscriptionId: stripeSubscriptionId,
          lastPaymentDate: nowIso,
          userInactive: false,
          updatedAt: nowIso,
        };

        const existingMember = await getMemberStore().getMemberByClerkId(userId);

        if (!existingMember) {
          membershipUpdate.createdAt = nowIso;
          membershipUpdate.role = 'member';
          membershipUpdate.isAdmin = false;
          membershipUpdate.isFeatured = false;
          if (emailFromStripe) {
            membershipUpdate.email = emailFromStripe;
            membershipUpdate.emailLower = emailLower;
          }
        }

        if (existingMember) {
          await getMemberStore().patch(userId, membershipUpdate);
        } else {
          await getMemberStore().upsert({ clerkId: userId, profile: membershipUpdate });
        }
        console.log(`Successfully activated ${membershipTier} subscription`);

        const userData = (existingMember as any) || {};
        const userEmail = emailFromStripe || userData.email;
        const firstName = userData.firstName || 'there';

        if (userEmail) {
          await sendPremiumWelcomeOnce(userId, userEmail, firstName);
        }

        if (userEmail && !(userData as any).ghostPaidSyncedAt && !(userData as any).ghostPaidSyncAttemptedAt) {
          getMemberStore().patch(userId, { ghostPaidSyncAttemptedAt: nowIso }).catch(() => {});
          upgradeGhostMemberByEmail(userEmail, membershipTier)
            .then((res) => {
              if (res) return getMemberStore().patch(userId, { ghostPaidSyncedAt: nowIso, ghostSyncedAt: nowIso });
            })
            .catch(() => {});
        }

        const adminRecipients = await getAdminRecipients();
        sendEmail({
          to: adminRecipients,
          subject: `Membership Upgrade: ${userEmail || userId}`,
          html: `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">Membership Upgrade</h2>
              <p>A member has upgraded successfully.</p>
              <ul>
                <li><strong>Email:</strong> ${userEmail || 'N/A'}</li>
                <li><strong>User ID:</strong> ${userId}</li>
                <li><strong>Tier:</strong> ${membershipTier}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</li>
              </ul>
            </div>
          `,
        }).catch(err => console.error('Failed to send admin upgrade notification:', err));
      }
      
      // Record ticket purchase in Firestore
      if (postId && (userId || guestEmail)) {
        const ticketEmail: string =
          (typeof session.customer_details?.email === 'string' && session.customer_details.email) ||
          (typeof session.customer_email === 'string' && session.customer_email) ||
          guestEmail ||
          '';
        const ticketQuantity = parseInt(meta?.quantity || '1', 10);
        const guestInfo = typeof meta?.guestInfo === 'string' ? meta.guestInfo : '';
        const stripeSessionId = session.id;
        const amountPaid = session.amount_total;
        const currency = session.currency;
        const purchasedAt = new Date().toISOString();
        const paymentStatus = session.payment_status;

        await getPgEventTicketStore().create({
          eventSlug: postSlug,
          stripeSessionId,
          userId: userId || undefined,
          email: ticketEmail,
          amountPaid: typeof amountPaid === 'number' && amountPaid >= 0 ? amountPaid / 100 : 0,
          currency: currency ?? undefined,
          purchasedAt,
          paymentStatus: paymentStatus ?? undefined,
          ticketQuantity,
          data: {
            postId,
            ...(userId ? { userId } : { guestEmail: ticketEmail.toLowerCase().trim() }),
            userEmail: ticketEmail,
            stripeSessionId,
            amountPaid,
            currency,
            purchasedAt,
            paymentStatus,
            guestInfo,
            ticketQuantity,
          },
        });

        // Automatically RSVP (member or guest) to the event
        if (postSlug) {
          try {
            let rsvpName = 'Guest';
            let rsvpImage = '';
            let rsvpCompany = '';
            let attendeeKey: string = '';

            if (userId) {
              attendeeKey = userId;
              const rsvpMember = await getMemberStore().getMemberByClerkId(userId);
              const profileData = (rsvpMember || {}) as MemberProfile;
              if (profileData.firstName) {
                rsvpName = `${profileData.firstName} ${profileData.lastName || ''}`.trim() || rsvpName;
              }
              rsvpImage = String((profileData as any).profileImage || '');
              rsvpCompany = String((profileData as any).companyName || (profileData as any)['Company'] || '');
            } else {
              rsvpName = guestName || ticketEmail.split('@')[0] || rsvpName;
              attendeeKey = `guest:${encodeURIComponent(ticketEmail.toLowerCase().trim())}`;
            }

            const emailNorm = ticketEmail.toLowerCase().trim();
            const attendeeData: Record<string, unknown> = {
              ...(userId ? { uid: userId } : { email: emailNorm }),
              name: rsvpName,
              image: rsvpImage,
              company: rsvpCompany,
              timestamp: purchasedAt,
              hasTicket: true,
              quantity: ticketQuantity,
              guestInfo,
            };

            await getPgEventAttendeeStore().upsert(postSlug, attendeeKey, attendeeData, {
              userId: userId || undefined,
              email: emailNorm,
              hasTicket: true,
            });

            console.log(`Successfully added attendee to RSVP list for ${postSlug}`);

            // Send Event Ticket Confirmation Email to the purchaser
            const firstName =
              (userId && guestName) ||
              rsvpName.split(' ')[0] ||
              ticketEmail.split('@')[0] ||
              'there';

            if (ticketEmail) {
              sendEmail({
                to: ticketEmail,
                subject: `Your Ticket Confirmation`,
                html: await getEventTicketConfirmationEmailTemplate(firstName, process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk')
              }).catch(err => console.error('Failed to send event confirmation email:', err));
            }

          } catch (rsvpErr) {
            console.error('Error automatically RSVPing user after ticket purchase:', rsvpErr);
          }
        }
        
        console.log(`Successfully recorded ticket purchase for event ${postId}`);
      }
    }
    
    // Handle subscription (membership) successful payment
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any;
      
      if (invoice.subscription) {
        const customerEmail = invoice.customer_email;
        if (customerEmail) {
          const customerEmailLower = String(customerEmail).trim().toLowerCase();
          const store = getMemberStore();
          const member = await store.getMemberByEmail(customerEmailLower);
          const userData = (member as Record<string, unknown>) || {};

          if (member) {
            // Determine tier based on subscription interval if possible
            let tier = (userData.membershipTier as string) || 'paid_monthly';
            let interval = (userData.billingInterval as string) || 'month';

            try {
              const sub = await stripe.subscriptions.retrieve(invoice.subscription);
              interval = sub.items.data[0].plan.interval; // 'month' or 'year'
              tier = interval === 'year' ? 'paid_annual' : 'paid_monthly';
            } catch (e) {
              console.error('Error retrieving subscription for tier update:', e);
            }

            const nowIso = new Date().toISOString();

            await store.patch(member.clerkId, {
              status: 'active',
              isActive: true,
              membershipTier: tier,
              billingInterval: interval,
              stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
              subscriptionId: invoice.subscription,
              lastPaymentDate: nowIso,
              userInactive: false,
              emailLower: customerEmailLower,
            });
            console.log(`Updated member tier to ${tier}`);

            await sendPremiumWelcomeOnce(member.clerkId, customerEmail, (userData.firstName as string) || 'there');

            const adminRecipients = await getAdminRecipients();
            sendEmail({
              to: adminRecipients,
              subject: `Payment Succeeded: ${customerEmail}`,
              html: `
                <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #4f46e5;">Subscription Payment Succeeded</h2>
                  <p>A subscription payment has succeeded.</p>
                  <ul>
                    <li><strong>Email:</strong> ${customerEmail}</li>
                    <li><strong>Tier:</strong> ${tier}</li>
                    <li><strong>Interval:</strong> ${interval}</li>
                    <li><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</li>
                  </ul>
                </div>
              `,
            }).catch(err => console.error('Failed to send admin payment notification:', err));
          } else {
            console.warn(`Invoice payment succeeded but no member matched ${customerEmail}; skipping tier update.`);
          }
        }
      }
    }

    // Handle subscription lifecycle events (cancellation, failed payments, updates)
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const memberClerkId = await findMemberClerkIdForSubscription(sub);
      if (memberClerkId) {
        await demoteMemberToFree(memberClerkId, 'customer.subscription.deleted');
        console.log('Demoted member to free after subscription deletion');
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const memberClerkId = await findMemberClerkIdForSubscription(sub);
      if (memberClerkId) {
        const nowIso = new Date().toISOString();
        const status = sub.status;
        if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) {
          await demoteMemberToFree(memberClerkId, `customer.subscription.updated (${status})`);
        } else {
          const interval = sub.items?.data?.[0]?.plan?.interval;
          const tier = interval === 'year' ? 'paid_annual' : 'paid_monthly';
          const isActive = status === 'active' || status === 'trialing';
          await getMemberStore().patch(memberClerkId, {
            subscriptionStatus: status,
            status: 'active',
            isActive,
            ...(isActive && (interval === 'month' || interval === 'year')
              ? { membershipTier: tier, billingInterval: interval }
              : {}),
            updatedAt: nowIso,
          });
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any;
      const subscriptionId = typeof invoice?.subscription === 'string' ? invoice.subscription : '';
      const memberClerkId = subscriptionId ? await findMemberClerkIdBySubscriptionId(subscriptionId) : null;
      if (memberClerkId) {
        await getMemberStore().patch(memberClerkId, {
          subscriptionStatus: 'past_due',
          status: 'active',
          isActive: true,
          lastPaymentFailedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const member = await getMemberStore().getMemberByClerkId(memberClerkId);
        const email = member?.email || '';
        const adminRecipients = await getAdminRecipients();
        sendEmail({
          to: adminRecipients,
          subject: `Payment Failed: ${email}`,
          html: `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">Subscription Payment Failed</h2>
              <p>A subscription payment failed. Stripe will retry; if it remains unpaid the member will be moved to the free tier.</p>
              <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</li>
              </ul>
            </div>
          `,
        }).catch((err) => console.error('Failed to send payment-failed admin notification:', err));
      }
    }

    await getStripeWebhookEventStore().markProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    const errorMessage = error?.message || String(error) || 'Unknown error';
    const errorStack = error?.stack ? String(error.stack).slice(0, 4000) : undefined;
    try {
      const store = getStripeWebhookEventStore();
      const existing = await store.get(event.id);
      const baseRetry = typeof existing?.retryCount === 'number' ? existing.retryCount : 0;
      const totalAttempts = baseRetry + 1;
      const failedPermanent = totalAttempts >= 5;
      await store.markFailed(event.id, {
        errorMessage,
        errorStack,
        permanent: failedPermanent,
        totalAttempts,
      });
      if (failedPermanent) {
        const adminRecipients = await getAdminRecipients().catch(() => [config.adminEmail]);
        sendEmail({
          to: adminRecipients,
          subject: `URGENT: Stripe Webhook Failed After ${totalAttempts} Tries (${event.id})`,
          html: `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 700px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Stripe Webhook Permanently Failed</h2>
              <p>Event <code>${event.id}</code> (type: <code>${event.type}</code>) failed ${totalAttempts} times and will NOT be retried automatically.</p>
              <p><strong>Error:</strong></p>
              <pre style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;white-space:pre-wrap;overflow:auto;">${errorMessage}</pre>
              ${errorStack ? `<p><strong>Stack:</strong></p><pre style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;white-space:pre-wrap;overflow:auto;font-size:12px;">${errorStack}</pre>` : ''}
              <p style="color:#6b7280;font-size:12px;">Check the <code>stripe_webhook_events</code> Postgres table (or <code>stripe_webhook_events/${event.id}</code> Firestore doc during Phase 6c transition) for retry history.</p>
            </div>
          `,
        }).catch((err) => console.error('Failed to send webhook-failure admin alert:', err));
      }
    } catch (writeErr) {
      console.error('Failed to record webhook failure in Postgres/Firestore:', writeErr);
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
