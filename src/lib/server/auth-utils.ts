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
  const metadata = sessionClaims?.metadata as any;
  const isAdminInMetadata = metadata?.isAdmin === true || 
                            metadata?.role === 'admin' || 
                            metadata?.role === 'super_admin' ||
                            (sessionClaims as any)?.isAdmin === true;
  
  if (isAdminInMetadata) {
    return userId;
  }

  // 2. Fallback: Check Clerk user metadata directly
  const clerkUser = await currentUser();
  const publicMetadata = clerkUser?.publicMetadata as any;
  if (publicMetadata?.isAdmin === true || publicMetadata?.role === 'admin' || publicMetadata?.role === 'super_admin') {
    return userId;
  }

  // 3. Fallback: Check Firestore profile directly (Most reliable but slowest)
  try {
    if (adminDb) {
      const email =
        clerkUser?.primaryEmailAddress?.emailAddress ||
        clerkUser?.emailAddresses?.[0]?.emailAddress ||
        '';

      const doc = await adminDb.collection('newMemberCollection').doc(userId).get();
      if (doc.exists) {
        const profile = doc.data();
        if (profile?.isAdmin === true || profile?.role === 'admin' || profile?.role === 'super_admin') {
          return userId;
        }
      } else if (email) {
        const snap = await adminDb.collection('newMemberCollection').where('email', '==', email).limit(1).get();
        const profile = snap.empty ? null : snap.docs[0].data();
        if (profile?.isAdmin === true || profile?.role === 'admin' || profile?.role === 'super_admin') {
          return userId;
        }
      }      
    }
  } catch (err) {
    console.error('Error checking Firestore for admin status:', err);
  }

  throw new Error('Forbidden: Admin access required');
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
