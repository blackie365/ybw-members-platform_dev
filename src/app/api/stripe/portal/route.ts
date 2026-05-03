import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, userEmail } = body;

    // Check if Stripe key is available
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[STRIPE MOCK] No STRIPE_SECRET_KEY found. Running in mock mode.');
      return NextResponse.json({ 
        url: `/dashboard/profile?message=mock_stripe_portal` 
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16' as any, // Using stable typing
    });

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    let stripeCustomerId = customerId;

    // If no customerId is provided but we have an email, we can try to look up the customer
    if (!stripeCustomerId && userEmail) {
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1
      });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      }
    }

    if (!stripeCustomerId) {
      // Create a customer just to allow portal access (or handle gracefully)
      const customer = await stripe.customers.create({
        email: userEmail,
      });
      stripeCustomerId = customer.id;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/dashboard/profile`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Portal API error:', error);
    return NextResponse.json({ error: 'Failed to create billing portal session.' }, { status: 500 });
  }
}
