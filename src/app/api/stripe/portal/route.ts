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

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk';
    const cleanOrigin = origin.replace(/\/$/, '');
    let stripeCustomerId: string | undefined;

    if (adminDb) {
      const profileSnap = await adminDb.collection('newMemberCollection').doc(userId).get();
      const profile = profileSnap.data() as any;
      if (profile?.stripeCustomerId && typeof profile.stripeCustomerId === 'string') {
        stripeCustomerId = profile.stripeCustomerId;
      }
    }

    if (!stripeCustomerId && userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(userEmail ? { email: userEmail } : undefined);
      stripeCustomerId = customer.id;
      if (adminDb) {
        await adminDb.collection('newMemberCollection').doc(userId).set({ stripeCustomerId }, { merge: true });
      }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${cleanOrigin}/dashboard/profile`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Portal API error:', error);
    return NextResponse.json({ error: 'Failed to create billing portal session.' }, { status: 500 });
  }
}
