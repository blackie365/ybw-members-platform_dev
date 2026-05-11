import { adminAuth, adminDb } from './firebase-admin';

/**
 * Validates if a given Firebase ID token belongs to an admin.
 * Checks the user's document in Firestore for an `isAdmin` boolean flag.
 * Use this in Next.js API Routes or Server Actions to secure endpoints.
 */
export async function verifyAdminToken(idToken: string): Promise<boolean> {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (!uid) return false;

    // Check custom claim first for speed if it exists
    if (decodedToken.admin === true) {
      return true;
    }

    // Fallback to checking the Firestore database
    const userDoc = await adminDb.collection('newMemberCollection').doc(uid).get();
    if (userDoc.exists && userDoc.data()?.isAdmin === true) {
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
 * Run this once per admin via a secure script to optimize subsequent checks
 */
export async function grantAdminRole(email: string): Promise<void> {
  try {
    const user = await adminAuth.getUserByEmail(email);
    if (user.customClaims && user.customClaims.admin === true) {
      return;
    }
    await adminAuth.setCustomUserClaims(user.uid, { admin: true });
    
    // Also sync the database flag for consistency
    await adminDb.collection('newMemberCollection').doc(user.uid).set({ isAdmin: true }, { merge: true });
    
    console.log(`Granted admin role to ${email}`);
  } catch (error) {
    console.error('Error granting admin role:', error);
  }
}