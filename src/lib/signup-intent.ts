/**
 * Public self-service sign-up is closed (see /sign-up), but genuine paid
 * journeys — Premium membership checkout and event ticket booking — still need
 * an account before they can pay.
 *
 * Those entry points tag their sign-up link with an `intent` value from the
 * allow-list below, which re-opens the Clerk form for that visit only.
 */
export const SIGNUP_INTENT_PARAM = 'intent';

export const PAID_SIGNUP_INTENTS = ['paid', 'booking'] as const;

export type PaidSignupIntent = (typeof PAID_SIGNUP_INTENTS)[number];

export function isPaidSignupIntent(value: string | string[] | undefined): boolean {
  const intent = Array.isArray(value) ? value[0] : value;
  return typeof intent === 'string' && (PAID_SIGNUP_INTENTS as readonly string[]).includes(intent);
}

/**
 * Clerk `unsafe_metadata` key used to carry the intent from the sign-up form
 * through to the Clerk `user.created` webhook.
 *
 * The Clerk account (and its member record) is created before payment, so the
 * webhook needs to know whether this person was heading to a paid journey — a
 * paid sign-up that never completes payment must not be recorded as a free
 * member.
 */
export const SIGNUP_INTENT_METADATA_KEY = 'signupIntent';

/** Build the Clerk `unsafeMetadata` payload for a paid/booking sign-up. */
export function paidSignupMetadata(
  value: string | string[] | undefined,
): Record<string, unknown> | undefined {
  const intent = Array.isArray(value) ? value[0] : value;
  if (!isPaidSignupIntent(intent)) return undefined;
  return { [SIGNUP_INTENT_METADATA_KEY]: intent };
}

/** Read a paid/booking intent back out of Clerk `unsafe_metadata`. */
export function paidIntentFromMetadata(metadata: unknown): PaidSignupIntent | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)[SIGNUP_INTENT_METADATA_KEY];
  return typeof value === 'string' && (PAID_SIGNUP_INTENTS as readonly string[]).includes(value)
    ? (value as PaidSignupIntent)
    : undefined;
}

/** Build a /sign-up URL that is allowed through the closed-sign-up gate. */
export function signUpUrlFor(intent: PaidSignupIntent, returnUrl: string): string {
  return `/sign-up?${SIGNUP_INTENT_PARAM}=${intent}&returnUrl=${encodeURIComponent(returnUrl)}`;
}
