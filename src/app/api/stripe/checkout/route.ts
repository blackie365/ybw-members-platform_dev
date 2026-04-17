import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postId, postTitle, userEmail, userId, priceAmount } = body;

    // TODO: In the future, install `stripe` npm package and initialize it here with your secret key
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

    console.log(`[STRIPE MOCK] Received checkout request for Event: ${postTitle}`);
    console.log(`[STRIPE MOCK] Buyer: ${userEmail} (ID: ${userId})`);
    console.log(`[STRIPE MOCK] Amount: £${priceAmount / 100}`);

    // MOCK: Instead of creating a real Stripe session, we will just return a fake URL 
    // that redirects back to the dashboard.
    // 
    // REAL CODE WOULD LOOK LIKE THIS:
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   customer_email: userEmail,
    //   line_items: [{
    //     price_data: { currency: 'gbp', product_data: { name: `Ticket for: ${postTitle}` }, unit_amount: priceAmount },
    //     quantity: 1,
    //   }],
    //   mode: 'payment',
    //   success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/events?success=true`,
    //   cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/news/${postId}?canceled=true`,
    //   metadata: { postId, userId } // We store this so Stripe Webhooks can update Firebase later!
    // });
    // return NextResponse.json({ url: session.url });

    // Mock Return:
    return NextResponse.json({ 
      url: `/dashboard?success=mock_stripe_checkout_complete` 
    });

  } catch (error) {
    console.error('Stripe API error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}
