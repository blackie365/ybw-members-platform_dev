import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postId, postTitle, userEmail, userId, priceAmount } = body;

    // Check if Stripe key is available
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[STRIPE MOCK] No STRIPE_SECRET_KEY found. Running in mock mode.');
      console.log(`[STRIPE MOCK] Received checkout request for Event: ${postTitle}`);
      console.log(`[STRIPE MOCK] Buyer: ${userEmail} (ID: ${userId})`);
      console.log(`[STRIPE MOCK] Amount: £${priceAmount / 100}`);
      
      return NextResponse.json({ 
        url: `/dashboard?success=mock_stripe_checkout_complete` 
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16' as any, // Using stable typing
    });

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create a real Stripe Checkout Session
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
      success_url: `${origin}/dashboard?success=ticket_purchased`,
      cancel_url: `${origin}/news/${postId}?canceled=true`,
      metadata: { postId, userId } // Stored so Stripe Webhooks can update Firebase later
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('Stripe API error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}
