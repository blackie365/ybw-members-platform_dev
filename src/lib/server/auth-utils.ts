import { auth, currentUser } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

function getAllowedAdminEmails(): string[] {
  const raw =
    process.env.ALLOWED_ADMIN_EMAILS ||
    process.env.NEXT_PUBLIC_ALLOWED_ADMIN_EMAILS ||
    '';
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminField(value: unknown): boolean {
  if (typeof value === 'boolean') return value === true;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    return v === 'admin' || v === 'super_admin' || v === 'true';
  }
  return false;
}

/**
 * Checks if the current authenticated user is an admin.
 * Returns the Clerk user ID if admin, otherwise throws or returns null.
 */
export async function checkAdmin() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    console.warn('[checkAdmin] FAIL: No userId from auth() — Clerk session not detected by middleware');
    throw new Error('Unauthorized: No session found');
  }

  let userEmail: string = '';

  // 0. Env-var bootstrap allowlist (most reliable — bypasses Clerk/Firestore metadata lag)
  try {
    const clerkUser = await currentUser();
    userEmail =
      clerkUser?.primaryEmailAddress?.emailAddress ||
      clerkUser?.emailAddresses?.[0]?.emailAddress ||
      '';
    const emailLower = userEmail.toLowerCase();
    const allowed = getAllowedAdminEmails();
    if (emailLower && allowed.includes(emailLower)) {
      console.info(`[checkAdmin] PASS layer=env-allowlist email=${emailLower}`);
      return userId;
    }
  } catch (err) {
    console.warn('[checkAdmin] Env allowlist check error:', err);
  }

  // 1. Check Clerk session claims / JWT metadata (fastest — no external call)
  const metadata = sessionClaims?.metadata as Record<string, unknown> | undefined;
  const inSession =
    isAdminField(metadata?.isAdmin) ||
    isAdminField(metadata?.role) ||
    isAdminField((sessionClaims as Record<string, unknown>)?.isAdmin) ||
    isAdminField((sessionClaims as Record<string, unknown>)?.role);
  if (inSession) {
    console.info(`[checkAdmin] PASS layer=session-claims uid=${userId}`);
    return userId;
  }

  // 2. Fallback: Clerk user object (publicMetadata + privateMetadata)
  let clerkUser: Awaited<ReturnType<typeof currentUser>> = null;
  try {
    clerkUser = await currentUser();
    const publicMeta = clerkUser?.publicMetadata as Record<string, unknown> | undefined;
    const privateMeta = (clerkUser as { privateMetadata?: Record<string, unknown> } | null)
      ?.privateMetadata;
    const inPublic =
      isAdminField(publicMeta?.isAdmin) ||
      isAdminField(publicMeta?.role);
    const inPrivate =
      isAdminField(privateMeta?.isAdmin) ||
      isAdminField(privateMeta?.role);
    if (!userEmail) {
      userEmail =
        clerkUser?.primaryEmailAddress?.emailAddress ||
        clerkUser?.emailAddresses?.[0]?.emailAddress ||
        '';
    }
    if (inPublic || inPrivate) {
      console.info(
        `[checkAdmin] PASS layer=clerk-metadata uid=${userId} inPublic=${inPublic} inPrivate=${inPrivate} email=${userEmail}`
      );
      return userId;
    }
    console.info(
      `[checkAdmin] clerk-metadata miss uid=${userId} publicMeta=${JSON.stringify(publicMeta)} privateMetaPresent=${Boolean(privateMeta)}`
    );
  } catch (err) {
    console.error('[checkAdmin] Clerk currentUser() call failed:', err);
  }

  // 3. Fallback: Firestore profile
  try {
    if (adminDb) {
      if (!userEmail && clerkUser) {
        userEmail =
          clerkUser.primaryEmailAddress?.emailAddress ||
          clerkUser.emailAddresses?.[0]?.emailAddress ||
          '';
      }
      let byId = false;
      let byEmail = false;
      const doc = await adminDb.collection('newMemberCollection').doc(userId).get();
      if (doc.exists) {
        const profile = doc.data() as Record<string, unknown> | undefined;
        byId = isAdminField(profile?.isAdmin) || isAdminField(profile?.role);
      }
      if (!byId && userEmail) {
        const snap = await adminDb
          .collection('newMemberCollection')
          .where('email', '==', userEmail)
          .limit(1)
          .get();
        if (!snap.empty) {
          const profile = snap.docs[0].data() as Record<string, unknown> | undefined;
          byEmail = isAdminField(profile?.isAdmin) || isAdminField(profile?.role);
        }
      }
      if (byId || byEmail) {
        console.info(
          `[checkAdmin] PASS layer=firestore uid=${userId} byId=${byId} byEmail=${byEmail} email=${userEmail}`
        );
        return userId;
      }
      console.info(
        `[checkAdmin] firestore miss uid=${userId} docExists=${doc.exists} email=${userEmail}`
      );
    } else {
      console.warn('[checkAdmin] adminDb not initialized — skipping Firestore layer');
    }
  } catch (err) {
    console.error('[checkAdmin] Firestore layer error:', err);
  }

  console.warn(
    `[checkAdmin] ALL LAYERS FAILED uid=${userId} email=${userEmail} — redirecting to /dashboard`
  );
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
