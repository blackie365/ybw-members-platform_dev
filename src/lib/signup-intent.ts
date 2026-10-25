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

/** Build a /sign-up URL that is allowed through the closed-sign-up gate. */
export function signUpUrlFor(intent: PaidSignupIntent, returnUrl: string): string {
  return `/sign-up?${SIGNUP_INTENT_PARAM}=${intent}&returnUrl=${encodeURIComponent(returnUrl)}`;
}
