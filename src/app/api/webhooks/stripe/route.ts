import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { sendEmail } from '@/lib/email';
import { getEventTicketConfirmationEmailTemplate } from '@/lib/email-templates';
import { addGhostMember, upgradeGhostMemberByEmail } from '@/lib/ghost-admin';
import { sendPremiumWelcomeOnce } from '@/lib/member-notifications';
import { config } from '@/lib/config';

// Need to access raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

async function getAdminRecipients(): Promise<string[]> {
  const fallback = [config.adminEmail];
  try {
    const db = adminDb;
    if (!db) return fallback;

    const byRoleSnap = await db
      .collection('newMemberCollection')
      .where('role', 'in', ['admin', 'super_admin'])
      .get();

    const byFlagSnap = await db
      .collection('newMemberCollection')
      .where('isAdmin', '==', true)
      .get();

    const emails = new Set<string>();
    for (const doc of [...byRoleSnap.docs, ...byFlagSnap.docs]) {
      const e = (doc.data() as any)?.email;
      if (typeof e === 'string' && e.includes('@')) emails.add(e);
    }
    return emails.size > 0 ? Array.from(emails) : fallback;
  } catch (err) {
    console.error('Failed to fetch admin recipients:', err);
    return fallback;
  }
}

/**
 * If a previous attempt claimed an event but crashed before completing (the route
 * returned 500), Stripe retries the same event id. We allow the retry to reclaim
 * once the claim is stale so provisioning is never permanently skipped.
 */
const PROCESSING_STALE_MS = 60 * 1000;

async function findMemberRefBySubscriptionId(subscriptionId: string) {
  const db = adminDb;
  if (!db || !subscriptionId) return null;
  const bySub = await db.collection('newMemberCollection').where('subscriptionId', '==', subscriptionId).limit(1).get();
  if (!bySub.empty) return bySub.docs[0].ref;
  const byLegacy = await db.collection('newMemberCollection').where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();
  if (!byLegacy.empty) return byLegacy.docs[0].ref;
  return null;
}

async function findMemberRefForSubscription(sub: Stripe.Subscription) {
  const db = adminDb;
  if (!db) return null;

  const userId = typeof sub?.metadata?.userId === 'string' ? sub.metadata.userId : undefined;
  if (userId) {
    const docRef = db.collection('newMemberCollection').doc(userId);
    const snap = await docRef.get();
    if (snap.exists) return docRef;
  }

  const subscriptionId = typeof sub?.id === 'string' ? sub.id : '';
  const bySub = await findMemberRefBySubscriptionId(subscriptionId);
  if (bySub) return bySub;

  const customerId = typeof sub?.customer === 'string' ? sub.customer : (sub.customer as any)?.id;
  if (typeof customerId === 'string' && customerId) {
    const byCustomer = await db.collection('newMemberCollection').where('stripeCustomerId', '==', customerId).limit(1).get();
    if (!byCustomer.empty) return byCustomer.docs[0].ref;
  }

  return null;
}

async function demoteMemberToFree(ref: DocumentReference, reason: string) {
  const nowIso = new Date().toISOString();
  const snap = await ref.get();
  const data = snap.data() || {};
  const alreadyCanceled = data?.subscriptionStatus === 'canceled' || data?.membershipTier === 'free';

  await ref.set(
    {
      membershipTier: 'free',
      subscriptionStatus: 'canceled',
      subscriptionId: FieldValue.delete(),
      stripeSubscriptionId: FieldValue.delete(),
      status: 'active',
      userInactive: false,
      updatedAt: nowIso,
    },
    { merge: true }
  );

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
  if (!adminDb) {
    return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
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
    const processedRef = adminDb.collection('stripe_webhook_events').doc(event.id);
    const claimResult = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(processedRef);
      if (!snap.exists) {
        tx.set(processedRef, {
          type: event.type,
          livemode: (event as any).livemode === true,
          status: 'processing',
          startedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        return 'claim';
      }
      const data = snap.data();
      if (data?.status === 'processed') return 'duplicate';
      // A stale 'processing' claim means the previous attempt crashed before
      // finishing (the route returned 500), so reclaim instead of skipping.
      const startedAt = typeof data?.startedAt === 'string' ? Date.parse(data.startedAt) : 0;
      const stale = !startedAt || Date.now() - startedAt > PROCESSING_STALE_MS;
      if (stale) {
        tx.update(processedRef, {
          status: 'processing',
          startedAt: new Date().toISOString(),
          retryCount: (typeof data?.retryCount === 'number' ? data.retryCount : 0) + 1,
        });
        return 'claim';
      }
      return 'duplicate';
    });

    if (claimResult === 'duplicate') {
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
        const usersRef = adminDb.collection('newMemberCollection');
        const userRef = usersRef.doc(userId);
        const userSnap = await userRef.get();

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
          membershipTier,
          billingInterval,
          stripeCustomerId,
          subscriptionId: stripeSubscriptionId,
          lastPaymentDate: nowIso,
          userInactive: false,
          updatedAt: nowIso,
        };

        if (!userSnap.exists) {
          membershipUpdate.createdAt = nowIso;
          membershipUpdate.role = 'member';
          membershipUpdate.isAdmin = false;
          membershipUpdate.isFeatured = false;
          if (emailFromStripe) {
            membershipUpdate.email = emailFromStripe;
            membershipUpdate.emailLower = emailLower;
          }
        }

        await userRef.set(membershipUpdate, { merge: true });
        console.log(`Successfully activated ${membershipTier} subscription`);

        const userData = userSnap.data() || {};
        const userEmail = emailFromStripe || userData.email;
        const firstName = userData.firstName || 'there';

        if (userEmail) {
          await sendPremiumWelcomeOnce(userRef, userEmail, firstName);
        }

        if (userEmail && !(userData as any).ghostPaidSyncedAt && !(userData as any).ghostPaidSyncAttemptedAt) {
          userRef.set({ ghostPaidSyncAttemptedAt: nowIso }, { merge: true }).catch(() => {});
          upgradeGhostMemberByEmail(userEmail, membershipTier)
            .then((res) => {
              if (res) return userRef.set({ ghostPaidSyncedAt: nowIso, ghostSyncedAt: nowIso }, { merge: true });
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

        await adminDb.collection('event_tickets').add({
          postId,
          ...(userId ? { userId } : { guestEmail: ticketEmail.toLowerCase().trim() }),
          userEmail: ticketEmail,
          amountPaid,
          currency,
          purchasedAt,
          stripeSessionId,
          paymentStatus,
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
              const profileRef = adminDb.collection('newMemberCollection').doc(userId);
              const profileSnap = await profileRef.get();
              const profileData = profileSnap.data() || {};
              if (profileData.firstName) {
                rsvpName = `${profileData.firstName} ${profileData.lastName || ''}`.trim() || rsvpName;
              }
              rsvpImage = String((profileData as any).profileImage || '');
              rsvpCompany = String((profileData as any).companyName || (profileData as any)['Company'] || '');
            } else {
              rsvpName = guestName || ticketEmail.split('@')[0] || rsvpName;
              attendeeKey = `guest:${encodeURIComponent(ticketEmail.toLowerCase().trim())}`;
            }

            const attendeeRef = adminDb.collection('events').doc(postSlug).collection('attendees').doc(attendeeKey);
            await attendeeRef.set({
              ...(userId ? { uid: userId } : { email: ticketEmail.toLowerCase().trim() }),
              name: rsvpName,
              image: rsvpImage,
              company: rsvpCompany,
              timestamp: purchasedAt,
              hasTicket: true,
              quantity: ticketQuantity,
              guestInfo
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
          const usersRef = adminDb.collection('newMemberCollection');
          let snapshot = await usersRef.where('emailLower', '==', customerEmailLower).limit(1).get();
          if (snapshot.empty) {
            snapshot = await usersRef.where('email', '==', customerEmail).limit(1).get();
          }
          
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            
            // Determine tier based on subscription interval if possible
            let tier = userData.membershipTier || 'paid_monthly';
            let interval = userData.billingInterval || 'month';
            
            try {
              const sub = await stripe.subscriptions.retrieve(invoice.subscription);
              interval = sub.items.data[0].plan.interval; // 'month' or 'year'
              tier = interval === 'year' ? 'paid_annual' : 'paid_monthly';
            } catch (e) {
              console.error('Error retrieving subscription for tier update:', e);
            }

            const nowIso = new Date().toISOString();

            await userDoc.ref.update({
              status: 'active',
              membershipTier: tier,
              billingInterval: interval,
              stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
              subscriptionId: invoice.subscription,
              lastPaymentDate: nowIso,
              userInactive: false,
              emailLower: customerEmailLower,
            });
            console.log(`Updated member tier to ${tier}`);

            await sendPremiumWelcomeOnce(userDoc.ref, customerEmail, userData.firstName || 'there');

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
      const memberRef = await findMemberRefForSubscription(sub);
      if (memberRef) {
        await demoteMemberToFree(memberRef, 'customer.subscription.deleted');
        console.log('Demoted member to free after subscription deletion');
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const memberRef = await findMemberRefForSubscription(sub);
      if (memberRef) {
        const nowIso = new Date().toISOString();
        const status = sub.status;
        if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) {
          await demoteMemberToFree(memberRef, `customer.subscription.updated (${status})`);
        } else {
          const interval = sub.items?.data?.[0]?.plan?.interval;
          const tier = interval === 'year' ? 'paid_annual' : 'paid_monthly';
          const isActive = status === 'active' || status === 'trialing';
          await memberRef.set(
            {
              subscriptionStatus: status,
              status: 'active',
              ...(isActive && (interval === 'month' || interval === 'year')
                ? { membershipTier: tier, billingInterval: interval }
                : {}),
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any;
      const subscriptionId = typeof invoice?.subscription === 'string' ? invoice.subscription : '';
      const memberRef = subscriptionId ? await findMemberRefBySubscriptionId(subscriptionId) : null;
      if (memberRef) {
        await memberRef.set(
          {
            subscriptionStatus: 'past_due',
            status: 'active',
            lastPaymentFailedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        const snap = await memberRef.get();
        const email = snap.data()?.email || '';
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

    await processedRef.set({ status: 'processed', processedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
