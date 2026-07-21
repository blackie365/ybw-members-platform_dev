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
  const highlightTitle = typeof viewModel.highlightTitle === 'string' ? viewModel.highlightTitle : '';
  const publishLabel = new Date(edition.publishDate).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const leadEntry = entries[0];
  const secondaryEntries = entries.slice(1);

  if (mode === 'closing') {
    return (
      <section className="relative overflow-hidden bg-[#16110f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(163,65,58,0.16),transparent_28%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9956A] to-transparent" />

        <div className="relative mx-auto grid min-h-[70vh] max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[0.72fr_1.28fr] lg:px-12">
          <div className="flex flex-col justify-between border-b border-white/10 pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9956A]">
                {closingEyebrow || 'Closing Note'}
              </p>
              <h2 className="mt-6 font-serif text-4xl font-medium leading-tight lg:text-5xl">
                {closingTitle || edition.title}
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/55">
                A final spread should close the issue with the same editorial confidence as the opening pages, whether that is a note, a thank-you, or a next-issue cue.
              </p>
            </div>
            <div className="space-y-2 text-sm uppercase tracking-[0.24em] text-white/45">
              <div>Page {String(page.position).padStart(2, '0')}</div>
              <div>{publishLabel}</div>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_26px_90px_rgba(0,0,0,0.24)] backdrop-blur-sm">
              <p className="max-w-2xl font-serif text-[1.35rem] leading-relaxed text-white/78">
                {closingBody || `Thank you for reading ${edition.title}. Continue the conversation, discover more members, and watch for the next issue.`}
              </p>
              <div className="mt-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-[#C9956A] to-transparent" />
                <span className="text-[10px] uppercase tracking-[0.28em] text-white/40">End Matter</span>
              </div>
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
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-[#f6f1ea] text-[#16110f]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(163,65,58,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(201,149,106,0.10),transparent_28%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#A3413A] to-transparent" />

      <div className="relative mx-auto grid min-h-[80vh] max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[0.54fr_1.46fr] lg:px-12 lg:py-12">
        <div className="flex flex-col justify-between border-b border-[#d8c8b5] pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#A3413A]">Contents</p>
            <h2 className="mt-6 font-serif text-4xl font-medium leading-tight lg:text-5xl">{edition.title}</h2>
            <div className="mt-6 max-w-sm border-l-2 border-[#A3413A]/55 pl-5">
              <p className="font-serif text-lg leading-relaxed text-[#6e5949]">
                A curated route through the issue, balancing long-form reading with stronger editorial pacing.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {highlightTitle ? (
              <div className="rounded-[1.5rem] border border-[#d8c8b5] bg-white/60 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#A3413A]">Lead Highlight</p>
                <p className="mt-3 font-serif text-2xl leading-tight text-[#16110f]">{highlightTitle}</p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.3rem] border border-[#d8c8b5] bg-white/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#A3413A]">Edition</p>
                <p className="mt-3 font-serif text-xl leading-tight text-[#16110f]">{publishLabel}</p>
              </div>
              <div className="rounded-[1.3rem] border border-[#d8c8b5] bg-white/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#A3413A]">Stories</p>
                <p className="mt-3 font-serif text-xl leading-tight text-[#16110f]}">{String(entries.length).padStart(2, '0')} selected</p>
              </div>
            </div>
            <div className="space-y-2 text-sm uppercase tracking-[0.24em] text-[#7f6a57]">
              <div>{publishLabel}</div>
              <div>Page {String(page.position).padStart(2, '0')}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {leadEntry ? (
            <div className="group relative overflow-hidden rounded-[1.8rem] border border-[#cfae95] bg-[#1a1310] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:col-span-2">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,149,106,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(163,65,58,0.14),transparent_28%)]" />
              <div className="relative flex h-full flex-col justify-between gap-8 lg:flex-row lg:items-end">
                <div className="max-w-3xl">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#C9956A]">Lead Highlight</p>
                  <h3 className="mt-4 font-serif text-3xl leading-tight lg:text-4xl">{leadEntry.title}</h3>
                </div>
                <div className="flex items-end gap-5">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Open To</p>
                    <p className="mt-3 font-serif text-5xl leading-none text-[#C9956A]">{leadEntry.pageLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {secondaryEntries.map((entry, index) => (
            <div
              key={`${entry.pageLabel}-${entry.title}`}
              className="group relative overflow-hidden rounded-[1.5rem] border border-[#d8c8b5] bg-white/70 p-5 shadow-[0_16px_45px_rgba(0,0,0,0.05)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.09)]"
            >
              <div className="absolute right-0 top-0 h-20 w-20 bg-[radial-gradient(circle_at_top_right,rgba(163,65,58,0.10),transparent_65%)]" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#A3413A]">Story {String(index + 2).padStart(2, '0')}</p>
                  <div className="mt-4 font-serif text-[1.7rem] leading-tight text-[#16110f]">{entry.title}</div>
                </div>
                <div className="font-serif text-4xl leading-none text-[#A3413A]/70">{entry.pageLabel}</div>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-[#A3413A] to-transparent transition-all duration-300 group-hover:from-[#7e2f2a]" />
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#7f6a57]">Open To {entry.pageLabel}</div>
              </div>
            </div>
          ))}
          {entries.length === 0 ? (
            <div className="rounded-[1.8rem] border border-dashed border-[#d8c8b5] bg-white/50 p-8 text-[#7f6a57]">
              Contents will auto-generate from approved placed stories.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
