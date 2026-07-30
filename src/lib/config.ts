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

  /** Recipients for the admin-facing newsletter sign-up alert (distinct from contact form to allow separate routing) */
  newsletterAlertRecipients: (process.env.NEWSLETTER_ALERT_RECIPIENTS || process.env.CONTACT_RECIPIENTS || 'editor@yorkshirebusinesswoman.co.uk,dd@yorkshirebusinesswoman.co.uk').split(',').map(s => s.trim()),

  /** Default email from address — for reader-facing, personal correspondence */
  emailFrom: process.env.EMAIL_FROM || 'Yorkshire Businesswoman <editor@yorkshirebusinesswoman.co.uk>',

  /** No-reply/system from address for automated alerts. Different mailbox than recipients avoids a Resend quirk where same-`from`/same-mailbox `to` deliveries silently drop. */
  emailFromNoReply: process.env.EMAIL_FROM_NO_REPLY || 'Yorkshire Businesswoman Newsletter <noreply@yorkshirebusinesswoman.co.uk>',

  /** Firebase project ID */
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',

  /** Firebase Cloud Functions base URL */
  firebaseFunctionsBase: process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE || `https://us-central1-${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''}.cloudfunctions.net`,

  /** Default site URL */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk',
} as const;
