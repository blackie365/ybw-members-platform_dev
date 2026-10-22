/**
 * Stripe access for YBW advertising. Returns null when no key is configured so
 * the shop can degrade to "we'll invoice you" rather than throwing a 500 at a
 * customer mid-form.
 *
 * YBW already uses STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET for memberships
 * and event tickets, so advertising reuses them — ad payments arrive at the
 * existing /api/webhooks/stripe endpoint.
 */
import Stripe from 'stripe';

let cached: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim());
}

export function getStripe(): Stripe | null {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return null;
  if (!cached) cached = new Stripe(key);
  return cached;
}

/** Absolute site origin used for Stripe redirect URLs. */
export function siteOrigin(fallback: string): string {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return fallback;
}

/** Metadata tag that marks a Checkout session as an advertising booking. */
export const AD_BOOKING_KIND = 'ybw_ad_booking';
