import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Checks if the current authenticated user is an admin.
 * Returns the Clerk user ID if admin, otherwise throws or returns null.
 */
export async function checkAdmin() {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized: No session found');
  }

  if (!adminDb) {
    console.error('[AuthUtils] adminDb not initialized');
    throw new Error('Internal Server Error: Database connection failed');
  }

  const userDoc = await adminDb.collection('newMemberCollection').doc(userId).get();
  
  if (!userDoc.exists || userDoc.data()?.isAdmin !== true) {
    console.warn(`[AuthUtils] Access denied for non-admin user: ${userId}`);
    throw new Error('Forbidden: Admin access required');
  }

  return userId;
}

/**
 * Validates that the current user matches the requested UID,
 * OR is an admin.
 */
export async function validateUserOrAdmin(uid: string) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  if (userId === uid) {
    return true;
  }

  // If not the owner, check if admin
  try {
    await checkAdmin();
    return true;
  } catch (e) {
    throw new Error('Forbidden: You do not have permission to modify this resource');
  }
}
