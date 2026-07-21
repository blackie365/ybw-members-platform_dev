import type { Edition, FlatplanPage } from '../../domain/types';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';

interface AdTemplateProps {
  edition: Edition;
  page: FlatplanPage;
  viewModel: Record<string, unknown>;
}

export default function AdTemplate({ edition, page, viewModel }: AdTemplateProps) {
  const label = typeof viewModel.label === 'string' ? viewModel.label : 'Advertisement';
  const advertiserName = typeof viewModel.advertiserName === 'string' ? viewModel.advertiserName : '';
  const headline = typeof viewModel.headline === 'string' ? viewModel.headline : edition.title;
  const body = typeof viewModel.body === 'string' ? viewModel.body : '';
  const imageSrc = typeof viewModel.imageSrc === 'string' ? viewModel.imageSrc : '';
  const safeImageSrc = imageSrc ? fixMagazineImageUrl(imageSrc) : '';
  const ctaLabel = typeof viewModel.ctaLabel === 'string' ? viewModel.ctaLabel : '';
  const ctaHref = typeof viewModel.ctaHref === 'string' ? viewModel.ctaHref : '';
  const pdfSrc = typeof viewModel.pdfSrc === 'string' ? viewModel.pdfSrc : '';
  const displayLabel = advertiserName || label;

  return (
    <section className="relative min-h-[84vh] overflow-hidden bg-[#120d0b] text-white">
      {safeImageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeImageSrc} alt={headline} className="absolute inset-0 h-full w-full object-cover opacity-22" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-[#090706] via-[#120d0b]/78 to-[#120d0b]/45" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(163,65,58,0.18),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-[84vh] max-w-7xl flex-col px-6 py-10 lg:px-12">
        <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.26em] text-white/65">
          <span>{label}</span>
          <span>Page {String(page.position).padStart(2, '0')}</span>
        </div>

        <div className="grid flex-1 gap-8 py-8 lg:grid-cols-[0.52fr_1.48fr] lg:items-stretch lg:py-10">
          <div className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-black/38 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-md lg:p-10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#C9956A]">{displayLabel}</p>
              <h2 className="mt-5 font-serif text-4xl font-medium leading-[0.96] lg:text-6xl">{headline}</h2>
              {body ? <p className="mt-6 max-w-md font-serif text-lg leading-relaxed text-zinc-200">{body}</p> : null}
            </div>
            <div className="mt-8 space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-[#C9956A] to-transparent" />
                <span className="text-[10px] uppercase tracking-[0.24em] text-white/40">Partner Feature</span>
              </div>
              {ctaLabel && ctaHref ? (
                <a
                  href={ctaHref}
                  target={pdfSrc ? '_blank' : undefined}
                  rel={pdfSrc ? 'noreferrer' : undefined}
                  className="inline-flex items-center border border-white/20 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-[#120d0b]"
                >
                  {ctaLabel}
                </a>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-[28rem] overflow-hidden rounded-[2.25rem] border border-white/10 bg-black/30 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
            {safeImageSrc ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={safeImageSrc} alt={headline} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
              </>
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.20),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(163,65,58,0.20),transparent_28%)]" />
            )}
            <div className="absolute left-6 top-6 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/78 backdrop-blur-sm">
              {label}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-5 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#C9956A]">{displayLabel}</p>
                <p className="mt-3 max-w-2xl font-serif text-2xl leading-tight text-white lg:text-3xl">{headline}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
