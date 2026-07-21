import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MagazineShell from '@/features/magazine/components/MagazineShell';
import {
  getLatestMagazineV2ReaderPreview,
  getMagazineV2ReaderDataBySlug,
} from '@/features/magazine/server/public-reader';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const readerData = await getMagazineV2ReaderDataBySlug(slug);

  return {
    title: readerData ? `${readerData.edition.title} | Premium Digital Reader` : 'Premium Digital Reader',
    description:
      readerData?.edition.description ||
      'Preview the next-generation Yorkshire BusinessWoman digital reader.',
  };
}

export default async function MagazineV2ReaderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [readerData, latestPreview] = await Promise.all([
    getMagazineV2ReaderDataBySlug(slug),
    getLatestMagazineV2ReaderPreview(),
  ]);

  if (!readerData) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="border-none bg-accent px-4 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white">
            Premium Reader
          </Badge>
          <h1 className="mt-6 font-serif text-4xl font-medium sm:text-5xl">
            Reader Preview Not Ready Yet
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-zinc-400">
            This edition has not been assembled in the premium reader yet. Build or refresh the reader edition in the editorial studio first.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild className="rounded-none bg-white text-[#050505] hover:bg-accent hover:text-white">
              <Link href="/admin/magazine">
                Return To Editorial Studio
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-none border-white/15 bg-transparent text-white hover:bg-white hover:text-[#050505]"
            >
              <Link href="/new-edition">
                Back To New Edition
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const { edition, pages, stories, assets } = readerData;
  const currentPreviewIsLatest = latestPreview?.edition.id === edition.id;

  return (
    <MagazineShell
      edition={edition}
      pages={pages}
      stories={stories}
      assets={assets}
      latestPreview={
        !currentPreviewIsLatest && latestPreview
          ? {
              href: `/magazine/v2/${latestPreview.edition.slug}`,
              title: latestPreview.edition.title,
            }
          : null
      }
    />
  );
}
