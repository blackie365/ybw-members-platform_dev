import type { Edition, FlatplanPage } from '../../domain/types';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';

interface FeatureTemplateProps {
  edition: Edition;
  page: FlatplanPage;
  viewModel: Record<string, unknown>;
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getBodyParagraphs(value: string) {
  const normalized = stripHtml(value);
  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function renderTitleArt(value: string) {
  return value.split(/(\*[^*]+\*)/g).map((segment, index) => {
    if (segment.startsWith('*') && segment.endsWith('*')) {
      return (
        <span key={`${segment}-${index}`} className="font-serif italic text-[#A3413A]">
          {segment.slice(1, -1)}
        </span>
      );
    }

    return <span key={`${segment}-${index}`}>{segment}</span>;
  });
}

function humanizeContentType(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatSpreadLabel(page: FlatplanPage) {
  if (!page.spreadPagePositions || page.spreadPagePositions.length <= 1) {
    return `Page ${String(page.position).padStart(2, '0')}`;
  }

  const [first, last] = page.spreadPagePositions;
  return `Spread ${String(first).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export default function FeatureTemplate({ edition, page, viewModel }: FeatureTemplateProps) {
  const title = typeof viewModel.title === 'string' ? viewModel.title : edition.title;
  const standfirst = typeof viewModel.standfirst === 'string' ? viewModel.standfirst : '';
  const body = typeof viewModel.body === 'string' ? viewModel.body : '';
  const author = typeof viewModel.author === 'string' ? viewModel.author : '';
  const contentType = typeof viewModel.contentType === 'string' ? viewModel.contentType : '';
  const heroImage = typeof viewModel.heroImage === 'string' ? viewModel.heroImage : '';
  const safeHeroImage = heroImage ? fixMagazineImageUrl(heroImage) : '';
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
  const bodyParagraphs = getBodyParagraphs(body);
  const storyLabel = contentType ? humanizeContentType(contentType) : 'Feature';
  const publishLabel = new Date(edition.publishDate).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const spreadLabel = formatSpreadLabel(page);
  const introParagraph = standfirst || bodyParagraphs[0] || '';
  const supportingParagraphs = standfirst ? bodyParagraphs : bodyParagraphs.slice(1);

  if (fullBleed) {
    return (
      <section className="relative min-h-[84vh] overflow-hidden bg-[#120d0b] text-white">
        {safeHeroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeHeroImage} alt={title} className="absolute inset-0 h-full w-full object-cover opacity-65" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/82 via-black/46 to-black/18" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/16 to-transparent" />
        <div className="absolute left-0 top-0 bottom-0 z-10 w-1 bg-gradient-to-b from-transparent via-[#A3413A] to-transparent" />
        <div className="grain-overlay absolute inset-0 z-[1]" />
        <div className="blob-primary absolute left-[12%] top-[12%] h-[24rem] w-[24rem]" />
        <div className="blob-accent absolute bottom-[8%] right-[10%] h-[22rem] w-[22rem]" />

        <div className="relative mx-auto flex min-h-[84vh] max-w-7xl flex-col justify-end px-6 py-10 lg:px-12">
          <div className="max-w-4xl rounded-[2rem] border border-white/10 bg-black/38 p-7 shadow-[0_28px_90px_rgba(0,0,0,0.4)] backdrop-blur-md lg:p-10">
            <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-[0.28em] text-white/60">
              <span className="text-[#C9956A]">{storyLabel}</span>
              <span>{spreadLabel}</span>
              <span>{publishLabel}</span>
              {author ? <span>By {author}</span> : null}
            </div>
            <h2 className="mt-5 max-w-4xl font-serif text-5xl font-medium leading-[0.95] lg:text-7xl">{renderTitleArt(title)}</h2>
            {introParagraph ? (
              <div className="mt-6 max-w-3xl border-l border-[#C9956A]/60 pl-5">
                <p className="font-serif text-xl leading-relaxed text-zinc-200 lg:text-[1.45rem]">{introParagraph}</p>
              </div>
            ) : null}
          </div>
          {pullQuote ? (
            <blockquote className="pull-quote mt-8 max-w-2xl bg-black/20 py-3 pr-4 text-white/90 backdrop-blur-sm">
              “{pullQuote}”
              {pullQuoteAttribution ? <footer className="mt-3 text-sm not-italic uppercase tracking-[0.25em] text-[#C9956A]">{pullQuoteAttribution}</footer> : null}
            </blockquote>
          ) : null}
          {supportingParagraphs.length > 0 ? (
            <div className="mt-8 max-w-3xl rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-[10px] uppercase tracking-[0.26em] text-[#C9956A]">Feature Text</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">{spreadLabel}</p>
              </div>
              <div className="mt-4 grid gap-4 font-serif text-base leading-8 text-white/82 lg:grid-cols-2">
                {supportingParagraphs.map((paragraph, index) => (
                  <p key={`${paragraph}-${index}`} className={index === 0 && !standfirst ? 'editorial-dropcap' : undefined}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
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
    <section className="relative overflow-hidden bg-[#f8f6f2] text-[#18110d]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(163,65,58,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(201,149,106,0.08),transparent_30%)]" />
      <div className="grain-overlay absolute inset-0 opacity-40" />
      <div className={`relative grid min-h-[84vh] gap-10 px-6 py-10 lg:grid-cols-[0.98fr_1.02fr] lg:px-12 ${mediaFirst ? '' : 'lg:[&>*:first-child]:order-2'}`}>
        <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-black/5 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
          {safeHeroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={safeHeroImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
            {storyLabel}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/35 p-4 backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#C9956A]">{publishLabel}</p>
              {author ? <p className="mt-2 text-sm text-white/80">By {author}</p> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-[#A3413A]" />
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#A3413A]">{storyLabel}</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8c6a55]">{spreadLabel}</p>
          </div>
          <h2 className="text-feature-xl mt-6 font-serif font-medium text-[#18110d]">{renderTitleArt(title)}</h2>
          {introParagraph ? (
            <div className="mt-5 max-w-2xl border-l-2 border-[#A3413A]/60 pl-5">
              <p className="font-serif text-[1.35rem] leading-relaxed text-[#5e4d40]">{introParagraph}</p>
            </div>
          ) : null}
          {supportingParagraphs.length > 0 ? (
            <div className="mt-8 space-y-4 rounded-[1.8rem] border border-[#dfd3c5] bg-white/70 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#A3413A]">Opening Text</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8c6a55]">{publishLabel}</p>
              </div>
              {supportingParagraphs.map((paragraph, index) => (
                <p
                  key={`${paragraph}-${index}`}
                  className={
                    index === 0
                      ? `font-serif leading-8 text-[#2d2019] ${standfirst ? 'text-lg' : 'editorial-dropcap text-xl'}`
                      : 'font-serif text-lg leading-8 text-[#4d3a30]'
                  }
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}
          {pullQuote ? (
            <blockquote className="pull-quote mt-8 rounded-[1.5rem] border border-[#A3413A]/15 bg-white/70 px-6 py-5 text-[#2d2019] shadow-[0_16px_45px_rgba(0,0,0,0.05)]">
              “{pullQuote}”
              {pullQuoteAttribution ? <footer className="mt-3 text-xs not-italic uppercase tracking-[0.24em] text-[#8c6a55]">{pullQuoteAttribution}</footer> : null}
            </blockquote>
          ) : null}
          {galleryImages.length > 0 ? (
            <div className="mt-8 grid grid-cols-3 gap-3">
              {galleryImages.slice(0, 3).map((image, index) => (
                <div key={`${String(image.src)}-${index}`} className="relative aspect-[4/5] overflow-hidden rounded-[1rem] bg-black/5 shadow-[0_14px_35px_rgba(0,0,0,0.08)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fixMagazineImageUrl(String(image.src))}
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
