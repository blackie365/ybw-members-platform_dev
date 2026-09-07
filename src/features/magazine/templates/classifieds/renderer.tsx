import type { TemplateRenderProps } from '../../domain/template-registry';
import { groupClassifiedEntries } from '../../domain/classifieds';
import type { ClassifiedEntry } from '../../domain/classifieds';

function formatSnapshotDate(raw: string): string {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return raw;
  }
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function Entry({ entry }: { entry: ClassifiedEntry }) {
  return (
    <li className="break-inside-avoid border border-[#191412]/15 bg-[#fdfdfb] p-3">
      <div className="flex gap-3">
        {entry.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.image}
            alt={entry.name}
            className="h-12 w-12 shrink-0 rounded-[2px] border border-[#191412]/10 object-cover grayscale contrast-[1.05]"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[2px] bg-[#191412]/5 font-serif text-[0.85rem] font-bold text-[#191412]/50">
            {initialsFor(entry.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-serif text-[0.92rem] font-bold leading-tight text-[#191412]">
            <span className="truncate">{entry.name}</span>
            {entry.featured ? (
              <span className="shrink-0 rounded-[3px] bg-[#a3413a]/10 border border-[#a3413a]/30 px-1 py-px font-sans text-[0.5rem] font-bold uppercase tracking-[0.16em] text-[#a3413a]">
                Featured
              </span>
            ) : null}
          </p>
          {entry.role ? (
            <p className="mt-1 truncate font-sans text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[#a3413a]">
              {entry.role}
            </p>
          ) : null}
          {entry.company ? (
            <p className="mt-0.5 truncate font-sans text-[0.74rem] leading-snug text-[#191412]/85">
              {entry.company}
            </p>
          ) : null}
          {entry.location ? (
            <p className="truncate font-sans text-[0.7rem] leading-snug text-[#191412]/60">
              {entry.location}
            </p>
          ) : null}
          {entry.website ? (
            <a
              href={entry.website}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-block truncate font-sans text-[0.68rem] text-[#a3413a] underline underline-offset-2 hover:opacity-80"
            >
              {entry.website.replace(/^https?:\/\//i, '')}
            </a>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function ClassifiedsTemplate({
  viewModel,
}: TemplateRenderProps) {
  const data = (viewModel || {}) as Record<string, unknown>;
  const title = String(data.title || 'Classifieds');
  const kicker = String(data.kicker || 'Business Directory');
  const intro = String(data.intro || '');
  const generatedAt = String(data.generatedAt || '');
  const entries = (Array.isArray(data.entries) ? data.entries : []) as ClassifiedEntry[];
  const groups = groupClassifiedEntries(entries);
  const total = Number(data.count ?? entries.length) || 0;
  const snapshotDate = formatSnapshotDate(generatedAt);

  return (
    <div className="min-h-full w-full bg-[#fdfdfb] text-[#191412]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        {/* Masthead band — mirrors the broadsheet spread */}
        <header className="flex items-center justify-between gap-4 pb-2">
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            {kicker}
          </span>
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            Yorkshire BusinessWoman
          </span>
        </header>
        <div className="h-px w-full bg-[#191412]/25" />
        <div className="py-3 text-center">
          <h1 className="font-serif text-[clamp(1.6rem,5.5vw,3.2rem)] leading-none tracking-tight text-[#191412]">
            Yorkshire <span className="italic">Business</span>Woman
          </h1>
          <p className="mt-1.5 font-sans text-[0.6rem] uppercase tracking-[0.34em] text-[#191412]/50 sm:text-[0.65rem]">
            News for the region&rsquo;s entrepreneurs &amp; businesswomen
          </p>
        </div>
        <div className="flex flex-col items-center justify-between gap-1 border-b border-t border-[#191412] py-1.5 sm:flex-row">
          <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
            The finest of its kind, printed without apology
          </span>
          <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
            YBW · No. 32
          </span>
        </div>
        <div className="mt-0 h-[2px] w-full bg-[#191412]" />
        <div className="h-px w-full bg-[#191412]/70" />
        <div className="h-[3px] w-full bg-[#191412]" />

        {/* Section header */}
        <div className="mt-10 border-b-[3px] border-[#191412] pb-4">
          <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#a3413a]">
            {kicker}
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.6rem,4.5vw,2.6rem)] font-bold leading-none tracking-tight text-[#191412]">
            {title}
          </h2>
          {intro ? (
            <p className="mt-3 max-w-[58ch] font-serif text-[0.98rem] italic leading-relaxed text-[#191412]/70">
              {intro}
            </p>
          ) : null}
          <p className="mt-3 font-sans text-[0.68rem] uppercase tracking-[0.18em] text-[#191412]/55">
            {total} paid members · Directory snapshot
            {snapshotDate ? ` · ${snapshotDate}` : ''}
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="mt-8 font-serif italic text-[#7a6e65]">
            The directory is empty for this edition. Re-run the classifieds bake
            when paid members are listed.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
            <div>
              {groups.map((group) => (
                <section key={group.initial} id={`classified-${group.initial}`}>
                  <h3 className="mt-6 flex items-baseline gap-3 border-b border-[#191412]/30 pb-1 first:mt-0">
                    <span className="font-serif text-xl font-bold text-[#a3413a]">
                      {group.initial}
                    </span>
                    <span className="h-px flex-1 bg-[#191412]/20" />
                  </h3>
                  <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.entries.map((entry) => (
                      <Entry key={entry.key} entry={entry} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {/* A–Z index */}
            <aside className="hidden lg:block">
              <div className="sticky top-8 border-t-[3px] border-[#191412] pt-3">
                <p className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#a3413a]">
                  A&ndash;Z Index
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {groups.map((group) => (
                    <a
                      key={group.initial}
                      href={`#classified-${group.initial}`}
                      aria-label={`Jump to ${group.initial}`}
                      className="flex h-7 w-7 items-center justify-center rounded border border-[#191412]/20 font-sans text-xs font-semibold text-[#191412]/80 transition-colors hover:border-[#a3413a]/50 hover:bg-[#a3413a]/10 hover:text-[#a3413a]"
                    >
                      {group.initial}
                    </a>
                  ))}
                </div>
                <p className="mt-5 font-sans text-[0.66rem] leading-relaxed text-[#191412]/55">
                  Paid &amp; featured members of Yorkshire BusinessWoman. This
                  section is a frozen snapshot taken at publication — it does not
                  update live with the online directory.
                </p>
              </div>
            </aside>
          </div>
        )}

        {/* Folio */}
        <footer className="mt-12 pt-6">
          <div className="h-[3px] w-full bg-[#191412]" />
          <div className="h-px w-full bg-[#191412]/50" />
          <div className="flex items-center justify-between pt-3 font-sans text-[0.65rem] uppercase tracking-[0.18em] text-[#191412]/55">
            <span>YBW</span>
            <span className="hidden text-[#a3413a] sm:inline">◆ ◆ ◆</span>
            <span>{kicker}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}