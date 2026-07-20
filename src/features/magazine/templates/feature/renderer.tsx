import type { Edition, FlatplanPage } from '../../domain/types';

interface FeatureTemplateProps {
  edition: Edition;
  page: FlatplanPage;
  viewModel: Record<string, unknown>;
}

export default function FeatureTemplate({ edition, page, viewModel }: FeatureTemplateProps) {
  const title = typeof viewModel.title === 'string' ? viewModel.title : edition.title;
  const standfirst = typeof viewModel.standfirst === 'string' ? viewModel.standfirst : '';
  const body = typeof viewModel.body === 'string' ? viewModel.body : '';
  const heroImage = typeof viewModel.heroImage === 'string' ? viewModel.heroImage : '';
  const pullQuote = typeof viewModel.pullQuote === 'string' ? viewModel.pullQuote : '';
  const pullQuoteAttribution = typeof viewModel.pullQuoteAttribution === 'string' ? viewModel.pullQuoteAttribution : '';
  const ctaLabel = typeof viewModel.ctaLabel === 'string' ? viewModel.ctaLabel : '';
  const ctaHref = typeof viewModel.ctaHref === 'string' ? viewModel.ctaHref : '';
  const galleryImages = Array.isArray(viewModel.galleryImages)
    ? (viewModel.galleryImages as Array<Record<string, unknown>>).filter(
        (item) => typeof item?.src === 'string' && Boolean(item.src),
      )
    : [];
  const mediaFirst = page.templateVariant === 'left-media';
  const fullBleed = page.templateVariant === 'full-bleed';

  if (fullBleed) {
    return (
      <section className="relative min-h-[80vh] overflow-hidden bg-[#120d0b] text-white">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt={title} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/20" />
        <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col justify-end px-6 py-10 lg:px-12">
          <p className="text-xs uppercase tracking-[0.35em] text-[#C9956A]">Feature</p>
          <h2 className="mt-5 max-w-4xl font-serif text-5xl font-medium leading-tight lg:text-7xl">{title}</h2>
          {standfirst ? <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-200">{standfirst}</p> : null}
          {pullQuote ? (
            <blockquote className="mt-8 max-w-2xl border-l border-[#C9956A]/50 pl-6 text-xl font-light italic leading-relaxed text-white/90">
              “{pullQuote}”
              {pullQuoteAttribution ? <footer className="mt-3 text-sm not-italic uppercase tracking-[0.25em] text-[#C9956A]">{pullQuoteAttribution}</footer> : null}
            </blockquote>
          ) : null}
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
      </section>
    );
  }

  return (
    <section className="bg-[#f8f6f2] text-[#18110d]">
      <div className={`grid min-h-[80vh] gap-10 px-6 py-10 lg:grid-cols-2 lg:px-12 ${mediaFirst ? '' : 'lg:[&>*:first-child]:order-2'}`}>
        <div className="relative overflow-hidden border border-black/10 bg-black/5 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[#A3413A]">Feature</p>
          <h2 className="mt-6 font-serif text-4xl font-medium leading-tight lg:text-6xl">{title}</h2>
          {standfirst ? <p className="mt-5 text-lg leading-relaxed text-[#5e4d40]">{standfirst}</p> : null}
          {body ? <p className="mt-8 line-clamp-8 text-base leading-8 text-[#35271f]">{body}</p> : null}
          {pullQuote ? (
            <blockquote className="mt-8 border-l-2 border-[#A3413A] pl-5 text-xl italic leading-relaxed text-[#2d2019]">
              “{pullQuote}”
              {pullQuoteAttribution ? <footer className="mt-3 text-xs not-italic uppercase tracking-[0.24em] text-[#8c6a55]">{pullQuoteAttribution}</footer> : null}
            </blockquote>
          ) : null}
          {galleryImages.length > 0 ? (
            <div className="mt-8 grid grid-cols-3 gap-3">
              {galleryImages.slice(0, 3).map((image, index) => (
                <div key={`${String(image.src)}-${index}`} className="relative aspect-[4/5] overflow-hidden rounded-sm bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={String(image.src)}
                    alt={typeof image.alt === 'string' ? image.alt : title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
          {ctaLabel && ctaHref ? (
            <div className="mt-8">
              <a
                href={ctaHref}
                className="inline-flex items-center border border-[#18110d]/15 bg-[#18110d] px-5 py-3 text-sm uppercase tracking-[0.2em] text-white transition hover:bg-[#A3413A]"
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
