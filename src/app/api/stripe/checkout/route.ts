import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth, currentUser } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const clerkUser = userId ? await currentUser() : null;
    const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';

    const body = await request.json();
    const { 
      postId, 
      postSlug, 
      postTitle, 
      priceAmount, 
      standardAmount,
      hasMemberDiscount,
      plan, 
      cycle, 
      quantity = 1,
      guestInfo = '',
      customerEmail = '',
      customerFirstName = '',
    } = body;

    // Resolve the purchaser's email: explicit body field wins, then Clerk account.
    const userEmail: string =
      (typeof customerEmail === 'string' && customerEmail.trim()) || clerkEmail || '';
    const displayName: string =
      (typeof customerFirstName === 'string' && customerFirstName.trim()) ||
      (clerkUser ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() : '') ||
      'Guest';

    // If the request specifies a subscription plan (e.g. Premium Member) a Clerk
    // account is required so the subscription can be attached.
    if (plan === 'premium') {
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

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

      const priceId = cycle === 'annually'
        ? (process.env.STRIPE_ANNUAL_PRICE_ID || 'price_1TWbKFLZwCrAHQYP9gKzdpvx')
        : (process.env.STRIPE_MONTHLY_PRICE_ID || 'price_1TVHicLZwCrAHQYPLXqio8Bi')

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

    // Otherwise, the event-ticket checkout: guests are allowed. Email is required
    // so Stripe can send the receipt and we can record the RSVP.
    if (!userEmail) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    // Check if Stripe key is available (but mock mode is still returned below if missing)
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[STRIPE MOCK] No STRIPE_SECRET_KEY found. Running in mock mode.');
      return NextResponse.json({ 
        url: `/news/${postSlug}?success=mock_stripe_checkout_complete&reason=missing_key` 
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
      if (!adminDb) {
        return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
      }

      // Try to look up a richer profile when a Clerk user exists; otherwise use
      // the display name/email from the request body.
      let attendeeName = displayName;
      let attendeeImage = '';
      let attendeeCompany = '';
      let attendeeUid: string = userId || '';
      let attendeeKey: string = userId || '';
      let profileData: any = null;

      if (userId) {
        const profileSnap = await adminDb.collection('newMemberCollection').doc(userId).get();
        profileData = profileSnap.data() || {};
        if (profileData) {
          if (profileData.firstName) {
            attendeeName = `${profileData.firstName} ${profileData.lastName || ''}`.trim() || attendeeName;
          }
          attendeeImage = String(profileData.profileImage || '');
          attendeeCompany = String(profileData.companyName || profileData['Company'] || '');
        }
      }

      // For anonymous guests: use a stable email-based doc key so repeat RSVPs
      // collapse into one record instead of creating new docs every attempt.
      if (!attendeeKey) {
        const emailKey = encodeURIComponent(userEmail.toLowerCase().trim());
        attendeeKey = `guest:${emailKey}`;
      }

      const eventDocRef = adminDb.collection('events').doc(postSlug);
      const attendeeRef = eventDocRef.collection('attendees').doc(attendeeKey);
      
      await attendeeRef.set({
        uid: attendeeUid || undefined,
        email: userEmail.toLowerCase().trim(),
        name: attendeeName,
        image: attendeeImage,
        company: attendeeCompany,
        timestamp: new Date().toISOString(),
        ticketType: 'free',
        quantity: parseInt(quantity) || 1,
        guestInfo: guestInfo || ''
      });

      // Instead of returning a URL to redirect to, just return a success flag
      return NextResponse.json({ success: true, free: true });
    }

    const qty = parseInt(quantity) || 1;
    const items = [];

    // Member discount only applies if there actually is a signed-in Clerk user
    // (so a matching membership profile exists) AND the event has a member rate.
    // Unauthenticated buyers always pay the standard rate for every ticket.
    const canApplyMemberDiscount = Boolean(userId && hasMemberDiscount && qty > 1 && standardAmount);

    if (canApplyMemberDiscount) {
      // 1 Member ticket, remainder are standard guest tickets
      items.push({
        price_data: { 
          currency: 'gbp', 
          product_data: { name: `Member Ticket for: ${postTitle}` }, 
          unit_amount: unitAmount 
        },
        quantity: 1,
      });
      items.push({
        price_data: { 
          currency: 'gbp', 
          product_data: { name: `Guest Ticket for: ${postTitle}` }, 
          unit_amount: parseInt(standardAmount) 
        },
        quantity: qty - 1,
      });
    } else if (qty > 1 && standardAmount && hasMemberDiscount && !userId) {
      // Guest checkout with member-discount pricing on the event: treat every
      // ticket at the standard (non-member) rate so the discount isn't leaked.
      items.push({
        price_data: { 
          currency: 'gbp', 
          product_data: { name: `Ticket for: ${postTitle}` }, 
          unit_amount: typeof standardAmount === 'number' ? standardAmount : Number(standardAmount)
        },
        quantity: qty,
      });
    } else {
      // Just standard checkout
      items.push({
        price_data: { 
          currency: 'gbp', 
          product_data: { name: `Ticket for: ${postTitle}` }, 
          unit_amount: unitAmount 
        },
        quantity: qty,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: userEmail || undefined,
      line_items: items,
      mode: 'payment',
      success_url: `${cleanOrigin}/news/${postSlug}?success=ticket_purchased`,
      cancel_url: `${cleanOrigin}/news/${postSlug}?canceled=true`,
      metadata: { 
        postId, 
        postSlug, 
        ...(userId ? { userId } : { guestEmail: userEmail.toLowerCase().trim(), guestName: displayName.substring(0, 200) }),
        quantity: qty.toString(),
        guestInfo: typeof guestInfo === 'string' ? guestInfo.substring(0, 500) : '' // Stripe metadata has 500 char limit
      } 
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout session.' }, { status: 500 });
  }
}
