'use server';

import { adminDb, adminDbInit } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';

type AdItem = {
  id: string;
  enabled?: boolean;
  imageUrl?: string;
  iframeUrl?: string;
  linkUrl?: string;
  altText?: string;
  weight?: number;
  startAt?: string;
  endAt?: string;
};

type AdRotation = {
  enabled?: boolean;
  intervalSeconds?: number;
  items?: AdItem[];
};

type AdSlotConfig = {
  enabled?: boolean;
  imageUrl?: string;
  iframeUrl?: string;
  linkUrl?: string;
  altText?: string;
  rotation?: AdRotation;
  updatedAt?: string;
};

type AdsConfig = {
  headerLeaderboard?: AdSlotConfig;
  sidebarMpu?: AdSlotConfig;
  midArticle?: AdSlotConfig;
};

function sanitizeRotation(rotation?: AdRotation): AdRotation | undefined {
  if (!rotation) return undefined;

  const intervalSecondsRaw = typeof rotation.intervalSeconds === 'number' ? rotation.intervalSeconds : 30;
  const intervalSeconds = Math.min(3600, Math.max(5, Math.floor(intervalSecondsRaw || 30)));

  const items = (rotation.items || [])
    .filter((item): item is AdItem => Boolean(item && item.id))
    .map((item) => {
      const sanitized: AdItem = {
        id: String(item.id),
        enabled: item.enabled !== false,
        imageUrl: item.imageUrl || '',
        iframeUrl: (item as any).iframeUrl || '',
        linkUrl: item.linkUrl || '',
        altText: item.altText || '',
      };

      if (typeof item.weight === 'number') sanitized.weight = item.weight;
      if (item.startAt) sanitized.startAt = item.startAt;
      if (item.endAt) sanitized.endAt = item.endAt;

      return sanitized;
    });

  return {
    enabled: rotation.enabled === true,
    intervalSeconds,
    items,
  };
}

export async function getAdsConfigAction(): Promise<{ success: true; data: AdsConfig } | { success: false; error: string }> {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error(adminDbInit?.error ? `Database not initialized: ${adminDbInit.error}` : 'Database not initialized');

    const doc = await adminDb.collection('system').doc('ads').get();
    const data = (doc.exists ? (doc.data() as any) : {}) || {};

    return {
      success: true,
      data: {
        headerLeaderboard: data.headerLeaderboard || {},
        sidebarMpu: data.sidebarMpu || {},
        midArticle: data.midArticle || {},
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load ads config' };
  }
}

export async function updateAdSlotAction(
  slot: keyof AdsConfig,
  input: AdSlotConfig
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error(adminDbInit?.error ? `Database not initialized: ${adminDbInit.error}` : 'Database not initialized');

    const payload: AdSlotConfig = {
      enabled: input.enabled !== false,
      imageUrl: input.imageUrl || '',
      iframeUrl: (input as any).iframeUrl || '',
      linkUrl: input.linkUrl || '',
      altText: input.altText || 'Advertisement',
      rotation: sanitizeRotation(input.rotation),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('system').doc('ads').set(
      {
        [slot]: payload,
      },
      { merge: true }
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update ad config' };
  }
}

export async function updateHeaderLeaderboardAdAction(input: AdSlotConfig): Promise<{ success: true } | { success: false; error: string }> {
  return updateAdSlotAction('headerLeaderboard', input);
}

export async function updateSidebarMpuAdAction(input: AdSlotConfig): Promise<{ success: true } | { success: false; error: string }> {
  return updateAdSlotAction('sidebarMpu', input);
}

export async function updateMidArticleAdAction(input: AdSlotConfig): Promise<{ success: true } | { success: false; error: string }> {
  return updateAdSlotAction('midArticle', input);
}
