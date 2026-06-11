import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth, currentUser } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';

    const body = await request.json();
    const { postId, postSlug, postTitle, priceAmount, plan, cycle } = body;

    // Check if Stripe key is available
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[STRIPE MOCK] No STRIPE_SECRET_KEY found. Running in mock mode.');
      return NextResponse.json({ 
        url: `/dashboard?success=mock_stripe_checkout_complete&reason=missing_key` 
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16' as any, // Using stable typing
    });

    // We must use the absolute origin because Stripe requires a fully qualified URL for success/cancel redirects.
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk';

    // Ensure origin does not have a trailing slash
    const cleanOrigin = origin.replace(/\/$/, '');

    // If the request specifies a subscription plan (e.g. Premium Member)
    if (plan === 'premium') {
      const priceId = cycle === 'annually' ?'price_1TWbKFLZwCrAHQYP9gKzdpvx' // Annual Price ID
        : 'price_1TVHicLZwCrAHQYPLXqio8Bi'; // Monthly Price ID

      let stripeCustomerId: string | undefined;
      if (adminDb) {
        const snap = await adminDb.collection('newMemberCollection').doc(userId).get();
        const existing = snap.data() as any;
        if (existing?.stripeCustomerId && typeof existing.stripeCustomerId === 'string') {
          stripeCustomerId = existing.stripeCustomerId;
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: userEmail || undefined }),
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${cleanOrigin}/dashboard?success=subscription_active`,
        cancel_url: `${cleanOrigin}/membership`,
        metadata: { userId, plan, cycle } // Stored so Stripe Webhooks can update Firebase later
      });
      return NextResponse.json({ url: session.url });
    }

    // Otherwise, fallback to the original logic: Event Ticket purchases
    if (!postSlug || typeof postSlug !== 'string') {
      throw new Error('Invalid postSlug received');
    }
    if (!postTitle || typeof postTitle !== 'string') {
      throw new Error('Invalid postTitle received');
    }

    const unitAmount = typeof priceAmount === 'number' ? priceAmount : Number(priceAmount);
    if (!Number.isFinite(unitAmount)) {
       throw new Error(`Invalid priceAmount received: ${priceAmount}`);
    }
    if (unitAmount < 0) {
      throw new Error(`Invalid priceAmount received: ${priceAmount}`);
    }

    // Handle FREE tickets (no Stripe required)
    if (unitAmount === 0) {
      const { adminDb } = await import('@/lib/firebase-admin');
      if (!adminDb) {
        return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
      }
      
      const profileSnap = await adminDb.collection('newMemberCollection').doc(userId).get();
      const profileData = profileSnap.data() || {};

      const eventDocRef = adminDb.collection('events').doc(postSlug);
      const attendeeRef = eventDocRef.collection('attendees').doc(userId);
      
      await attendeeRef.set({
        uid: userId,
        name: profileData.firstName ? `${profileData.firstName} ${profileData.lastName || ''}` : 'Member',
        image: profileData.profileImage || '',
        company: profileData.companyName || profileData['Company'] || '',
        timestamp: new Date().toISOString(),
        ticketType: 'free'
      });

      // Instead of returning a URL to redirect to, just return a success flag
      return NextResponse.json({ success: true, free: true });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: userEmail || undefined,
      line_items: [{
        price_data: { 
          currency: 'gbp', 
          product_data: { name: `Ticket for: ${postTitle}` }, 
          unit_amount: unitAmount 
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${cleanOrigin}/news/${postSlug}?success=ticket_purchased`,
      cancel_url: `${cleanOrigin}/news/${postSlug}?canceled=true`,
      metadata: { postId, postSlug, userId } // Stored so Stripe Webhooks can update Firebase later
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout session.' }, { status: 500 });
  }
}
