import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

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
