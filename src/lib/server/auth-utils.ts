import { auth, currentUser } from '@clerk/nextjs/server';
import { getMemberStore } from '@/features/members/server';

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

  // 3. Fallback: member profile store (Postgres)
  try {
    if (!userEmail && clerkUser) {
      userEmail =
        clerkUser.primaryEmailAddress?.emailAddress ||
        clerkUser.emailAddresses?.[0]?.emailAddress ||
        '';
    }
    const store = getMemberStore();
    let byId = false;
    let byEmail = false;
    const byIdProfile = await store.getMemberByClerkId(userId);
    if (byIdProfile) {
      byId = isAdminField(byIdProfile?.isAdmin) || isAdminField(byIdProfile?.role);
    }
    if (!byId && userEmail) {
      const byEmailProfile = await store.getMemberByEmail(userEmail);
      if (byEmailProfile) {
        byEmail = isAdminField(byEmailProfile?.isAdmin) || isAdminField(byEmailProfile?.role);
      }
    }
    if (byId || byEmail) {
      console.info(
        `[checkAdmin] PASS layer=member-store uid=${userId} byId=${byId} byEmail=${byEmail} email=${userEmail}`
      );
      return userId;
    }
    console.info(
      `[checkAdmin] member-store miss uid=${userId} profileLoaded=${Boolean(byIdProfile)} email=${userEmail}`
    );
  } catch (err) {
    console.error('[checkAdmin] member-store layer error:', err);
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
