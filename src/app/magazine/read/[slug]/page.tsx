import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import MagazineShell from '@/features/magazine/components/MagazineShell';
import MagazineReaderSkeleton from '@/components/magazine/MagazineReaderSkeleton';
import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import { deriveIssueSlug } from '@/features/magazine/domain/builder-to-reader';
import type { ReaderEdition } from '@/features/magazine/domain/types';
import type { MagazineAdRecord } from '@/features/magazine/domain/magazine-ads';

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const store = getMagazineReadStore();
    const issues = await store.getMagazineIssues();
    const slugs = new Set<string>();
    for (const issue of issues) {
      const slug = deriveIssueSlug({
        id: String(issue.id || ''),
        title: String(issue.title || ''),
        ghostSyncTag: String((issue as any).ghostSyncTag || ''),
        readerEditionSlug: String((issue as any).readerEditionSlug || ''),
        slug: String((issue as any).slug || ''),
      }).trim().toLowerCase();
      if (slug) slugs.add(slug);
      const idSlug = `issue-${String(issue.id || '').toLowerCase()}`;
      slugs.add(idSlug);
    }
    return Array.from(slugs).map((slug) => ({ slug }));
  } catch (e) {
    console.warn('[magazine/read generateStaticParams] failed:', e);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const edition = await getMagazineReadStore().getReaderEditionBySlug(slug);
  return {
    title: edition ? `${edition.title} | Yorkshire BusinessWoman` : 'Digital Edition',
    description: edition?.description || 'Read the latest edition of Yorkshire BusinessWoman magazine.',
  };
}

export default async function MagazineReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = getMagazineReadStore();
  const edition = await store.getReaderEditionBySlug(slug);

  if (!edition) {
    redirect('/new-edition');
  }

  // Fill newspaper-spread ad slots from the Postgres magazine_ads catalog.
  // Explicit per-page `content.ads` / `content.adSlots` still win; default
  // rolls unlock a single slot on quote-rail spreads when ads are enabled.
  const catalog = await store.listMagazineAds().catch(() => [] as MagazineAdRecord[]);
  const patchedEdition = catalog.length
    ? (await import('@/features/magazine/domain/magazine-ads')).applyMagazineAdsToEdition(
        edition,
        catalog,
      )
    : edition;

  return (
    <Suspense fallback={<MagazineReaderSkeleton />}>
      <MagazineShell edition={(patchedEdition as ReaderEdition) ?? edition} editionSlug={slug} />
    </Suspense>
  );
}
