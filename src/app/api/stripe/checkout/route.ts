import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postId, postSlug, postTitle, userEmail, userId, priceAmount, plan } = body;

    // Check if Stripe key is available
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[STRIPE MOCK] No STRIPE_SECRET_KEY found. Running in mock mode.');
      console.log(`[STRIPE MOCK] Received checkout request for ${plan ? 'Subscription' : 'Event'}: ${postTitle || plan}`);
      console.log(`[STRIPE MOCK] Buyer: ${userEmail} (ID: ${userId})`);
      if (priceAmount) console.log(`[STRIPE MOCK] Amount: £${priceAmount / 100}`);
      
      return NextResponse.json({ 
        url: `/dashboard?success=mock_stripe_checkout_complete&reason=missing_key` 
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16' as any, // Using stable typing
    });

    // Determine the base origin. If NEXT_PUBLIC_SITE_URL is set (like in Vercel), use it.
    // Otherwise fallback to the origin header or hardcoded live URL.
    const origin = process.env.NEXT_PUBLIC_SITE_URL 
      || request.headers.get('origin') 
      || 'https://yorkshirebusinesswoman.co.uk';

    // If the request specifies a subscription plan (e.g. Premium Member)
    if (plan === 'premium') {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: userEmail,
        line_items: [{
          price: 'price_1TVHicLZwCrAHQYPLXqio8Bi', // The Stripe Price ID provided by the user
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${origin}/dashboard?success=subscription_active`,
        cancel_url: `${origin}/membership`,
        metadata: { userId, plan } // Stored so Stripe Webhooks can update Firebase later
      });
      return NextResponse.json({ url: session.url });
    }

    // Otherwise, fallback to the original logic: Event Ticket purchases
    if (priceAmount === undefined || isNaN(priceAmount)) {
       throw new Error(`Invalid priceAmount received: ${priceAmount}`);
    }

    // Handle FREE tickets (no Stripe required)
    if (priceAmount === 0) {
      console.log(`[CHECKOUT] Processing free ticket for event: ${postSlug}`);
      // Return a special flag or a direct success URL that the frontend can use to RSVP
      // Wait, we can just return the success URL, and let the frontend or webhook handle it?
      // Actually, if it's free, we don't go to Stripe. We can just add the user to the RSVP list directly.
      const { adminDb } = await import('@/lib/firebase-admin');
      
      // Fetch user profile to get name/image for the RSVP list
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

      return NextResponse.json({ url: `${origin}/news/${postSlug}?success=ticket_purchased` });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: [{
        price_data: { 
          currency: 'gbp', 
          product_data: { name: `Ticket for: ${postTitle}` }, 
          unit_amount: priceAmount 
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${origin}/news/${postSlug}?success=ticket_purchased`,
      cancel_url: `${origin}/news/${postSlug}?canceled=true`,
      metadata: { postId, postSlug, userId } // Stored so Stripe Webhooks can update Firebase later
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout session.' }, { status: 500 });
  }
}
