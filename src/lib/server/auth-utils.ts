import { auth, currentUser } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Checks if the current authenticated user is an admin.
 * Returns the Clerk user ID if admin, otherwise throws or returns null.
 */
export async function checkAdmin() {
  const { userId, sessionClaims } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized: No session found');
  }

  // 1. Check Clerk session claims or metadata first (Fastest)
  const isAdminInMetadata = (sessionClaims?.metadata as any)?.isAdmin === true || 
                            (sessionClaims as any)?.isAdmin === true;
  
  if (isAdminInMetadata) {
    return userId;
  }

  // 2. Fallback: Check Clerk user metadata directly
  const clerkUser = await currentUser();
  if (clerkUser?.publicMetadata?.isAdmin === true) {
    return userId;
  }

  // 3. Fallback: Check Firestore document
  if (!adminDb) {
    console.error('[AuthUtils] adminDb not initialized');
    throw new Error('Internal Server Error: Database connection failed');
  }

  // Try Clerk ID first
  let userDoc = await adminDb.collection('newMemberCollection').doc(userId).get();
  
  // If not found by Clerk ID, check if there's a firestoreId in metadata
  if (!userDoc.exists && clerkUser?.publicMetadata?.firestoreId) {
    const firestoreId = clerkUser.publicMetadata.firestoreId as string;
    userDoc = await adminDb.collection('newMemberCollection').doc(firestoreId).get();
  }
  
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
