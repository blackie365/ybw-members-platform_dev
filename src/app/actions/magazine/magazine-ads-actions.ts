'use server';

import { adminDb, adminDbInit } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';
import {
  MagazineAdRecord,
  normalizeMagazineAdRecord,
  sortMagazineAds,
} from '@/features/magazine/domain/magazine-ads';
import { safeRevalidatePath, safeRevalidateTag } from './_helpers';

export async function getMagazineAdsAction(): Promise<
  { success: true; data: MagazineAdRecord[] } | { success: false; error: string }
> {
  try {
    await checkAdmin();
    const { getMagazineReadStore } = await import('@/features/magazine/server/read-store');
    const ads = await getMagazineReadStore().listMagazineAds();
    return { success: true, data: ads };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load magazine ads' };
  }
}

export async function saveMagazineAdsAction(
  ads: MagazineAdRecord[],
): Promise<{ success: true; data: MagazineAdRecord[] } | { success: false; error: string }> {
  try {
    await checkAdmin();
    const normalized = (Array.isArray(ads) ? ads : [])
      .map(normalizeMagazineAdRecord)
      .filter((ad): ad is MagazineAdRecord => ad !== null)
      .map((ad, i) => ({ ...ad, position: typeof ad.position === 'number' ? ad.position : i }));

    const { getMagazineWriteStore } = await import('@/features/magazine/server/write-store');
    await getMagazineWriteStore().upsertMagazineAds(normalized);

    safeRevalidatePath('/admin/magazine');
    safeRevalidateTag('magazine-ads');
    return { success: true, data: sortMagazineAds(normalized) };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to save magazine ads' };
  }
}

/**
 * Pull enabled ad slots from the Firestore `system/ads` config (the site-wide
 * Ads tab) into the Postgres magazine ad catalog. This is the "use the ads
 * you've already set up" import — the Quilter Cheviot headerLeaderboard lands
 * in the reader with one click.
 */
export async function importSiteAdsToMagazineAction(): Promise<
  { success: true; data: MagazineAdRecord[] } | { success: false; error: string }
> {
  try {
    await checkAdmin();
    if (!adminDb) {
      throw new Error(adminDbInit?.error ? `Database not initialized: ${adminDbInit.error}` : 'Database not initialized');
    }

    const doc = await adminDb.collection('system').doc('ads').get();
    const data = (doc.exists ? (doc.data() as any) : {}) || {};
    const slots: Array<{ slot: string; cfg: any }> = (['headerLeaderboard', 'sidebarMpu', 'midArticle'] as const)
      .map((slot) => ({ slot, cfg: data?.[slot] }))
      .filter(({ cfg }) => cfg && typeof cfg === 'object');

    const imported: MagazineAdRecord[] = [];
    for (let i = 0; i < slots.length; i += 1) {
      const { slot, cfg } = slots[i];
      const image = String(cfg.imageUrl || '').trim();
      if (!image) continue; // slot enabled but no creative configured
      imported.push({
        id: `slot:${slot}`,
        label: String(cfg.altText || '').trim() || 'Advertisement',
        image,
        url: String(cfg.linkUrl || '').trim(),
        alt: String(cfg.altText || '').trim() || 'Advertisement',
        enabled: cfg.enabled === true,
        position: i,
      });
    }

    if (imported.length === 0) {
      return { success: false, error: 'No enabled ad slots with creative found in the site Ads config.' };
    }

    const { getMagazineWriteStore } = await import('@/features/magazine/server/write-store');
    await getMagazineWriteStore().upsertMagazineAds(imported);

    safeRevalidatePath('/admin/magazine');
    safeRevalidateTag('magazine-ads');
    return { success: true, data: sortMagazineAds(imported) };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to import site ads' };
  }
}