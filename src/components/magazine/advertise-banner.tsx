import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";

// Prominent house advert for the shop, sat directly beneath the hero.
// Deliberately price-free: each format is drawn as a magazine page at the real
// 170 x 247 mm trim ratio, with the advertiser's space filled in the house
// accent, so the band reads as an invitation rather than a rate card.

const PAGE_W = 170;
const PAGE_H = 247;

type AdArea = { x: number; y: number; w: number; h: number };

const FORMATS: ReadonlyArray<{ label: string; note: string; ad: AdArea }> = [
  { label: "Full page", note: "the whole page", ad: { x: 0, y: 0, w: PAGE_W, h: PAGE_H } },
  {
    label: "Half page",
    note: "the lower half",
    ad: { x: 0, y: PAGE_H / 2, w: PAGE_W, h: PAGE_H / 2 },
  },
  {
    label: "Quarter page",
    note: "a quarter panel",
    ad: { x: PAGE_W / 2, y: PAGE_H / 2, w: PAGE_W / 2, h: PAGE_H / 2 },
  },
];

// Ragged right edges, so the miniature body type looks set rather than striped.
const LINE_WIDTHS = [1, 0.96, 1, 0.9, 1, 1, 0.94, 1, 0.88, 1, 0.97, 1, 0.92, 1, 1, 0.86];

const COLUMNS = [
  { x: 12, w: 68 },
  { x: 90, w: 68 },
];

const LINE_TOP = 112;
const LINE_PITCH = 6.6;
const LINE_H = 2.4;

const PAPER = { fill: "var(--background)" };
const INK = { fill: "var(--foreground)" };
const GREY = { fill: "var(--muted-foreground)" };

// The advert drawn on top of the page — a picture block, a headline, a few
// lines of copy and a logo mark, sized as fractions of the space it occupies.
function AdvertSpace({ ad }: { ad: AdArea }) {
  const pad = Math.max(6, Math.min(ad.w, ad.h) * 0.1);
  const innerX = ad.x + pad;
  const innerW = ad.w - pad * 2;
  const logoH = Math.max(6, ad.h * 0.05);

  return (
    <g>
      <rect
        x={ad.x}
        y={ad.y}
        width={ad.w}
        height={ad.h}
        style={{ fill: "var(--accent)" }}
      />

      <rect
        x={innerX}
        y={ad.y + ad.h * 0.12}
        width={innerW}
        height={ad.h * 0.3}
        rx="1"
        style={{ fill: "#ffffff", fillOpacity: 0.9 }}
      />
      <rect
        x={innerX}
        y={ad.y + ad.h * 0.5}
        width={innerW * 0.72}
        height={Math.max(3.5, ad.h * 0.035)}
        style={{ fill: "#ffffff" }}
      />
      <rect
        x={innerX}
        y={ad.y + ad.h * 0.575}
        width={innerW * 0.95}
        height={Math.max(1.8, ad.h * 0.014)}
        style={{ fill: "#ffffff", fillOpacity: 0.75 }}
      />
      <rect
        x={innerX}
        y={ad.y + ad.h * 0.61}
        width={innerW * 0.86}
        height={Math.max(1.8, ad.h * 0.014)}
        style={{ fill: "#ffffff", fillOpacity: 0.75 }}
      />
      <rect
        x={innerX}
        y={ad.y + ad.h * 0.645}
        width={innerW * 0.6}
        height={Math.max(1.8, ad.h * 0.014)}
        style={{ fill: "#ffffff", fillOpacity: 0.75 }}
      />
      <rect
        x={innerX}
        y={ad.y + ad.h - pad - logoH}
        width={innerW * 0.3}
        height={logoH}
        rx="1"
        style={{ fill: "#ffffff", fillOpacity: 0.85 }}
      />
    </g>
  );
}

function PagePreview({ ad }: { ad: AdArea }) {
  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} className="h-auto w-full" aria-hidden focusable="false">
      <rect x="0.5" y="0.5" width={PAGE_W - 1} height={PAGE_H - 1} style={PAPER} />

      {/* Masthead and rule */}
      <rect {...INK} x="12" y="14" width="46" height="6" />
      <rect {...GREY} x="12" y="24" width="26" height="2" />
      <rect {...GREY} x="120" y="16" width="38" height="2" />
      <rect {...GREY} x="132" y="21" width="26" height="2" />
      <rect {...INK} x="12" y="31" width="146" height="1.2" />

      {/* Lead picture */}
      <rect
        x="12"
        y="38"
        width="146"
        height="58"
        style={{ fill: "var(--muted-foreground)", fillOpacity: 0.16 }}
      />
      <g style={{ fill: "var(--muted-foreground)", fillOpacity: 0.45 }}>
        <circle cx="42" cy="58" r="7" />
        <path d="M12 96 L48 64 L74 96 Z" />
        <path d="M62 96 L98 70 L134 96 Z" />
      </g>
      <rect {...GREY} x="12" y="100" width="58" height="1.6" style={{ fillOpacity: 0.5 }} />

      {/* Body type */}
      {COLUMNS.map((col) =>
        LINE_WIDTHS.map((factor, i) => (
          <rect
            key={`${col.x}-${i}`}
            x={col.x}
            y={LINE_TOP + i * LINE_PITCH}
            width={col.w * factor}
            height={LINE_H}
            style={{ fill: "var(--muted-foreground)", fillOpacity: 0.4 }}
          />
        )),
      )}

      <AdvertSpace ad={ad} />

      {/* Page edge, drawn last so it survives a full-page advert */}
      <rect
        x="0.7"
        y="0.7"
        width={PAGE_W - 1.4}
        height={PAGE_H - 1.4}
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.18"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function AdvertiseBanner() {
  return (
    <section
      aria-labelledby="advertise-banner-heading"
      className="border-y border-border bg-secondary text-secondary-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
              <Megaphone className="h-3.5 w-3.5" aria-hidden />
              Advertise with us
            </p>
            <h2
              id="advertise-banner-heading"
              className="mt-4 font-serif text-3xl font-medium leading-tight text-balance md:text-4xl"
            >
              Put your business in front of Yorkshire&apos;s businesswomen
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Space is open in the next printed edition — a directory listing, a classified
              advert, or display pages. Every booking is placed on a real page, in front of a
              real reader.
            </p>
            <Link
              href="/advertise"
              className="group mt-7 inline-flex items-center gap-3 bg-accent px-7 py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Book your space
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="flex w-full shrink-0 items-end justify-center gap-6 sm:gap-9 lg:w-auto">
            {FORMATS.map((format) => (
              <figure key={format.label} className="w-24 sm:w-32">
                <PagePreview ad={format.ad} />
                <figcaption className="mt-3 text-center">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">
                    {format.label}
                  </span>
                  <span className="mt-1 block font-serif text-[11px] italic text-muted-foreground">
                    {format.note}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
