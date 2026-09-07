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

/**
 * Dense newspaper-style classified listing, mirroring classic broadsheet
 * ads: UPPERCASE bold "headline" (the member name) followed by its copy
 * (role, company, location) and a phonebook-style website tail. A small
 * black-and-white thumbnail leads the line when a real photo exists.
 */
function AdItem({ entry }: { entry: ClassifiedEntry }) {
  const detail = [entry.role, entry.company, entry.location]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

  return (
    <li className="mb-2 break-inside-avoid text-[13.5px] leading-[1.35]">
      {entry.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.image}
          alt=""
          className="mr-1.5 inline-block h-6 w-6 rounded-[2px] border border-[#191412]/15 object-cover align-middle grayscale contrast-[1.05]"
        />
      ) : null}
      <strong className="font-serif text-[13.5px] font-bold uppercase tracking-[0.01em]">
        {entry.name}
      </strong>
      {entry.featured ? (
        <span className="ml-1 rounded-[2px] bg-[#a3413a] px-1 py-px align-middle font-sans text-[0.5rem] font-bold uppercase tracking-[0.14em] text-[#fdfdfb]">
          Featured
        </span>
      ) : null}
      {detail ? (
        <span className="text-[#191412]/90"> — {detail}</span>
      ) : null}
      {entry.website ? (
        <a
          href={entry.website}
          target="_blank"
          rel="noreferrer noopener"
          className="ml-1 text-[#a3413a] underline underline-offset-2 hover:opacity-80"
        >
          {entry.website.replace(/^https?:\/\//i, '')}
        </a>
      ) : null}
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
  const featured = entries.filter((e) => e.featured);

  // A–Z quick-index tabs, bucketed into three broadsheet bands like the
  // classic EMPLOYMENT / FOR SALE / AUTOMOTIVE tab strip.
  const initials = groups.map((g) => g.initial);
  const tabRanges = [
    { from: 'A', to: 'G' },
    { from: 'H', to: 'N' },
    { from: 'O', to: 'Z' },
  ]
    .map((range) => ({
      ...range,
      letters: initials.filter((l) => l >= range.from && l <= range.to),
    }))
    .filter((range) => range.letters.length > 0);

  const empty = groups.length === 0;

  return (
    <div className="min-h-full w-full bg-[#fdfdfb] text-[#191412]">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6">
        <div className="border border-[#191412] bg-[#fdfdfb]">
          {/* Region banner */}
          <header className="border-b-2 border-[#191412] bg-[#191412] px-4 py-2.5 text-center text-[#fdfdfb]">
            <h2 className="font-serif text-[clamp(20px,3vw,32px)] font-normal tracking-wide">
              Yorkshire BusinessWoman &middot; {kicker}
            </h2>
          </header>

          {/* Masthead: count box / giant title / snapshot box */}
          <section className="grid grid-cols-1 items-center gap-4 border-b-[3px] border-double border-[#191412] px-4 py-5 md:grid-cols-[180px_minmax(0,1fr)_220px]">
            <div>
              <div className="text-[19px] font-bold leading-tight">
                The Business
                <br />
                Directory
              </div>
              <div className="mt-2 border border-[#191412] bg-[#191412] px-3 py-2 text-center text-[#fdfdfb]">
                <span className="block text-[22px] font-bold leading-none tracking-wide">
                  {total}
                </span>
                <span className="font-sans text-[0.62rem] uppercase tracking-[0.16em]">
                  paid &amp; featured members
                </span>
              </div>
              <p className="mt-2 text-center font-sans text-[0.68rem] uppercase tracking-[0.16em] text-[#191412]/55">
                Frozen at publication
              </p>
            </div>

            <div className="text-center">
              <h1 className="font-serif text-[clamp(52px,11vw,150px)] font-black leading-[0.85] tracking-[-0.04em]">
                {title}
              </h1>
            </div>

            <div>
              <h4 className="border-y border-[#191412] px-2 py-1 text-right font-sans text-[0.72rem] font-bold uppercase tracking-[0.16em]">
                Directory Snapshot
              </h4>
              <div className="mt-2 border border-[#191412] px-3 py-2 text-right">
                <div className="text-[15px] font-bold">{total} listings</div>
                {intro ? (
                  <div className="mt-1 text-[12px] leading-snug text-[#191412]/70">
                    {intro}
                  </div>
                ) : null}
              </div>
              {snapshotDate ? (
                <p className="mt-2 text-right font-sans text-[0.68rem] uppercase tracking-[0.16em] text-[#191412]/55">
                  {snapshotDate}
                </p>
              ) : null}
            </div>
          </section>

          {/* Section tabs (A–Z bands) */}
          <nav className="grid grid-cols-3 gap-2.5 border-b-2 border-[#191412] px-4 py-2.5" aria-label="Classified sections">
            {tabRanges.length > 0 ? (
              tabRanges.map((range) => (
                <a
                  key={range.from}
                  href={`#classified-${range.letters[0]}`}
                  className="rounded-t-md border-b-2 border-[#191412] bg-[#191412] px-3 py-2 text-center font-sans text-[clamp(15px,2vw,24px)] font-extrabold uppercase tracking-[0.1em] text-[#fdfdfb] transition-colors hover:bg-[#a3413a]"
                >
                  {range.letters.length === 1
                    ? range.letters[0]
                    : `${range.letters[0]}\u2013${range.letters[range.letters.length - 1]}`}
                </a>
              ))
            ) : (
              <>
                <span className="rounded-t-md border-b-2 border-[#191412] bg-[#191412] px-3 py-2 text-center font-sans text-[clamp(15px,2vw,20px)] font-extrabold uppercase tracking-[0.1em] text-[#fdfdfb]">
                  Paid Members
                </span>
                <span className="rounded-t-md border-b-2 border-[#191412] bg-[#191412] px-3 py-2 text-center font-sans text-[clamp(15px,2vw,20px)] font-extrabold uppercase tracking-[0.1em] text-[#fdfdfb]">
                  Featured
                </span>
                <span className="rounded-t-md border-b-2 border-[#191412] bg-[#191412] px-3 py-2 text-center font-sans text-[clamp(15px,2vw,20px)] font-extrabold uppercase tracking-[0.1em] text-[#fdfdfb]">
                  Snapshot
                </span>
              </>
            )}
          </nav>

          {/* Main multi-column area */}
          <main className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_230px]">
            {/* Left sidebar: A–Z index + directory info */}
            <aside className="order-2 lg:order-1" aria-label="A-Z index">
              <section className="border border-[#191412]">
                <div className="border-b border-[#191412] bg-[#191412] px-2 py-2.5 text-center font-sans text-lg font-extrabold uppercase tracking-[0.08em] text-[#fdfdfb]">
                  A&ndash;Z Index
                </div>
                <div className="flex flex-wrap gap-1 p-2">
                  {groups.map((group) => (
                    <a
                      key={group.initial}
                      href={`#classified-${group.initial}`}
                      aria-label={`Jump to ${group.initial}`}
                      className="flex h-8 w-8 items-center justify-center border border-[#191412]/40 font-sans text-sm font-bold text-[#191412] transition-colors hover:bg-[#191412] hover:text-[#fdfdfb]"
                    >
                      {group.initial}
                    </a>
                  ))}
                </div>
              </section>

              <section className="mt-4 border border-[#191412]">
                <div className="border-b border-[#191412] bg-[#191412] px-2 py-2 text-center font-sans text-sm font-extrabold uppercase tracking-[0.14em] text-[#fdfdfb]">
                  In This Edition
                </div>
                <div className="p-2.5 text-[12.5px] leading-snug">
                  <p className="mb-1.5">
                    <strong>{total} paid &amp; featured members</strong> of
                    Yorkshire BusinessWoman are listed in this directory.
                  </p>
                  <p className="border-t border-dashed border-[#191412]/25 pt-1.5 text-[#191412]/70">
                    To be listed, hold a paid membership or featured profile;
                    the directory updates when the classifieds are re-baked.
                  </p>
                </div>
              </section>
            </aside>

            {/* Dense newspaper-style content columns */}
            <section className="order-1 columns-1 gap-4 [column-rule:1px_solid_rgba(25,20,18,0.3)] sm:columns-2 lg:order-2 lg:columns-3">
              {empty ? (
                <p className="break-inside-avoid font-serif italic text-[#7a6e65]">
                  The directory is empty for this edition. Re-run the
                  classifieds bake when paid members are listed.
                </p>
              ) : (
                groups.map((group) => (
                  <section
                    key={group.initial}
                    id={`classified-${group.initial}`}
                    className="mb-4 break-inside-avoid border-b border-dashed border-[#191412]/25 pb-2"
                  >
                    <h3 className="mb-1 border-y border-[#191412] bg-[#fdfdfb] px-2 py-1 text-center font-serif text-[17px] font-bold tracking-[0.02em]">
                      {group.initial}
                    </h3>
                    <ul className="list-none p-0 pt-1">
                      {group.entries.map((entry) => (
                        <AdItem key={entry.key} entry={entry} />
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </section>

            {/* Right featured-spotlight promo box */}
            <aside className="order-3 hidden xl:block" aria-label="Featured member spotlight">
              <div className="border border-[#191412] bg-gradient-to-br from-[#fdfdfb] via-[#faf6ef] to-[#f2ede3] p-2">
                <div className="my-1 rotate-[-0.5deg] border-4 border-double border-[#191412] bg-[#fdfdfb] px-3 py-2 text-center font-serif text-[44px] font-black leading-[0.9] tracking-[-0.02em]">
                  Featured
                </div>
                <div className="my-1 bg-[#191412] px-3 py-2 text-center font-sans text-[15px] font-extrabold tracking-[0.04em] text-[#fdfdfb]">
                  This Week&rsquo;s Spotlight
                </div>
                {featured[0] ? (
                  <div className="my-2 border border-dashed border-[#191412] bg-[#fdfdfb] p-3 text-center text-[13px]">
                    {featured[0].image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={featured[0].image}
                        alt={featured[0].name}
                        className="mx-auto mb-2 h-16 w-16 rounded-[2px] border border-[#191412]/15 object-cover grayscale contrast-[1.05]"
                      />
                    ) : null}
                    <strong className="font-serif text-[15px] font-bold uppercase tracking-[0.01em]">
                      {featured[0].name}
                    </strong>
                    {featured[0].role ? (
                      <p className="mt-1 text-[#a3413a]">{featured[0].role}</p>
                    ) : null}
                    {featured[0].company ? (
                      <p className="font-semibold">{featured[0].company}</p>
                    ) : null}
                    {featured[0].location ? (
                      <p className="text-[#191412]/75">{featured[0].location}</p>
                    ) : null}
                    {featured[0].website ? (
                      <a
                        href={featured[0].website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 inline-block text-[#a3413a] underline underline-offset-2 hover:opacity-80"
                      >
                        {featured[0].website.replace(/^https?:\/\//i, '')}
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <p className="my-2 border border-dashed border-[#191412] bg-[#fdfdfb] p-3 text-center text-[12.5px] leading-snug">
                    {intro || 'Featured member profiles appear here as they are marked featured.'}
                  </p>
                )}
                <p className="mt-1 border-t border-[#191412] pt-1 text-center font-sans text-[10px] italic leading-snug text-[#191412]/60">
                  Paid &amp; featured members of Yorkshire BusinessWoman &middot; frozen snapshot at publication
                </p>
              </div>
            </aside>
          </main>

          {/* Folio */}
          <footer className="flex items-center justify-between border-t-2 border-[#191412] px-4 py-2.5 font-sans text-[0.65rem] uppercase tracking-[0.18em] text-[#191412]/60">
            <span>YBW</span>
            <span className="hidden text-[#a3413a] sm:inline">◆ ◆ ◆</span>
            <span>{kicker}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}