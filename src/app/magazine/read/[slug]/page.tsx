import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import MagazineShell from '@/features/magazine/components/MagazineShell';
import { getReaderEditionBySlug } from '@/features/magazine/server/simple-reader';

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

  return <MagazineShell edition={edition} />;
}
