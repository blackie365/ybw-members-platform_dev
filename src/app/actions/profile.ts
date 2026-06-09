'use server';

import { adminDb } from '@/lib/firebase-admin';
import { validateUserOrAdmin } from '@/lib/server/auth-utils';
import { addGhostMember } from '@/lib/ghost-admin';
import { sendEmail } from '@/lib/email';
import Stripe from 'stripe';
import { getWelcomeEmailTemplate } from '@/lib/email-templates';

export async function getProfile(uid: string) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is missing from the environment variables (e.g. Vercel).');
    }
    if (!uid) throw new Error('User ID is required');

    // Security Check: Only the user or an admin can fetch the detailed profile
    await validateUserOrAdmin(uid);
    
    if (!adminDb) throw new Error('Database not initialized');
    const docRef = adminDb.collection('newMemberCollection').doc(uid);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      
      // Sanitize the data to remove any Timestamps before sending to the client
      const sanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
          return new Date(value._seconds * 1000).toISOString();
        }
        return value;
      }));
      
      return { success: true, data: sanitizedData, id: docSnap.id };
    }
    
    return { success: true, data: null };
  } catch (error: any) {
    console.error('Error fetching profile from admin SDK:', error);
    return { success: false, error: error.message || 'Failed to fetch profile' };
  }
}

function isPaidSignal(data: any): boolean {
  const tier = typeof data?.membershipTier === 'string' ? data.membershipTier : 'free';
  if (tier !== 'free') return true;
  return Boolean(data?.stripeCustomerId || data?.subscriptionId || data?.stripeSubscriptionId);
}

function paidTierFromInterval(interval: string | undefined): 'paid_monthly' | 'paid_annual' {
  return interval === 'year' ? 'paid_annual' : 'paid_monthly';
}

export async function reconcilePostCheckout(uid: string) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is missing from the environment variables (e.g. Vercel).');
    }
    if (!uid) throw new Error('User ID is required');

    await validateUserOrAdmin(uid);

    if (!adminDb) throw new Error('Database not initialized');
    const docRef = adminDb.collection('newMemberCollection').doc(uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return { success: true, updated: false };

    const data = docSnap.data() || {};
    const nowIso = new Date().toISOString();
    const email = typeof (data as any).email === 'string' ? (data as any).email : '';
    const firstName = typeof (data as any).firstName === 'string' ? (data as any).firstName : '';
    const lastName = typeof (data as any).lastName === 'string' ? (data as any).lastName : '';
    const displayName = typeof (data as any).displayName === 'string' ? (data as any).displayName : `${firstName} ${lastName}`.trim();

    if (!isPaidSignal(data) && email && process.env.STRIPE_SECRET_KEY) {
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
          await docRef.set(
            {
              status: 'active',
              membershipTier: tier,
              billingInterval: interval === 'year' ? 'year' : 'month',
              stripeCustomerId: customer.id,
              subscriptionId: preferred.id,
              lastPaymentDate: nowIso,
              userInactive: false,
              isNewsletterAuthorized: true,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      }
    }

    const refreshedSnap = await docRef.get();
    const refreshed = refreshedSnap.data() || {};
    const paid = isPaidSignal(refreshed);

    if (!paid || !email) return { success: true, updated: false };

    if (!(refreshed as any).ghostSyncedAt && !(refreshed as any).ghostSyncAttemptedAt) {
      await docRef.set({ ghostSyncAttemptedAt: nowIso }, { merge: true });
      try {
        const ghostRes = await addGhostMember({
          email,
          name: displayName || undefined,
          labels: ['platform-paid', 'paid-member', String((refreshed as any).membershipTier || 'paid')],
        });
        if (ghostRes) {
          await docRef.set({ ghostSyncedAt: nowIso }, { merge: true });
        }
      } catch (ghostErr) {
        console.warn('Ghost sync failed (non-critical):', ghostErr);
      }
    }

    if (!(refreshed as any).premiumWelcomeEmailSentAt && !(refreshed as any).premiumWelcomeEmailAttemptedAt) {
      await docRef.set({ premiumWelcomeEmailAttemptedAt: nowIso }, { merge: true });
      await sendEmail({
        to: email,
        subject: 'Welcome to Yorkshire Businesswoman!',
        html: await getWelcomeEmailTemplate(firstName || 'there', process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk'),
      });
      await docRef.set({ premiumWelcomeEmailSentAt: nowIso }, { merge: true });
    }

    return { success: true, updated: true };
  } catch (error: any) {
    console.error('Error reconciling post-checkout:', error);
    return { success: false, error: error.message || 'Failed to reconcile post-checkout' };
  }
}

export async function updateProfile(uid: string, email: string, profileData: any) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is missing from the environment variables (e.g. Vercel).');
    }
    if (!uid) throw new Error('User ID is required');

    // Security Check: Ensure only the owner or an admin can update this profile
    await validateUserOrAdmin(uid);
    
    if (!adminDb) throw new Error('Database not initialized');
    const docRef = adminDb.collection('newMemberCollection').doc(uid);
    
    await docRef.set({
      ...profileData,
      email: email,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating profile from admin SDK:', error);
    return { success: false, error: error.message || 'Failed to update profile' };
  }
}
