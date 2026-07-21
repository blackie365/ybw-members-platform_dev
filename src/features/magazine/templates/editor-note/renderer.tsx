import type { Edition, FlatplanPage } from '../../domain/types';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';

interface EditorNoteTemplateProps {
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

export default function EditorNoteTemplate({ edition, page, viewModel }: EditorNoteTemplateProps) {
  const title = typeof viewModel.title === 'string' ? viewModel.title : "Editor's Note";
  const standfirst = typeof viewModel.standfirst === 'string' ? viewModel.standfirst : '';
  const body = typeof viewModel.body === 'string' ? viewModel.body : '';
  const author = typeof viewModel.author === 'string' ? viewModel.author : '';
  const heroImage = typeof viewModel.heroImage === 'string' ? viewModel.heroImage : '';
  const safeHeroImage = heroImage ? fixMagazineImageUrl(heroImage) : '';
  const pullQuote = typeof viewModel.pullQuote === 'string' ? viewModel.pullQuote : '';
  const pullQuoteAttribution = typeof viewModel.pullQuoteAttribution === 'string' ? viewModel.pullQuoteAttribution : '';
  const publishLabel = new Date(edition.publishDate).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const bodyParagraphs = getBodyParagraphs(body);

  return (
    <section className="relative overflow-hidden bg-[#f3eee7] text-[#1b1410]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(163,65,58,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(201,149,106,0.10),transparent_30%)]" />
      <div className="grain-overlay absolute inset-0 opacity-40" />
      <div className="absolute left-0 top-0 bottom-0 z-10 w-1 bg-gradient-to-b from-transparent via-[#A3413A] to-transparent" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#A3413A] to-transparent" />

      <div className="relative mx-auto grid min-h-[84vh] gap-10 px-6 py-10 lg:max-w-7xl lg:grid-cols-[0.72fr_1.28fr] lg:px-12 lg:py-12">
        <div className="flex flex-col justify-between border-b border-[#d9cbbb] pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#A3413A]">From The Editor</p>
            <h2 className="mt-6 font-serif text-4xl font-medium leading-tight lg:text-5xl">{title}</h2>
            {standfirst ? (
              <p className="mt-5 max-w-md font-serif text-xl leading-relaxed text-[#5f4d41]">{standfirst}</p>
            ) : null}
          </div>

          <div className="space-y-5">
            {safeHeroImage ? (
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.8rem] border border-[#d9cbbb] bg-white/70 shadow-[0_18px_55px_rgba(0,0,0,0.08)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={safeHeroImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              </div>
            ) : null}

            <div className="space-y-2 text-sm uppercase tracking-[0.24em] text-[#7f6a57]">
              <div>{author || edition.title}</div>
              <div>{publishLabel}</div>
              <div>Page {String(page.position).padStart(2, '0')}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="rounded-[2rem] border border-[#d9cbbb] bg-white/72 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.06)]">
            <p className="text-[10px] uppercase tracking-[0.26em] text-[#A3413A]">Editorial Letter</p>
            <div className="mt-6 space-y-5">
              {bodyParagraphs.length > 0 ? (
                bodyParagraphs.map((paragraph, index) => (
                  <p
                    key={`${paragraph}-${index}`}
                    className={
                      index === 0
                        ? 'editorial-dropcap font-serif text-2xl leading-9 text-[#2d2019]'
                        : 'font-serif text-lg leading-8 text-[#4d3a30]'
                    }
                  >
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="font-serif text-xl leading-8 text-[#4d3a30]">
                  Add the editor&apos;s introduction to open the issue with a clear editorial voice.
                </p>
              )}
            </div>

            {pullQuote ? (
              <blockquote className="pull-quote mt-8 rounded-[1.5rem] border border-[#A3413A]/15 bg-[#f8f4ee] px-6 py-5 text-[#2d2019]">
                “{pullQuote}”
                {pullQuoteAttribution ? (
                  <footer className="mt-3 text-xs not-italic uppercase tracking-[0.24em] text-[#8c6a55]">
                    {pullQuoteAttribution}
                  </footer>
                ) : null}
              </blockquote>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
