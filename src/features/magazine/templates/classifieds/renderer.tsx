import type { TemplateRenderProps } from '../../domain/template-registry';
import { groupClassifiedEntries, initialsFor } from '../../domain/classifieds';
import type { ClassifiedEntry } from '../../domain/classifieds';
import { MagazineMastheadLogo } from '../shared';

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
 * Uniform portrait tile for every card: the member's photo when one exists,
 * otherwise a paper-and-ink monogram that reads like a placeholder woodcut —
 * same size, border and grayscale treatment either way so photo and non-photo
 * listings line up identically down the column.
 */
function PortraitTile({
  name,
  image,
  className,
}: {
  name: string;
  image: string;
  className: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className={`object-cover grayscale contrast-[1.05] ${className}`}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center border border-[#191412]/30 bg-gradient-to-br from-[#ece7dc] to-[#d6cfc2] font-serif font-bold text-[#191412]/70 ${className}`}
    >
      {initialsFor(name) || '\u2014'}
    </div>
  );
}

/** Detect sparse entries that have almost no profile data. */
function isSparseEntry(entry: ClassifiedEntry): boolean {
  return !entry.bio && !entry.image && !entry.website &&
    !entry.links?.linkedin && !entry.links?.instagram && !entry.links?.twitter;
}

/**
 * Compact one-line listing for members with no photo, bio, or links —
 * just name and role/company inline so sparse entries don't eat half a
 * column with whitespace.
 */
function CompactAdItem({ entry }: { entry: ClassifiedEntry }) {
  const detail = [entry.role, entry.company, entry.location]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

  return (
    <li className="mb-0.5 break-inside-avoid">
      <div className={`flex items-baseline gap-1.5 border-l-2 px-2 py-0.5 text-[12px] leading-snug ${
        entry.featured
          ? 'border-l-[#a3413a] bg-[#a3413a]/[0.04]'
          : 'border-l-transparent'
      }`}>
        <strong className="shrink-0 font-serif text-[11.5px] font-bold uppercase tracking-[0.01em]">
          {entry.name}
        </strong>
        {detail ? (
          <span className="truncate text-[#191412]/60">{detail}</span>
        ) : null}
        {entry.featured ? (
          <span className="ml-auto shrink-0 rounded-[2px] bg-[#a3413a] px-1 py-px font-sans text-[0.45rem] font-bold uppercase tracking-[0.12em] text-[#fdfdfb]">
            Featured
          </span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Card-style listing mirroring the featured-spotlight box: photo on top,
 * then name / role / company / location / website stacked in the middle so
 * every entry reads the same way. `break-all` on the link keeps long URLs
 * inside the card instead of spilling out of the column.
 */
function AdItem({ entry }: { entry: ClassifiedEntry }) {
  const detail = [entry.role, entry.company, entry.location]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

  const socialLinks = (
    [
      ['LinkedIn', entry.links?.linkedin],
      ['Instagram', entry.links?.instagram],
      ['Twitter', entry.links?.twitter],
    ] as const
  ).filter((pair) => pair[1]) as [string, string][];

  if (isSparseEntry(entry)) return <CompactAdItem entry={entry} />;

  return (
    <li className="mb-3 break-inside-avoid">
      <div className={`border bg-[#fdfdfb] p-2.5 text-center text-[12.5px] leading-snug ${
        entry.featured
          ? 'border-[#191412] border-l-[3px] border-l-[#a3413a] bg-[#a3413a]/[0.03]'
          : 'border-dashed border-[#191412]'
      }`}>
        <PortraitTile
          name={entry.name}
          image={entry.image}
          className="mx-auto mb-1.5 h-11 w-11 rounded-[2px] border border-[#191412]/15 text-[15px]"
        />
        <strong className="block font-serif text-[13px] font-bold uppercase tracking-[0.01em]">
          {entry.name}
        </strong>
        {entry.featured ? (
          <span className="mx-auto mt-1 block w-fit rounded-[2px] bg-[#a3413a] px-1 py-px font-sans text-[0.5rem] font-bold uppercase tracking-[0.14em] text-[#fdfdfb]">
            Featured
          </span>
        ) : null}
        {detail ? (
          <p className="mt-0.5 text-[#191412]/90">{detail}</p>
        ) : null}
        {entry.bio ? (
          <p className="mt-0.5 line-clamp-2 text-[#191412]/75">{entry.bio}</p>
        ) : null}
        {entry.tags && entry.tags.length > 0 ? (
          <p className="mt-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.1em] text-[#191412]/50">
            {entry.tags.join(' · ')}
          </p>
        ) : null}
        {entry.website ? (
          <a
            href={entry.website}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-0.5 inline-block max-w-full break-all text-[#a3413a] underline underline-offset-2 hover:opacity-80"
          >
            {entry.website.replace(/^https?:\/\//i, '')}
          </a>
        ) : null}
        {socialLinks.length > 0 ? (
          <p className="mt-0.5 text-[#a3413a]">
            {socialLinks.map(([label, href], index) => (
              <span key={label}>
                {index > 0 ? (
                  <span className="text-[#191412]/30"> · </span>
                ) : null}
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2 hover:opacity-80"
                >
                  {label}
                </a>
              </span>
            ))}
          </p>
        ) : null}
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

  // Collect unique tags with counts for the sidebar summary.
  const tagCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      const key = tag.toLowerCase();
      tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
    }
  }
  const sortedTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div className="min-h-full w-full bg-[#fdfdfb] text-[#191412]">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6">
        <div className="border border-[#191412] bg-[#fdfdfb]">
          {/* Masthead — mirror of PageNewspaperSpread: hairline band,
              wordmark, tagline, dateline bar and printer's rule stack. */}
          <header className="flex items-center justify-between gap-4 px-4 pb-2 pt-4">
            <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
              {kicker || "Business Directory"}
            </span>
            <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
              Yorkshire BusinessWoman
            </span>
          </header>
          <div className="h-px w-full bg-[#191412]/25" />
          <div className="px-4 py-2 text-center">
            <h1 className="text-center">
              <MagazineMastheadLogo />
            </h1>
            <p className="mt-1.5 font-sans text-[0.6rem] uppercase tracking-[0.34em] text-[#191412]/50 sm:text-[0.65rem]">
              {intro || "The region&rsquo;s member directory"}
            </p>
          </div>
          <div className="flex flex-col items-center justify-between gap-1 border-b border-t border-[#191412] px-4 py-1.5 sm:flex-row">
            <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
              {total} paid &amp; featured members listed
            </span>
            <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
              {snapshotDate || "Directory snapshot"}
            </span>
          </div>
          <div className="h-[2px] w-full bg-[#191412]" />
          <div className="h-px w-full bg-[#191412]/70" />
          <div className="h-[3px] w-full bg-[#191412]" />

          {/* Section kicker + headline */}
          <div className="flex flex-col gap-2 px-4 pt-8 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
            <span className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#a3413a]">
              {kicker || "Business Directory"}
            </span>
            <span className="text-center font-sans text-[0.7rem] text-[#191412]/70">
              {featured.length === 0
                ? "A–Z member directory"
                : `${featured.length} featured listing${featured.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="mx-auto mt-4 w-full max-w-4xl border-b border-[#191412] pb-3 text-center">
            <h2 className="font-serif text-[clamp(1.9rem,6vw,3.7rem)] font-bold leading-[0.98] tracking-tight text-[#191412]">
              {title}
            </h2>
          </div>

          {/* Section tabs (A–Z bands) */}
          <nav className="grid grid-cols-3 gap-2.5 px-4 py-4" aria-label="Classified sections">
            {tabRanges.length > 0 ? (
              tabRanges.map((range) => (
                <a
                  key={range.from}
                  href={`#classified-${range.letters[0]}`}
                  className="border border-[#191412] bg-[#191412] px-3 py-2 text-center font-sans text-[clamp(15px,2vw,22px)] font-extrabold uppercase tracking-[0.1em] text-[#fdfdfb] transition-colors hover:bg-[#a3413a]"
                >
                  {range.letters.length === 1
                    ? range.letters[0]
                    : `${range.letters[0]}\u2013${range.letters[range.letters.length - 1]}`}
                </a>
              ))
            ) : (
              <>
                <span className="border border-[#191412] bg-[#191412] px-3 py-2 text-center font-sans text-[clamp(14px,2vw,19px)] font-extrabold uppercase tracking-[0.1em] text-[#fdfdfb]">
                  Paid Members
                </span>
                <span className="border border-[#191412] bg-[#191412] px-3 py-2 text-center font-sans text-[clamp(14px,2vw,19px)] font-extrabold uppercase tracking-[0.1em] text-[#fdfdfb]">
                  Featured
                </span>
                <span className="border border-[#191412] bg-[#191412] px-3 py-2 text-center font-sans text-[clamp(14px,2vw,19px)] font-extrabold uppercase tracking-[0.1em] text-[#fdfdfb]">
                  Snapshot
                </span>
              </>
            )}
          </nav>

          {/* Main multi-column area */}
          <main className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_230px]">
            {/* Left sidebar: A–Z index + directory info */}
            <aside className="order-2 lg:order-1 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" aria-label="A-Z index">
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

              {sortedTags.length > 0 ? (
                <section className="mt-4 border border-[#191412]">
                  <div className="border-b border-[#191412] bg-[#191412] px-2 py-2 text-center font-sans text-sm font-extrabold uppercase tracking-[0.14em] text-[#fdfdfb]">
                    Browse by Category
                  </div>
                  <div className="p-2.5 text-[11.5px] leading-snug">
                    <ul className="list-none p-0 space-y-0.5">
                      {sortedTags.map(([tag, count]) => (
                        <li key={tag} className="flex items-baseline justify-between gap-1 border-b border-dotted border-[#191412]/15 py-0.5 last:border-0">
                          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-[#191412]/70">
                            {tag}
                          </span>
                          <span className="font-sans text-[9px] tabular-nums text-[#191412]/40">
                            {count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ) : null}
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
                    <PortraitTile
                      name={featured[0].name}
                      image={featured[0].image}
                      className="mx-auto mb-2 h-16 w-16 rounded-[2px] border border-[#191412]/15 text-[22px]"
                    />
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
                    {featured[0].bio ? (
                      <p className="mt-1 line-clamp-3 text-[#191412]/75">{featured[0].bio}</p>
                    ) : null}
                    {featured[0].tags && featured[0].tags.length > 0 ? (
                      <p className="mt-1 font-sans text-[9px] font-semibold uppercase tracking-[0.1em] text-[#191412]/50">
                        {featured[0].tags.join(' · ')}
                      </p>
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
                    {featured[0].links &&
                    (featured[0].links.linkedin ||
                      featured[0].links.instagram ||
                      featured[0].links.twitter) ? (
                      <p className="mt-1 text-[#a3413a]">
                        {(
                          [
                            ['LinkedIn', featured[0].links.linkedin],
                            ['Instagram', featured[0].links.instagram],
                            ['Twitter', featured[0].links.twitter],
                          ] as const
                        )
                          .filter((pair) => pair[1])
                          .map(([label, href], index, arr) => (
                            <span key={label}>
                              {index > 0 ? (
                                <span className="text-[#191412]/30"> · </span>
                              ) : null}
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="underline underline-offset-2 hover:opacity-80"
                              >
                                {label}
                              </a>
                            </span>
                          ))}
                      </p>
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