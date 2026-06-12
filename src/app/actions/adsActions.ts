'use server';

import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';

type HeaderLeaderboardAdItem = {
  id: string;
  enabled?: boolean;
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
  weight?: number;
  startAt?: string;
  endAt?: string;
};

type HeaderLeaderboardRotation = {
  enabled?: boolean;
  intervalSeconds?: number;
  items?: HeaderLeaderboardAdItem[];
};

type HeaderLeaderboardAd = {
  enabled?: boolean;
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
  rotation?: HeaderLeaderboardRotation;
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

    const sanitizeRotation = (rotation?: HeaderLeaderboardRotation): HeaderLeaderboardRotation | undefined => {
      if (!rotation) return undefined;

      const intervalSecondsRaw = typeof rotation.intervalSeconds === 'number' ? rotation.intervalSeconds : 30;
      const intervalSeconds = Math.min(3600, Math.max(5, Math.floor(intervalSecondsRaw || 30)));

      const items = (rotation.items || [])
        .filter((item): item is HeaderLeaderboardAdItem => Boolean(item && item.id))
        .map((item) => ({
          id: String(item.id),
          enabled: item.enabled !== false,
          imageUrl: item.imageUrl || '',
          linkUrl: item.linkUrl || '',
          altText: item.altText || '',
          weight: typeof item.weight === 'number' ? item.weight : undefined,
          startAt: item.startAt || '',
          endAt: item.endAt || '',
        }));

      return {
        enabled: rotation.enabled === true,
        intervalSeconds,
        items,
      };
    };

    const payload: HeaderLeaderboardAd = {
      enabled: input.enabled !== false,
      imageUrl: input.imageUrl || '',
      linkUrl: input.linkUrl || '',
      altText: input.altText || 'Advertisement',
      rotation: sanitizeRotation(input.rotation),
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
