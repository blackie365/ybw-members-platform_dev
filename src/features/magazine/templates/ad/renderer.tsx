import type { Edition, FlatplanPage } from '../../domain/types';

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
  const ctaLabel = typeof viewModel.ctaLabel === 'string' ? viewModel.ctaLabel : '';
  const ctaHref = typeof viewModel.ctaHref === 'string' ? viewModel.ctaHref : '';

  return (
    <section className="relative min-h-[84vh] overflow-hidden bg-[#120d0b] text-white">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={headline} className="absolute inset-0 h-full w-full object-cover opacity-35" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(163,65,58,0.18),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-[84vh] max-w-7xl flex-col justify-between px-6 py-10 lg:px-12">
        <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.26em] text-white/65">
          <span>{label}</span>
          <span>Page {String(page.position).padStart(2, '0')}</span>
        </div>

        <div className="max-w-4xl rounded-[2rem] border border-white/10 bg-black/35 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-md lg:p-10">
          {advertiserName ? (
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#C9956A]">{advertiserName}</p>
          ) : null}
          <h2 className="mt-5 font-serif text-5xl font-medium leading-[0.95] lg:text-7xl">{headline}</h2>
          {body ? <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-zinc-200">{body}</p> : null}
          {ctaLabel && ctaHref ? (
            <div className="mt-8">
              <a
                href={ctaHref}
                className="inline-flex items-center border border-white/20 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-[#120d0b]"
              >
                {ctaLabel}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
