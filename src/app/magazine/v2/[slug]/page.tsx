import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTemplateRegistryEntry } from '@/features/magazine/domain/template-registry';
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

  const { edition, pages, stories } = readerData;
  const currentPreviewIsLatest = latestPreview?.edition.id === edition.id;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="rounded-none text-white hover:bg-white/5 hover:text-white">
              <Link href="/new-edition">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back To New Edition
              </Link>
            </Button>
            <div className="hidden h-6 w-px bg-white/10 md:block" />
            <div className="hidden md:block">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Premium Digital Reader</p>
              <h1 className="font-serif text-lg">{edition.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {edition.issuu.shareUrl ? (
              <Button
                asChild
                variant="outline"
                className="rounded-none border-white/15 bg-transparent text-white hover:bg-white hover:text-[#050505]"
              >
                <a href={edition.issuu.shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Issuu
                </a>
              </Button>
            ) : null}
            <Badge className="border-none bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
              {edition.isLive ? 'Live In Premium Reader' : 'Preview'}
            </Badge>
          </div>
        </div>
      </div>

      {!currentPreviewIsLatest && latestPreview ? (
        <section className="border-b border-white/10 bg-[#120d0b]">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Latest Available Preview</p>
              <p className="mt-1 text-sm text-white/70">
                The newest assembled reader is currently <span className="font-medium text-white">{latestPreview.edition.title}</span>.
              </p>
            </div>
            <Button asChild className="rounded-none bg-white text-[#050505] hover:bg-accent hover:text-white">
              <Link href={`/magazine/v2/${latestPreview.edition.slug}`}>
                Open Latest Preview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="space-y-10 pb-16">
        {pages.map((page) => {
          const entry = getTemplateRegistryEntry(page.templateFamily, page.templateVariant);

          if (!entry) {
            return (
              <section key={page.id} className="mx-auto max-w-6xl px-6 py-16">
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Missing Template</p>
                  <h2 className="mt-4 font-serif text-3xl">Page {page.position}</h2>
                  <p className="mt-4 text-white/60">
                    `{page.templateFamily}/{page.templateVariant}` does not have a public renderer yet.
                  </p>
                </div>
              </section>
            );
          }

          const viewModel = entry.buildViewModel({
            edition,
            page,
            slots: page.slots,
            stories,
            assets: [],
          });

          const Renderer = entry.render;

          return (
            <div key={page.id} className="border-b border-white/5 last:border-b-0">
              <Renderer edition={edition} page={page} viewModel={viewModel} />
            </div>
          );
        })}
      </div>
    </main>
  );
}
