import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";

// Prominent house advert for the shop, sat directly beneath the hero.
// Deliberately price-free: the formats are shown as proportional page shapes
// so the band reads as an invitation rather than a rate card.

const FORMATS: ReadonlyArray<{ label: string; area: string }> = [
  { label: "Full page", area: "inset-0" },
  { label: "Half page", area: "inset-x-0 bottom-0 h-1/2" },
  { label: "Quarter page", area: "bottom-0 right-0 h-1/2 w-1/2" },
];

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

          <div className="flex w-full shrink-0 items-end justify-center gap-5 sm:gap-8 lg:w-auto">
            {FORMATS.map((format) => (
              <figure key={format.label} className="flex flex-col items-center gap-3">
                <div
                  className="relative w-16 overflow-hidden rounded-sm border border-border bg-background shadow-sm sm:w-20"
                  style={{ aspectRatio: "170 / 247" }}
                >
                  <div className={`absolute bg-accent/90 ${format.area}`} aria-hidden />
                </div>
                <figcaption className="text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {format.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
