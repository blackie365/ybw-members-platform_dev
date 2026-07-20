import type { Edition, FlatplanPage } from '../../domain/types';

interface ContentsTemplateProps {
  edition: Edition;
  page: FlatplanPage;
  viewModel: Record<string, unknown>;
}

interface ContentsEntry {
  title: string;
  pageLabel: string;
}

export default function ContentsTemplate({ edition, page, viewModel }: ContentsTemplateProps) {
  const entries = Array.isArray(viewModel.entries) ? (viewModel.entries as ContentsEntry[]) : [];
  const mode = viewModel.mode === 'closing' ? 'closing' : 'contents';
  const closingEyebrow = typeof viewModel.closingEyebrow === 'string' ? viewModel.closingEyebrow : '';
  const closingTitle = typeof viewModel.closingTitle === 'string' ? viewModel.closingTitle : '';
  const closingBody = typeof viewModel.closingBody === 'string' ? viewModel.closingBody : '';
  const closingCtaLabel = typeof viewModel.closingCtaLabel === 'string' ? viewModel.closingCtaLabel : '';
  const closingCtaHref = typeof viewModel.closingCtaHref === 'string' ? viewModel.closingCtaHref : '';

  if (mode === 'closing') {
    return (
      <section className="bg-[#16110f] text-white">
        <div className="mx-auto grid min-h-[70vh] max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[0.75fr_1.25fr] lg:px-12">
          <div className="flex flex-col justify-between border-b border-white/10 pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#C9956A]">
                {closingEyebrow || 'Closing Note'}
              </p>
              <h2 className="mt-6 font-serif text-4xl font-medium lg:text-5xl">
                {closingTitle || edition.title}
              </h2>
            </div>
            <div className="text-sm uppercase tracking-[0.3em] text-white/45">Page {page.position}</div>
          </div>
          <div className="flex flex-col justify-center">
            <p className="max-w-2xl text-lg leading-relaxed text-white/78">
              {closingBody || 'Add a closing editorial note, a sponsor message, or a final call to action for this edition.'}
            </p>
            {closingCtaLabel && closingCtaHref ? (
              <div className="mt-8">
                <a
                  href={closingCtaHref}
                  className="inline-flex items-center border border-white/15 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-[#16110f]"
                >
                  {closingCtaLabel}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#f6f1ea] text-[#16110f]">
      <div className="mx-auto grid min-h-[80vh] max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[0.6fr_1.4fr] lg:px-12">
        <div className="flex flex-col justify-between border-b border-[#d8c8b5] pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#A3413A]">Contents</p>
            <h2 className="mt-6 font-serif text-4xl font-medium lg:text-5xl">{edition.title}</h2>
          </div>
          <div className="text-sm uppercase tracking-[0.3em] text-[#7f6a57]">Page {page.position}</div>
        </div>

        <div className="grid gap-5">
          {entries.map((entry) => (
            <div key={`${entry.pageLabel}-${entry.title}`} className="flex items-end justify-between gap-4 border-b border-[#d8c8b5] pb-3">
              <div className="font-serif text-2xl">{entry.title}</div>
              <div className="text-sm uppercase tracking-[0.25em] text-[#7f6a57]">{entry.pageLabel}</div>
            </div>
          ))}
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8c8b5] p-8 text-[#7f6a57]">
              Contents will auto-generate from approved placed stories.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
