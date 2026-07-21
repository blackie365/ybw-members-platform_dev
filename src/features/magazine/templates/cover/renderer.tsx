import type { Edition, FlatplanPage } from '../../domain/types';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';

interface CoverTemplateProps {
  edition: Edition;
  page: FlatplanPage;
  viewModel: Record<string, unknown>;
}

export default function CoverTemplate({ edition, page, viewModel }: CoverTemplateProps) {
  const title = typeof viewModel.title === 'string' ? viewModel.title : edition.title;
  const standfirst =
    typeof viewModel.standfirst === 'string' ? viewModel.standfirst : edition.description || edition.subtitle || '';
  const coverImage =
    typeof viewModel.coverImage === 'string' ? viewModel.coverImage : edition.coverImage;
  const safeCoverImage = coverImage ? fixMagazineImageUrl(coverImage) : '';
  const publishLabel = new Date(edition.publishDate).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const issueDescriptor = edition.subtitle || edition.description || 'A premium digital issue assembled from the live edition source.';

  return (
    <section className="relative isolate overflow-hidden bg-[#050505] text-white">
      {safeCoverImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={safeCoverImage} alt={title} className="absolute inset-0 h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(163,65,58,0.16),transparent_28%)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-[#050505]/24" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/30" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(163,65,58,0.16),transparent_28%)]" />
      )}

      <div className="absolute left-0 top-0 bottom-0 z-10 w-1 bg-gradient-to-b from-transparent via-[#A3413A] to-transparent" />
      <div className="grain-overlay absolute inset-0 z-[1]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:26px_26px] opacity-[0.16]" />
      <div className="blob-primary absolute left-[12%] top-[12%] h-[24rem] w-[24rem]" />
      <div className="blob-accent absolute bottom-[8%] right-[10%] h-[22rem] w-[22rem]" />

      <div className="relative z-10 grid min-h-[84vh] gap-10 px-6 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:py-14">
        <div className="flex flex-col justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A3413A]" />
              <span className="text-[10px] uppercase tracking-[0.26em] text-white/75">{publishLabel || 'Digital Edition'}</span>
            </div>

            <div className="mt-8">
              <p className="text-hero-display font-serif font-medium leading-none tracking-tight text-white">
                Yorkshire
                <br />
                <span className="cover-gold-shimmer">Business</span>
                <br />
                Woman
              </p>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#C9956A]">Lead Story</p>
                <h1 className="mt-4 max-w-3xl font-serif text-feature-xl font-medium text-white">{title}</h1>
                {standfirst ? (
                  <div className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur-md">
                    <p className="text-base leading-relaxed text-zinc-200 lg:text-lg">{standfirst}</p>
                  </div>
                ) : null}
              </div>
              <div className="border-l border-white/10 pl-5 text-right">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Issue</p>
                <p className="mt-3 font-serif text-xl text-white/90">{publishLabel}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-6 lg:mt-0">
            <div className="grid max-w-2xl gap-4 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#C9956A]">Edition Note</p>
                <p className="mt-3 font-serif text-2xl text-white">{edition.isLive ? 'Now Reading' : 'Preview Copy'}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  {issueDescriptor}
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#C9956A]">Issue Marker</p>
                <p className="mt-3 font-serif text-2xl text-white">{publishLabel}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Editorial cover, lead story, and premium page sequence.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs uppercase tracking-[0.28em] text-white/40">
              <span>Page {String(page.position).padStart(2, '0')}</span>
              <span>{edition.themeVariant.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-x-12 bottom-10 top-12 rounded-[2rem] bg-[#A3413A]/18 blur-[90px]" />
          <div className="cover-shimmer-sweep relative aspect-[3/4] w-full max-w-[460px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
            {safeCoverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={safeCoverImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/10 to-white/5" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
              Cover Story
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="rounded-[1.4rem] border border-white/10 bg-black/35 p-5 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#C9956A]">Inside This Edition</p>
                <p className="mt-3 font-serif text-2xl leading-tight text-white">{title}</p>
                {standfirst ? (
                  <p className="mt-3 text-sm leading-relaxed text-white/70">{standfirst}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
