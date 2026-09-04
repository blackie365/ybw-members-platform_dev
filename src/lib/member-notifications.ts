import { getMemberStore } from '@/features/members/server';
import type { MemberProfile } from '@/features/members/server/member-store';
import { sendEmail } from '@/lib/email';
import { getWelcomeEmailTemplate, getFreeWelcomeEmailTemplate } from '@/lib/email-templates';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk';

/**
 * A member is treated as paid when their tier is non-free or when Stripe billing
 * identity is present. This is the single source of truth used across the
 * onboarding/reconciliation paths.
 */
export function isPaidSignal(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return false;
  const tier = typeof data?.membershipTier === 'string' ? data.membershipTier : 'free';
  if (tier !== 'free') return true;
  return Boolean(data?.stripeCustomerId || data?.subscriptionId || data?.stripeSubscriptionId);
}

/**
 * Send the premium welcome email at most once. Uses an atomic Postgres claim
 * (row-level) so the Stripe webhook and the dashboard post-checkout polling
 * cannot both send it. Claim/flag state lives in the member's data blob.
 */
export async function sendPremiumWelcomeOnce(
  clerkId: string,
  email: string,
  firstName: string,
) {
  if (!clerkId || !email) return;
  const store = getMemberStore();
  const member = await store.getMemberByClerkId(clerkId);
  if (member && (member.premiumWelcomeEmailSentAt as string | undefined)) return;

  const claimed = await store.claimOnce(clerkId, 'premiumWelcomeEmailAttemptedAt');
  if (!claimed) return;

  try {
    await sendEmail({
      to: email,
      subject: 'Welcome to Yorkshire Businesswoman!',
      html: await getWelcomeEmailTemplate(firstName || 'there', SITE_URL),
    });
    await store.setFlags(clerkId, { premiumWelcomeEmailSentAt: new Date().toISOString() });
  } catch (err) {
    // Clear the claim so a later event (e.g. next invoice) can retry the send.
    await store.clearClaim(clerkId, 'premiumWelcomeEmailAttemptedAt');
    console.error('Failed to send premium welcome email:', err);
  }
}

/**
 * Send the free welcome email at most once. Respects the legacy `welcomeEmailSentAt`
 * flag written by the old Clerk webhook path so long-standing members aren't
 * re-welcomed.
 */
export async function sendFreeWelcomeOnce(
  clerkId: string,
  email: string,
  firstName: string,
) {
  if (!clerkId || !email) return;
  const store = getMemberStore();
  const member = await store.getMemberByClerkId(clerkId);
  const data = (member as Record<string, unknown> | null) || {};
  if (data.welcomeEmailSentAt || data.freeWelcomeEmailSentAt) return;

  const claimed = await store.claimOnce(clerkId, 'freeWelcomeEmailAttemptedAt');
  if (!claimed) return;

  try {
    await sendEmail({
      to: email,
      subject: 'Welcome to Yorkshire Businesswoman!',
      html: await getFreeWelcomeEmailTemplate(firstName || 'there', SITE_URL),
    });
    const sentAt = new Date().toISOString();
    await store.setFlags(clerkId, { freeWelcomeEmailSentAt: sentAt, welcomeEmailSentAt: sentAt });
  } catch (err) {
    await store.clearClaim(clerkId, 'freeWelcomeEmailAttemptedAt');
    console.error('Failed to send free welcome email:', err);
  }
}

/**
 * Send the appropriate welcome email (premium vs free) based on the member's
 * current paid state, each at most once. Call after any reconciliation step.
 */
export async function ensureWelcomeEmailForMember(member: MemberProfile) {
  if (!member?.clerkId) return;
  const email = typeof member.email === 'string' ? member.email : '';
  const firstName = typeof member.firstName === 'string' ? member.firstName : 'there';

  if (isPaidSignal(member)) {
    await sendPremiumWelcomeOnce(member.clerkId, email, firstName);
  } else {
    await sendFreeWelcomeOnce(member.clerkId, email, firstName);
  }
}
