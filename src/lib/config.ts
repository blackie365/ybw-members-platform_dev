/**
 * Centralized configuration for the YBW application.
 * All magic strings and hardcoded values should live here.
 */

export const config = {
  /** Ghost CMS tier ID for premium/paid members */
  ghostTierId: process.env.GHOST_PREMIUM_TIER_ID || '',

  /** Default admin notification email when Firestore lookup fails */
  adminEmail: process.env.ADMIN_EMAIL || 'editor@yorkshirebusinesswoman.co.uk',

  /** Contact form recipient emails */
  contactRecipients: (process.env.CONTACT_RECIPIENTS || 'editor@yorkshirebusinesswoman.co.uk,dd@yorkshirebusinesswoman.co.uk').split(',').map(s => s.trim()),

  /**
   * Recipients for the admin-facing newsletter sign-up alert (distinct from contact
   * form to allow separate routing). Defaults match CONTACT_RECIPIENTS, with an
   * important transformation inside /api/newsletter: any address that matches the
   * sender's bare email is rewritten to a +alerts sub-address so Resend's
   * self-send delivery quirk (same mailbox in from AND to → silent drop) is
   * avoided while still delivering to the same inbox via '+tag' routing.
   */
  newsletterAlertRecipients: (process.env.NEWSLETTER_ALERT_RECIPIENTS || process.env.CONTACT_RECIPIENTS || 'editor@yorkshirebusinesswoman.co.uk,dd@yorkshirebusinesswoman.co.uk').split(',').map(s => s.trim()),

  /**
   * Verified From-address used by newsletter/alert emails. This MUST be a
   * Resend-verified sender (domain + SPF/DKIM). Previously we tried a
   * noreply@ sender here but that domain identity was unverified in Resend,
   * causing ALL copies (dd@ + editor@) to be silently discarded by the
   * provider even though the API accepted the request. Keep this pointed at
   * the existing editor@ mailbox identity which is already proven to deliver.
   */
  emailFrom: process.env.EMAIL_FROM || 'Yorkshire Businesswoman <editor@yorkshirebusinesswoman.co.uk>',

  /** @deprecated Use emailFrom. The noreply@ identity was never verified in Resend; keeping it breaks delivery on new recipients. */
  emailFromNoReply: process.env.EMAIL_FROM_NO_REPLY || process.env.EMAIL_FROM || 'Yorkshire Businesswoman <editor@yorkshirebusinesswoman.co.uk>',

  /** Sub-address tag appended to the sender email when we need to deliver to the
   *  same mailbox being used as the sender. '+alerts' is standard; Gmail/Google
   *  Workspace/most IMAP servers still deliver it into the primary inbox.
   *  Override via env if the MX doesn't support +tag routing.
   */
  newsletterAlertSelfTag: process.env.NEWSLETTER_ALERT_SELF_TAG || 'alerts',

  /** Firebase project ID */
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',

  /** Firebase Cloud Functions base URL */
  firebaseFunctionsBase: process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE || `https://us-central1-${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''}.cloudfunctions.net`,

  /** Default site URL */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk',
} as const;
