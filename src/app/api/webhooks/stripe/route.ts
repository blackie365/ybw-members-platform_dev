import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getWelcomeEmailTemplate, getEventTicketConfirmationEmailTemplate } from '@/lib/email-templates';
import { addGhostMember, upgradeGhostMemberByEmail } from '@/lib/ghost-admin';

// Need to access raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

async function getAdminRecipients(): Promise<string[]> {
  const fallback = ['editor@yorkshirebusinesswoman.co.uk'];
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
    const isDuplicate = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(processedRef);
      if (snap.exists) return true;
      tx.set(processedRef, {
        type: event.type,
        livemode: (event as any).livemode === true,
        createdAt: new Date().toISOString(),
      });
      return false;
    });

    if (isDuplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Handle successful checkout
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const { postId, postSlug, userId, plan, cycle } = session.metadata || {};
      
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
          isNewsletterAuthorized: true,
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
        const displayName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

        if (userEmail && !(userData as any).premiumWelcomeEmailSentAt && !(userData as any).premiumWelcomeEmailAttemptedAt) {
          userRef.set({ premiumWelcomeEmailAttemptedAt: nowIso }, { merge: true }).catch(() => {});
          sendEmail({
            to: userEmail,
            subject: 'Welcome to Yorkshire Businesswoman!',
            html: await getWelcomeEmailTemplate(firstName, process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk')
          })
            .then(() => userRef.set({ premiumWelcomeEmailSentAt: nowIso }, { merge: true }))
            .catch(err => console.error('Failed to send welcome email:', err));
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
      if (postId && userId) {
        await adminDb.collection('event_tickets').add({
          postId,
          userId,
          userEmail: session.customer_details?.email || session.customer_email,
          amountPaid: session.amount_total,
          currency: session.currency,
          purchasedAt: new Date().toISOString(),
          stripeSessionId: session.id,
          paymentStatus: session.payment_status,
        });

        // Automatically RSVP the user to the event
        if (postSlug) {
          try {
            const profileRef = adminDb.collection('newMemberCollection').doc(userId);
            const profileSnap = await profileRef.get();
            const profileData = profileSnap.data() || {};

            const attendeeRef = adminDb.collection('events').doc(postSlug).collection('attendees').doc(userId);
            await attendeeRef.set({
              uid: userId,
              name: profileData.firstName ? `${profileData.firstName} ${profileData.lastName || ''}` : 'Member',
              image: profileData.profileImage || '',
              company: profileData.companyName || profileData['Company'] || '',
              timestamp: new Date().toISOString(),
              hasTicket: true
            });
            console.log(`Successfully added attendee to RSVP list for ${postSlug}`);

            // Workflow: Send Event Ticket Confirmation Email
            const userEmail = session.customer_details?.email || session.customer_email || profileData.email;
            const firstName = profileData.firstName || 'there';

            if (userEmail) {
              sendEmail({
                to: userEmail,
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
              isNewsletterAuthorized: true,
              emailLower: customerEmailLower,
            });
            console.log(`Updated member tier to ${tier}`);

            // Send premium welcome email if it hasn't been sent yet
            const userEmail = customerEmail;
            const firstName = userData.firstName || 'there';
            const displayName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

            if (!(userData as any).premiumWelcomeEmailSentAt && !(userData as any).premiumWelcomeEmailAttemptedAt) {
              userDoc.ref.update({ premiumWelcomeEmailAttemptedAt: nowIso }).catch(() => {});
              sendEmail({
                to: userEmail,
                subject: 'Welcome to Yorkshire Businesswoman!',
                html: await getWelcomeEmailTemplate(firstName, process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk')
              })
                .then(() => userDoc.ref.update({ premiumWelcomeEmailSentAt: nowIso }))
                .catch(err => console.error('Failed to send welcome email from invoice webhook:', err));
            }

            // Sync to Ghost CMS if not synced yet
            if (!(userData as any).ghostPaidSyncedAt && !(userData as any).ghostPaidSyncAttemptedAt) {
              userDoc.ref.update({ ghostPaidSyncAttemptedAt: nowIso }).catch(() => {});
              upgradeGhostMemberByEmail(userEmail, tier)
                .then((res) => {
                  if (res) return userDoc.ref.update({ ghostPaidSyncedAt: nowIso, ghostSyncedAt: nowIso });
                })
                .catch(() => {});
            }

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
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
