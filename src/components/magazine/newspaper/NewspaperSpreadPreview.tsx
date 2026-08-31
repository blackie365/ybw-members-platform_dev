"use client";

/**
 * NEWSPAPER SPREAD — PROtotype (pure Tailwind, classic broadsheet).
 *
 * Art direction: classic broadsheet. White paper, ink-black serif headlines,
 * hairline rules, generous whitespace, a drop-cap lead, justified multi-column
 * body, floating pull-quotes, and a folio. Built 100% on Tailwind utilities
 * using only default breakpoints (sm/md/lg/xl) and the project's already-loaded
 * faces: `font-serif` = Playfair Display, `font-sans` = Inter.
 *
 * This is a standalone prototype using the REAL feature view-model field names
 * (title, kicker, name, intro, text, pullQuotes, stats, featureImage) so it can
 * be wired into the reader with minimal change.
 */

const DEMO_DATA = {
  title: "The quiet reinvention of St Peter's School",
  kicker: "Education · Summer 2026",
  name: "By Ella Hartshorne",
  intro:
    "This milestone marked the beginning of co-education at St Peter's School, a pivotal moment in a 1,500-year story that has quietly positioned York's oldest school for its next chapter.",
  text: `Twelve hundred years ago, a king's son chose the site beside the River Ouse and planted a school that would outlive empires. Today, the gates open on the closing of one argument and the opening of another: what a centuries-old institution owes to the young people walking through them now.

The head, arriving with a decade of plans and a single conviction, has set about disassembling the received wisdom of the old house. Uniforms have relaxed. The chapel no longer stands at the centre of every assembly. The timetable bends around the child rather than the other way round.

It is a delicate operation, because a school like this is not a business to be re-engineered overnight. It is a sandstone conversation between generations, and every wall has an opinion. What has changed, the staff argue, is not the building but the logic of it: the school now starts from the question of what a pupil needs, and works backwards.

Sceptics ask whether tradition can survive reform without quietly becoming something else. The counters are gentle. The archives show the school has been reinventing itself since the ninth century, and each reinvention was described at the time as the end of everything that mattered.

What is different this time is confidence. There is an ease in the corridors that was not there a decade ago. The pupils move with the particular lightness of institutions that have stopped trying to prove themselves.`,
  pullQuotes: [
    "“The school now starts from the question of what a pupil needs, and works backwards.”",
    "“A school like this is a sandstone conversation between generations.”",
  ],
  stats: [
    { value: "1,500", label: "years of history" },
    { value: "52%", label: "increase in applications" },
    { value: "11+", label: "co-ed year groups" },
  ],
  featureImage: "",
};

function Paper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#fdfdfb] text-[#191412] ${className}`}>
      {children}
    </div>
  );
}

function Hairline({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-[#191412]/25 ${className}`} aria-hidden="true" />;
}

export default function NewspaperSpreadPreview() {
  return (
    <Paper className="min-h-screen py-8 sm:py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        {/* ── Masthead band ─────────────────────────────── */}
        <header className="flex items-center justify-between gap-4 pb-2">
          <span className="text-[0.6rem] font-sans font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            Issue 12 · Summer 2026
          </span>
          <span className="text-[0.6rem] font-sans font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            Yorkshire BusinessWoman
          </span>
        </header>
        <Hairline />
        <div className="py-3 text-center">
          <h1 className="font-serif text-[clamp(1.6rem,5.5vw,3.2rem)] leading-none tracking-tight text-[#191412]">
            Yorkshire <span className="italic">Business</span>Woman
          </h1>
          <p className="mt-1.5 font-sans text-[0.6rem] uppercase tracking-[0.34em] text-[#191412]/50 sm:text-[0.65rem]">
            A broadsheet for the region&rsquo;s founders &amp; leaders
          </p>
        </div>
        <Hairline />
        <div className="flex flex-col items-center justify-between gap-1 py-2 sm:flex-row">
          <span className="font-sans text-[0.65rem] text-[#191412]/60">
            The finest of its kind, printed without apology
          </span>
          <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
            Vol. 12 · No. 12
          </span>
        </div>
        <Hairline className="border-[#191412]/60" />

        {/* ── Kicker + Byline ───────────────────────────── */}
        <div className="flex flex-col gap-2 pt-10 sm:flex-row sm:items-end sm:justify-between">
          <span className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#a3413a]">
            {DEMO_DATA.kicker}
          </span>
          <span className="font-sans text-[0.7rem] text-[#191412]/70">{DEMO_DATA.name}</span>
        </div>

        {/* ── Headline ──────────────────────────────────── */}
        <h2 className="mt-4 max-w-3xl font-serif text-[clamp(1.9rem,6vw,3.7rem)] leading-[1.02] tracking-tight text-[#191412]">
          {DEMO_DATA.title}
        </h2>

        {/* ── Lead with drop cap + pull quote column ────── */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          {/* Lead / body */}
          <article>
            <p className="font-serif text-[1.05rem] leading-[1.75] text-[#191412]/90 sm:text-[1.15rem] sm:leading-[1.7]">
              <span className="float-left mt-1 pr-3 font-serif text-[2.9rem] leading-[0.78] font-bold text-[#a3413a]">
                {DEMO_DATA.intro.charAt(0)}
              </span>
              {DEMO_DATA.intro.slice(1)}
            </p>

            <Hairline className="my-7" />

            {/* 2-up body on md+; 1-up on mobile */}
            <div className="columns-1 gap-10 md:columns-2 md:[column-rule:1px_solid_rgba(25,20,18,0.18)]">
              {DEMO_DATA.text.split("\n").map((para, i) => (
                <p
                  key={i}
                  className="mb-5 font-sans text-[0.98rem] leading-[1.8] text-[#191412]/86 first:mt-0 last:mb-0"
                >
                  {para}
                </p>
              ))}
            </div>
          </article>

          {/* Pull-quote rail */}
          <aside className="flex flex-col gap-8 border-t-[3px] border-[#191412] pt-6 lg:border-t-0 lg:pt-0 lg:pl-10 lg:[border-left:1px_solid_rgba(25,20,18,0.2)]">
            <p className="font-serif text-[1.25rem] leading-[1.4] text-[#191412] lg:text-[1.4rem]">
              {DEMO_DATA.pullQuotes[0]}
            </p>
            <div className="w-10 border-t-2 border-[#a3413a]" />
            <p className="font-serif text-[1.05rem] leading-[1.45] italic text-[#191412]/75">
              {DEMO_DATA.pullQuotes[1]}
            </p>
          </aside>
        </div>

        {/* ── Stats band ────────────────────────────────── */}
        <div className="mt-12 grid grid-cols-1 gap-px border border-[#191412]/20 bg-[#191412]/20 sm:grid-cols-3">
          {DEMO_DATA.stats.map((s) => (
            <div key={s.label} className="bg-[#fdfdfb] px-5 py-5">
              <p className="font-serif text-3xl font-bold text-[#191412]">{s.value}</p>
              <p className="mt-1 font-sans text-[0.65rem] uppercase tracking-[0.22em] text-[#191412]/55">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Folio ─────────────────────────────────────── */}
        <footer className="mt-12">
          <Hairline />
          <div className="flex items-center justify-between pt-3 font-sans text-[0.65rem] uppercase tracking-[0.18em] text-[#191412]/55">
            <span>Page 7</span>
            <span className="text-[#a3413a]">◆ ybw broadsheet</span>
            <span>Summer 2026</span>
          </div>
        </footer>
      </div>
    </Paper>
  );
}
