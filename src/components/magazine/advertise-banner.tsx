import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { formatPrice, getSlot } from "@/features/advertising/domain/slot-catalogue";

// Prominent house advert for the shop, sat directly beneath the hero.
// Prices come from the same catalogue the /advertise shop sells from, so the
// two can never drift apart.

const RATE_ROWS: ReadonlyArray<{ key: string; name: string }> = [
  { key: "directory-listing", name: "Directory" },
  { key: "classified-ad", name: "Classified" },
  { key: "advertorial", name: "Advertorial" },
  { key: "ad-full", name: "Full page" },
  { key: "ad-half", name: "Half page" },
  { key: "ad-quarter", name: "Quarter page" },
];

export function AdvertiseBanner() {
  const rates = RATE_ROWS.flatMap(({ key, name }) => {
    const slot = getSlot(key);
    return slot ? [{ key, name, price: formatPrice(slot.pricePence) }] : [];
  });

  if (rates.length === 0) return null;

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
              View the rates and book space
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <dl className="grid w-full shrink-0 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:w-auto lg:grid-cols-3">
            {rates.map((rate) => (
              <div key={rate.key} className="border-t-2 border-accent/30 pt-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {rate.name}
                </dt>
                <dd className="mt-1 font-serif text-xl leading-none">{rate.price}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
