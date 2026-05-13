import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';

// Need to access raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe keys missing' }, { status: 500 });
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
      if (plan === 'premium' && userId) {
        const usersRef = adminDb.collection('newMemberCollection');
        const userDoc = await usersRef.doc(userId).get();
        
        if (userDoc.exists) {
          await userDoc.ref.update({
            isPaidMember: true,
            stripeCustomerId: session.customer,
            subscriptionId: session.subscription,
            lastPaymentDate: new Date().toISOString(),
          });
          console.log(`Successfully activated premium subscription for user ${userId}`);

          // Trigger Welcome Email Workflow non-blockingly
          const userData = userDoc.data() || {};
          const userEmail = session.customer_details?.email || session.customer_email || userData.email;
          const firstName = userData.firstName || 'there';

          if (userEmail) {
            // We do not await this, so the webhook can respond to Stripe immediately
            sendEmail({
                to: userEmail,
                subject: 'Welcome to Yorkshire Businesswoman!',
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Welcome to Yorkshire Businesswoman</title>
                  </head>
                  <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f5f1; margin: 0; padding: 40px 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                      
                      <!-- Header with Logo -->
                      <div style="background-color: #18181b; padding: 30px; text-align: center;">
                        <img src="https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/membersLogos%2F6984d34a6ee5011c6442e15e%2Fprivate%2FAsset%201%404x.png?alt=media" alt="Yorkshire Businesswoman" style="max-height: 50px; width: auto;" />
                      </div>

                      <!-- Main Content -->
                      <div style="padding: 40px 30px; color: #3f3f46; line-height: 1.6; font-size: 16px;">
                        <h1 style="color: #18181b; font-size: 24px; margin-top: 0; font-weight: 600;">Welcome to the Community!</h1>
                        <p>Hi ${firstName},</p>
                        <p>Thank you for joining our network. We are absolutely thrilled to have you with us.</p>
                        <p>Your premium membership is now active, giving you full access to the member directory, exclusive event tickets, and the ability to connect directly with other professionals.</p>
                        
                        <div style="background-color: #f7f5f1; border-left: 4px solid #b79c65; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                          <h3 style="color: #18181b; margin-top: 0; font-size: 18px;">What's Next?</h3>
                          <ol style="margin-bottom: 0; padding-left: 20px;">
                            <li style="margin-bottom: 10px;"><strong>Complete your profile:</strong> Head over to your <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk'}/dashboard/profile" style="color: #b79c65; font-weight: bold; text-decoration: none;">Dashboard</a> and add your photo, bio, and LinkedIn link.</li>
                            <li style="margin-bottom: 10px;"><strong>Set your Coaching status:</strong> Let other members know if you are open to coaching or seeking a coach.</li>
                            <li><strong>Browse the Directory:</strong> Check out the <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk'}/members" style="color: #b79c65; font-weight: bold; text-decoration: none;">Member Directory</a> and start making connections!</li>
                          </ol>
                        </div>
                        
                        <p>If you have any questions, simply reply to this email.</p>
                        <p style="margin-bottom: 0;">Best regards,<br><strong style="color: #18181b;">The Yorkshire Businesswoman Team</strong></p>
                      </div>
                      
                      <!-- Footer -->
                      <div style="background-color: #fafafa; border-top: 1px solid #eaeaea; padding: 20px; text-align: center; color: #71717a; font-size: 12px;">
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Yorkshire Businesswoman. All rights reserved.</p>
                      </div>
                    </div>
                  </body>
                  </html>
                `
              }).catch(err => console.error('Failed to send welcome email:', err));
          }
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
                html: `
                  <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f46e5;">You're going to the event!</h2>
                    <p>Hi ${firstName},</p>
                    <p>This email confirms your successful ticket purchase and RSVP.</p>
                    <p>Your name has been automatically added to the guest list. You can view the event details and see who else is attending by visiting the event page on the Yorkshire Businesswoman platform.</p>
                    
                    <p>We look forward to seeing you there!</p>
                    
                    <p>Best regards,<br>The Yorkshire Businesswoman Team</p>
                  </div>
                `
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
      // In newer Stripe types, invoice is properly typed but 'subscription' might need to be accessed differently 
      // or we just cast to any to bypass strict type checking for the webhook
      const invoice = event.data.object as any;
      
      if (invoice.subscription) {
        // Upgrade member status to paid
        const customerEmail = invoice.customer_email;
        if (customerEmail) {
          const usersRef = adminDb.collection('newMemberCollection');
          const snapshot = await usersRef.where('email', '==', customerEmail).get();
          
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            await userDoc.ref.update({
              isPaidMember: true,
              stripeCustomerId: invoice.customer,
              subscriptionId: invoice.subscription,
              lastPaymentDate: new Date().toISOString(),
            });
            console.log(`Upgraded user ${customerEmail} to Paid Member`);
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
