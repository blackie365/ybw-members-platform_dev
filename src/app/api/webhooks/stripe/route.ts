import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getWelcomeEmailTemplate, getEventTicketConfirmationEmailTemplate } from '@/lib/email-templates';

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
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    // Handle successful checkout
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const { postId, postSlug, userId, plan } = session.metadata || {};
      
      // If this was a subscription checkout, update the user immediately
      if (plan && userId) {
        const usersRef = adminDb.collection('newMemberCollection');
        const userDoc = await usersRef.doc(userId).get();
        
        if (userDoc.exists) {
          const membershipTier = plan.toLowerCase().includes('annual') || plan.toLowerCase().includes('year') ? 'paid_annual' : 'paid_monthly';
          const billingInterval = membershipTier === 'paid_annual' ? 'year' : 'month';

          await userDoc.ref.update({
            status: 'active',
            membershipTier: membershipTier,
            billingInterval: billingInterval,
            stripeCustomerId: session.customer,
            subscriptionId: session.subscription,
            lastPaymentDate: new Date().toISOString(),
            userInactive: false,
            isNewsletterAuthorized: true,
          });
          console.log(`Successfully activated ${membershipTier} subscription for user ${userId}`);

          // Trigger Welcome Email Workflow non-blockingly
          const userData = userDoc.data() || {};
          const userEmail = session.customer_details?.email || session.customer_email || userData.email;
          const firstName = userData.firstName || 'there';

          if (userEmail) {
            // We do not await this, so the webhook can respond to Stripe immediately
            sendEmail({
                to: userEmail,
                subject: 'Welcome to Yorkshire Businesswoman!',
                html: await getWelcomeEmailTemplate(firstName, process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk')
              }).catch(err => console.error('Failed to send welcome email:', err));
          }

          // Notify all admins about the upgrade
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
            console.log(`Successfully added user ${userId} to RSVP list for ${postSlug}`);

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
        
        console.log(`Successfully recorded ticket purchase for user ${userId} and event ${postId}`);
      }
    }
    
    // Handle subscription (membership) successful payment
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any;
      
      if (invoice.subscription) {
        const customerEmail = invoice.customer_email;
        if (customerEmail) {
          const usersRef = adminDb.collection('newMemberCollection');
          const snapshot = await usersRef.where('email', '==', customerEmail).get();
          
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

            await userDoc.ref.update({
              status: 'active',
              membershipTier: tier,
              billingInterval: interval,
              stripeCustomerId: invoice.customer,
              subscriptionId: invoice.subscription,
              lastPaymentDate: new Date().toISOString(),
              userInactive: false,
              isNewsletterAuthorized: true,
            });
            console.log(`Updated user ${customerEmail} to ${tier} Member`);

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
