'use server';

import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';

type HeaderLeaderboardAd = {
  enabled?: boolean;
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
  updatedAt?: string;
};

type AdsConfig = {
  headerLeaderboard?: HeaderLeaderboardAd;
};

export async function getAdsConfigAction(): Promise<{ success: true; data: AdsConfig } | { success: false; error: string }> {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Database not initialized');

    const doc = await adminDb.collection('system').doc('ads').get();
    const data = (doc.exists ? (doc.data() as any) : {}) || {};

    return {
      success: true,
      data: {
        headerLeaderboard: data.headerLeaderboard || {},
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load ads config' };
  }
}

export async function updateHeaderLeaderboardAdAction(input: HeaderLeaderboardAd): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Database not initialized');

    const payload: HeaderLeaderboardAd = {
      enabled: input.enabled !== false,
      imageUrl: input.imageUrl || '',
      linkUrl: input.linkUrl || '',
      altText: input.altText || 'Advertisement',
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('system').doc('ads').set(
      {
        headerLeaderboard: payload,
      },
      { merge: true }
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update header ad' };
  }
}

