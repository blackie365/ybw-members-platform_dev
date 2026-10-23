/**
 * Public intake: a business asks for a slot in the magazine, we record it, then
 * hand them to Stripe Checkout.
 *
 *   POST /api/advertise/enquiry
 *
 * Flow: enquiry row -> Stripe Checkout -> (webhook) status becomes 'paid'
 *       -> editor approves -> the booking appears on the planning board.
 *
 * If Stripe keys are not configured we still record the enquiry and tell the
 * caller it needs manual invoicing, so no lead is ever lost to a missing key.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AD_BOOKING_KIND,
  createEnquiry,
  attachStripeSession,
  findIssue,
  formatPrice,
  getSlot,
  getStripe,
  listBookableIssues,
  resolveSale,
  siteOrigin,
  stripeConfigured,
} from '@/features/advertising/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  slotKey: z.string().trim().min(1),
  issueId: z.string().trim().optional(),
  client: z.string().trim().min(2).max(160),
  contactName: z.string().trim().max(160).optional(),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().trim().max(60).optional(),
  websiteUrl: z.string().trim().url().optional().or(z.literal('')),
  paidCategory: z.string().trim().max(80).optional(),
  bodyHtml: z.string().trim().max(8000).optional(),
});

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: 'invalid_request', detail: e instanceof Error ? e.message : 'Bad request body' },
      { status: 400 },
    );
  }

  const slot = getSlot(parsed.slotKey);
  if (!slot) return NextResponse.json({ error: 'unknown_slot' }, { status: 400 });

  let openIssues;
  try {
    openIssues = await listBookableIssues();
  } catch {
    return NextResponse.json({ error: 'booking_store_unavailable' }, { status: 503 });
  }
  if (openIssues.length === 0) {
    return NextResponse.json(
      { error: 'no_issue_open', detail: 'There is no issue open for booking yet.' },
      { status: 409 },
    );
  }

  const requested =
    (parsed.issueId ? findIssue(openIssues, parsed.issueId) : undefined) ?? openIssues[0]!;

  let resolved;
  try {
    resolved = await resolveSale(slot.key, requested, openIssues);
  } catch {
    return NextResponse.json({ error: 'booking_store_unavailable' }, { status: 503 });
  }
  if (!resolved.ok) {
    if (resolved.reason === 'sold_out') {
      return NextResponse.json({ error: 'sold_out', issueId: requested.id }, { status: 409 });
    }
    return NextResponse.json({ error: 'unknown_slot' }, { status: 400 });
  }
  const target = resolved.target;

  const copy = parsed.bodyHtml ? stripTags(parsed.bodyHtml) : '';
  if (slot.bodyMaxChars > 0 && copy.length > slot.bodyMaxChars) {
    return NextResponse.json(
      { error: 'copy_too_long', maxChars: slot.bodyMaxChars, actual: copy.length },
      { status: 400 },
    );
  }

  // The shop always charges the standard rate. Member rates are agreed with the
  // editor separately, so no discount is applied automatically here.
  const amountPence = slot.pricePence;

  let booking;
  try {
    booking = await createEnquiry({
      issue: target.issue,
      slotKey: slot.key,
      client: parsed.client,
      contactName: parsed.contactName ?? null,
      contactEmail: parsed.contactEmail,
      contactPhone: parsed.contactPhone ?? null,
      websiteUrl: parsed.websiteUrl || null,
      paidCategory: parsed.paidCategory ?? null,
      bodyHtml: parsed.bodyHtml ?? null,
      amountPence,
    });
  } catch {
    return NextResponse.json({ error: 'could_not_record_booking' }, { status: 503 });
  }

  const base = {
    bookingRef: booking.booking_ref,
    issueId: booking.issue_id,
    issueLabel: booking.issue_label,
    amountPence,
    amountLabel: formatPrice(amountPence),
    overflowed: target.overflowed,
  };

  const stripe = getStripe();
  if (!stripe || !stripeConfigured()) {
    return NextResponse.json(
      {
        ...base,
        status: 'enquiry',
        payment: 'manual',
        message:
          'Booking recorded. Online card payment is not switched on yet, so the editor will invoice you directly.',
      },
      { status: 201 },
    );
  }

  const origin = siteOrigin(new URL(req.url).origin);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: booking.contact_email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: amountPence,
            product_data: {
              name: `${slot.label} — ${booking.issue_label}`,
              description: slot.blurb.slice(0, 200),
            },
          },
        },
      ],
      success_url: `${origin}/advertise/success?ref=${encodeURIComponent(booking.booking_ref)}`,
      cancel_url: `${origin}/advertise?cancelled=1`,
      metadata: {
        kind: AD_BOOKING_KIND,
        booking_ref: booking.booking_ref,
        booking_id: String(booking.id),
      },
    });
    await attachStripeSession(booking.id, session.id);
    return NextResponse.json({ ...base, status: 'enquiry', checkoutUrl: session.url }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        ...base,
        status: 'enquiry',
        payment: 'manual',
        message: 'Booking recorded, but we could not start the card payment. The editor will be in touch.',
        detail: e instanceof Error ? e.message : undefined,
      },
      { status: 201 },
    );
  }
}
