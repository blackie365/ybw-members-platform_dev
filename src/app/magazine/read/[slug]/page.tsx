import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import MagazineShell from '@/features/magazine/components/MagazineShell';
import MagazineReaderSkeleton from '@/components/magazine/MagazineReaderSkeleton';
import { getReaderEditionBySlug } from '@/features/magazine/server/simple-reader';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';
import { deriveIssueSlug } from '@/features/magazine/domain/builder-to-reader';

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const issues = await getMagazineIssuesServer();
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
  const edition = await getReaderEditionBySlug(slug);
  return {
    title: edition ? `${edition.title} | Yorkshire BusinessWoman` : 'Digital Edition',
    description: edition?.description || 'Read the latest edition of Yorkshire BusinessWoman magazine.',
  };
}

export default async function MagazineReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const edition = await getReaderEditionBySlug(slug);

  if (!edition) {
    redirect('/new-edition');
  }

  return (
    <Suspense fallback={<MagazineReaderSkeleton />}>
      <MagazineShell edition={edition} editionSlug={slug} />
    </Suspense>
  );
}
