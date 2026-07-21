import type { Edition, FlatplanPage } from '../../domain/types';

interface BackCoverTemplateProps {
  edition: Edition;
  page: FlatplanPage;
  viewModel: Record<string, unknown>;
}

export default function BackCoverTemplate({ edition, page, viewModel }: BackCoverTemplateProps) {
  const eyebrow = typeof viewModel.eyebrow === 'string' ? viewModel.eyebrow : 'Back Cover';
  const title = typeof viewModel.title === 'string' ? viewModel.title : edition.title;
  const body = typeof viewModel.body === 'string' ? viewModel.body : edition.description || '';
  const imageSrc = typeof viewModel.imageSrc === 'string' ? viewModel.imageSrc : '';
  const ctaLabel = typeof viewModel.ctaLabel === 'string' ? viewModel.ctaLabel : '';
  const ctaHref = typeof viewModel.ctaHref === 'string' ? viewModel.ctaHref : '';

  return (
    <section className="relative min-h-[84vh] overflow-hidden bg-[#11100f] text-white">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={title} className="absolute inset-0 h-full w-full object-cover opacity-40" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/55 to-black/75" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(163,65,58,0.18),transparent_28%)]" />

      <div className="relative mx-auto grid min-h-[84vh] max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9956A]">{eyebrow}</p>
            <h2 className="mt-6 max-w-3xl font-serif text-5xl font-medium leading-[0.95] lg:text-7xl">{title}</h2>
            {body ? <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-zinc-200">{body}</p> : null}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs uppercase tracking-[0.28em] text-white/45">
            <span>Page {String(page.position).padStart(2, '0')}</span>
            <span>{edition.title}</span>
          </div>
        </div>

        <div className="flex items-end justify-end">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-[0.26em] text-[#C9956A]">Next Step</p>
            <p className="mt-4 font-serif text-2xl leading-tight text-white">
              The close of the issue should feel as considered as the opening spread.
            </p>
            {ctaLabel && ctaHref ? (
              <div className="mt-8">
                <a
                  href={ctaHref}
                  className="inline-flex items-center border border-white/20 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-[#11100f]"
                >
                  {ctaLabel}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
