import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="border-none bg-accent px-4 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white">
            Digital Edition
          </Badge>
          <h1 className="mt-6 font-serif text-4xl font-medium sm:text-5xl">
            Edition Not Found
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-zinc-400">
            This edition hasn&apos;t been published yet. Run the PDF import script first.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild className="rounded-none bg-white text-[#050505] hover:bg-accent hover:text-white">
              <Link href="/new-edition">Back To Editions</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return <MagazineShell edition={edition} />;
}
