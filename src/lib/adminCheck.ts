import { adminAuth } from './firebase-admin';

// The hardcoded admin emails that were previously checked on the client-side
// Now securely evaluated on the server.
const ADMIN_EMAILS = [
  'robert@yorkshirebusinesswoman.co.uk',
  'admin@yorkshirebusinesswoman.co.uk'
];

/**
 * Validates if a given Firebase ID token belongs to an admin.
 * Use this in Next.js API Routes or Server Actions to secure endpoints.
 */
export async function verifyAdminToken(idToken: string): Promise<boolean> {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const email = decodedToken.email;

    if (!email) return false;

    // Check against custom claim OR the hardcoded secure list
    if (decodedToken.admin === true || ADMIN_EMAILS.includes(email.toLowerCase())) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error verifying admin token:', error);
    return false;
  }
}

/**
 * Utility to assign a custom claim to an admin user
 * Run this once per admin via a secure script to migrate away from hardcoded emails
 */
export async function grantAdminRole(email: string): Promise<void> {
  try {
    const user = await adminAuth.getUserByEmail(email);
    if (user.customClaims && user.customClaims.admin === true) {
      return;
    }
    await adminAuth.setCustomUserClaims(user.uid, { admin: true });
    console.log(`Granted admin role to ${email}`);
  } catch (error) {
    console.error('Error granting admin role:', error);
  }
}