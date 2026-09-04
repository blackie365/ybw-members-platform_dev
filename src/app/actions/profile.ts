'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getMemberStore } from '@/features/members/server';
import { validateUserOrAdmin } from '@/lib/server/auth-utils';
import { addGhostMember } from '@/lib/ghost-admin';
import Stripe from 'stripe';
import { isPaidSignal, ensureWelcomeEmailForMember } from '@/lib/member-notifications';
import slugify from '@sindresorhus/slugify';

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

function applyAllowlistAdminOverride(
  data: Record<string, unknown> | null | undefined,
  email: string
): Record<string, unknown> | null | undefined {
  if (!data) return data;
  const emailLower = (email || '').toLowerCase();
  const allowed = getAllowedAdminEmails();
  if (emailLower && allowed.includes(emailLower)) {
    const roleVal = data.role;
    const isAdminVal = data.isAdmin;
    const alreadyAdmin =
      (typeof roleVal === 'string' &&
        (roleVal === 'admin' || roleVal === 'super_admin')) ||
      isAdminVal === true;
    if (!alreadyAdmin) {
      return {
        ...data,
        isAdmin: true,
        role: typeof roleVal === 'string' && roleVal !== 'member' ? roleVal : 'admin',
      } as Record<string, unknown>;
    }
  }
  return data;
}

export async function getProfile(uid: string) {
  try {
    if (!uid) throw new Error('User ID is required');

    // Security Check: Only the user or an admin can fetch the detailed profile
    await validateUserOrAdmin(uid);

    const store = getMemberStore();
    let data = await store.getMemberByClerkId(uid);

    if (!data) {
      const clerkUser = await currentUser();
      const email =
        clerkUser?.primaryEmailAddress?.emailAddress ||
        clerkUser?.emailAddresses?.[0]?.emailAddress ||
        '';

      if (email) {
        const nowIso = new Date().toISOString();
        const emailLower = email.toLowerCase();
        const allowed = getAllowedAdminEmails();
        const allowlisted = emailLower && allowed.includes(emailLower);

        const firstName = clerkUser?.firstName || '';
        const lastName = clerkUser?.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const memberSlug = slugify(fullName || email.split('@')[0]);
        const avatarUrl = clerkUser?.imageUrl || '';

        // Existing profile by email? Merge its persisted fields under the Clerk id.
        const existing = await store.getMemberByEmail(email);

        await store.upsert({
          clerkId: uid,
          profile: {
            ...(existing || {}),
            firstName,
            lastName,
            displayName: fullName,
            email,
            emailLower,
            memberSlug: (existing && (existing as any).memberSlug) || memberSlug,
            avatarUrl: (existing && (existing as any).avatarUrl) || avatarUrl,
            profileImage: (existing && (existing as any).profileImage) || avatarUrl,
            updatedAt: nowIso,
            status: (existing && (existing as any).status) || 'active',
            ...(!existing
              ? {
                  membershipTier: 'free',
                  role: allowlisted ? 'admin' : 'member',
                  isAdmin: allowlisted ? true : false,
                  isFeatured: false,
                  createdAt: nowIso,
                }
              : {}),
          },
        });

        data = await store.getMemberByClerkId(uid);
      }
    }

    if (data) {
      const profileData = { ...data, clerkId: data.clerkId };
      const email = (profileData.email as string) || '';
      const overridden = applyAllowlistAdminOverride(profileData as Record<string, unknown>, email);

      // Sanitize the data to remove any timestamp-like values before sending to the client
      const sanitizedData = JSON.parse(JSON.stringify(overridden, (_key, value) => {
        if (value && typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
          return new Date(value._seconds * 1000).toISOString();
        }
        return value;
      }));

      return { success: true, data: sanitizedData, id: data.clerkId };
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.error('Error fetching profile from member store:', error);
    return { success: false, error: error.message || 'Failed to fetch profile' };
  }
}

function paidTierFromInterval(interval: string | undefined): 'paid_monthly' | 'paid_annual' {
  return interval === 'year' ? 'paid_annual' : 'paid_monthly';
}

export async function reconcilePostCheckout(uid: string) {
  try {
    if (!uid) throw new Error('User ID is required');

    await validateUserOrAdmin(uid);

    const store = getMemberStore();
    let member = await store.getMemberByClerkId(uid);
    if (!member) return { success: true, updated: false };

    const data = (member as Record<string, unknown>) || {};
    const nowIso = new Date().toISOString();
    const email = typeof data.email === 'string' ? data.email : '';
    const firstName = typeof data.firstName === 'string' ? data.firstName : '';
    const lastName = typeof data.lastName === 'string' ? data.lastName : '';
    const displayName =
      typeof data.displayName === 'string'
        ? data.displayName
        : `${firstName} ${lastName}`.trim();

    // Self-heal: if the member looks free but has a Stripe customer/subscription,
    // promote them. Throttled so routine free-member dashboard visits don't hit
    // the Stripe API every time.
    if (!isPaidSignal(data) && email && process.env.STRIPE_SECRET_KEY) {
      const lastAttempt =
        typeof data.lastReconcileAttemptAt === 'string'
          ? Date.parse(data.lastReconcileAttemptAt)
          : 0;

      if (Date.now() - lastAttempt > 5 * 60 * 1000) {
        await store.patch(uid, { lastReconcileAttemptAt: nowIso });

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2023-10-16' as any,
        });

        const customers = await stripe.customers.list({ email, limit: 3 });
        const customer = customers.data[0];

        if (customer?.id) {
          const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10 });
          const preferred = subs.data.find((s) => s.status === 'active') || subs.data.find((s) => s.status === 'trialing') || subs.data.find((s) => s.status === 'past_due');

          if (preferred) {
            const interval = preferred.items.data[0]?.plan?.interval;
            const tier = paidTierFromInterval(interval);
            await store.patch(uid, {
              status: 'active',
              isActive: true,
              membershipTier: tier,
              billingInterval: interval === 'year' ? 'year' : 'month',
              stripeCustomerId: customer.id,
              subscriptionId: preferred.id,
              lastPaymentDate: nowIso,
              userInactive: false,
              updatedAt: nowIso,
            });
          }
        }
      }
    }

    const refreshed = (await store.getMemberByClerkId(uid)) || {};
    const paid = isPaidSignal(refreshed);

    if (paid && email) {
      if (!(refreshed as any).ghostSyncedAt && !(refreshed as any).ghostSyncAttemptedAt) {
        await store.patch(uid, { ghostSyncAttemptedAt: nowIso });
        try {
          const ghostRes = await addGhostMember({
            email,
            name: displayName || undefined,
            labels: ['platform-paid', 'paid-member', String((refreshed as any).membershipTier || 'paid')],
          });
          if (ghostRes) {
            await store.patch(uid, { ghostSyncedAt: nowIso });
          }
        } catch (ghostErr) {
          console.warn('Ghost sync failed (non-critical):', ghostErr);
        }
      }
    }

    // Send the appropriate welcome email (premium or free) exactly once, decided by
    // the member's final paid state. Atomically claimed so it cannot race the
    // Stripe webhook into sending two premium welcomes.
    await ensureWelcomeEmailForMember(refreshed as any);

    return { success: true, updated: paid };
  } catch (error: any) {
    console.error('Error reconciling post-checkout:', error);
    return { success: false, error: error.message || 'Failed to reconcile post-checkout' };
  }
}

export async function updateProfile(uid: string, email: string, profileData: any) {
  try {
    if (!uid) throw new Error('User ID is required');

    // Security Check: Ensure only the owner or an admin can update this profile
    await validateUserOrAdmin(uid);

    const store = getMemberStore();
    await store.patch(uid, { ...profileData, email, updatedAt: new Date().toISOString() });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating profile from member store:', error);
    return { success: false, error: error.message || 'Failed to update profile' };
  }
}
