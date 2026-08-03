import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
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
 * Atomically claim a one-time side effect so racing callers (Stripe webhook vs
 * dashboard reconciliation) can never both run it. If the attempt later fails
 * the caller is expected to clear the claim so it can be retried.
 */
async function claimOnce(memberRef: DocumentReference, attemptField: string): Promise<boolean> {
  const db = adminDb;
  if (!db) return false;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(memberRef);
    const data = snap.exists ? (snap.data() || {}) : {};
    if (data[attemptField]) return false;
    tx.set(memberRef, { [attemptField]: new Date().toISOString() }, { merge: true });
    return true;
  });
}

async function clearClaim(memberRef: DocumentReference, attemptField: string) {
  await memberRef.set({ [attemptField]: FieldValue.delete() }, { merge: true });
}

/**
 * Send the premium welcome email at most once. Uses a transactional claim so the
 * Stripe webhook and the dashboard post-checkout polling cannot both send it.
 */
export async function sendPremiumWelcomeOnce(
  memberRef: DocumentReference,
  email: string,
  firstName: string,
) {
  if (!email) return;
  const snap = await memberRef.get();
  if (snap.exists && (snap.data() || {}).premiumWelcomeEmailSentAt) return;

  const claimed = await claimOnce(memberRef, 'premiumWelcomeEmailAttemptedAt');
  if (!claimed) return;

  try {
    await sendEmail({
      to: email,
      subject: 'Welcome to Yorkshire Businesswoman!',
      html: await getWelcomeEmailTemplate(firstName || 'there', SITE_URL),
    });
    await memberRef.set({ premiumWelcomeEmailSentAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    // Clear the claim so a later event (e.g. next invoice) can retry the send.
    await clearClaim(memberRef, 'premiumWelcomeEmailAttemptedAt');
    console.error('Failed to send premium welcome email:', err);
  }
}

/**
 * Send the free welcome email at most once. Respects the legacy `welcomeEmailSentAt`
 * flag written by the old Clerk webhook path so long-standing members aren't
 * re-welcomed.
 */
export async function sendFreeWelcomeOnce(
  memberRef: DocumentReference,
  email: string,
  firstName: string,
) {
  if (!email) return;
  const snap = await memberRef.get();
  const data = snap.exists ? (snap.data() || {}) : {};
  if (data.welcomeEmailSentAt || data.freeWelcomeEmailSentAt) return;

  const claimed = await claimOnce(memberRef, 'freeWelcomeEmailAttemptedAt');
  if (!claimed) return;

  try {
    await sendEmail({
      to: email,
      subject: 'Welcome to Yorkshire Businesswoman!',
      html: await getFreeWelcomeEmailTemplate(firstName || 'there', SITE_URL),
    });
    const sentAt = new Date().toISOString();
    await memberRef.set(
      { freeWelcomeEmailSentAt: sentAt, welcomeEmailSentAt: sentAt },
      { merge: true },
    );
  } catch (err) {
    await clearClaim(memberRef, 'freeWelcomeEmailAttemptedAt');
    console.error('Failed to send free welcome email:', err);
  }
}

/**
 * Send the appropriate welcome email (premium vs free) based on the member's
 * current paid state, each at most once. Call after any reconciliation step.
 */
export async function ensureWelcomeEmailForMember(memberRef: DocumentReference) {
  const snap = await memberRef.get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  const email = typeof data?.email === 'string' ? data.email : '';
  const firstName = typeof data?.firstName === 'string' ? data.firstName : 'there';

  if (isPaidSignal(data)) {
    await sendPremiumWelcomeOnce(memberRef, email, firstName);
  } else {
    await sendFreeWelcomeOnce(memberRef, email, firstName);
  }
}
