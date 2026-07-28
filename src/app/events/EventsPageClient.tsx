"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ArrowRight, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/EventCard";
import { Event, EVENT_TYPE_LABELS } from "@/lib/events";
import {
  EventInterestPopover,
  EventInterestPrice,
  hasRecentlyDismissed,
  hasRecentlySubmittedInterest,
} from "@/components/events/EventInterestPopover";
import { getEventMetadata } from "@/app/actions/eventActions";

export default function EventsPageClient({ initialEvents }: { initialEvents: Event[] }) {
  const events = initialEvents || [];
  const upcoming = useMemo(
    () => events.filter((e) => new Date(e.endDate || e.startDate) >= new Date()),
    [events],
  );
  const past = useMemo(
    () => events.filter((e) => new Date(e.endDate || e.startDate) < new Date()),
    [events],
  );

  const nextEvent = upcoming[0] || events[0] || null;

  const [pricesByEventId, setPricesByEventId] = useState<
    Record<string, EventInterestPrice>
  >({});
  const [priceLoading, setPriceLoading] = useState(true);
  const [autoTriggerOpen, setAutoTriggerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const out: Record<string, EventInterestPrice> = {};
      await Promise.all(
        events.map(async (ev) => {
          try {
            const meta = await getEventMetadata(ev.id);
            const data = meta?.data || undefined;
            const enabled = data?.ticketCardEnabled === true;
            const memberPriceMinor =
              typeof data?.memberPrice === "number" ? data.memberPrice * 100 : undefined;
            const standardPriceMinor =
              typeof data?.price === "number" ? data.price * 100 : undefined;

            if (
              typeof standardPriceMinor === "number" ||
              typeof memberPriceMinor === "number"
            ) {
              const standard = typeof standardPriceMinor === "number" ? standardPriceMinor : 0;
              const member =
                typeof memberPriceMinor === "number" ? memberPriceMinor : standard;
              const isFree = enabled && member === 0 && standard === 0;
              const display = isFree
                ? "Free"
                : new Intl.NumberFormat("en-GB", {
                    style: "currency",
                    currency: "GBP",
                    maximumFractionDigits: 2,
                  }).format((member || standard) / 100);
              out[ev.id] = {
                amount: member || standard,
                standardAmount: standard,
                display,
                isFree,
                hasMemberDiscount:
                  typeof memberPriceMinor === "number" &&
                  typeof standardPriceMinor === "number" &&
                  memberPriceMinor < standardPriceMinor,
                source: "firestore",
              };
            }
          } catch (err) {
            console.warn(`Failed to resolve metadata for ${ev.id}`, err);
          }
        }),
      );
      if (!cancelled) {
        setPricesByEventId(out);
        setPriceLoading(false);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [events]);

  // Soft auto-trigger: once, after 30s dwell, only for the most upcoming event.
  useEffect(() => {
    if (!nextEvent) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      if (!mounted) return;
      try {
        if (
          hasRecentlySubmittedInterest(nextEvent.id) ||
          hasRecentlyDismissed(nextEvent.id)
        ) {
          return;
        }
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          return;
        }
        setAutoTriggerOpen(true);
      } catch {
        // ignore
      }
    }, 30_000);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [nextEvent]);

  const nextPrice = nextEvent ? pricesByEventId[nextEvent.id] : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent/40 opacity-60" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              Yorkshire BusinessWoman
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl">
              Events across Yorkshire
            </h1>
            <p className="mt-4 text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
              Lunches, showcases, networking and masterclasses — crafted to connect
              ambitious women in business. Join one list and never miss a new date.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full bg-[#A3413A] px-6 text-white shadow-sm hover:bg-[#A3413A]/90">
                <a href="#upcoming">
                  See upcoming events
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-primary-foreground/20 bg-white/5 text-sm text-white hover:bg-white/10"
              >
                <Link href="/news?tag=events">
                  Read event stories
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {nextEvent && (
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#A3413A]">
                  Next event
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                  {nextEvent.title}
                </h2>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-stone-900/10 bg-stone-900/5 px-3 py-1 text-xs font-medium text-stone-700">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(nextEvent.startDate), "EEE, MMM d · h:mm a")}
              </span>
            </div>

            <Card className="overflow-hidden border-none shadow-[0_20px_60px_-30px_rgba(12,10,9,0.35)]">
              <div className="grid grid-cols-1 overflow-hidden lg:grid-cols-[1.1fr_1fr]">
                <div className="relative min-h-[240px] bg-muted">
                  {nextEvent.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={nextEvent.image}
                      alt={nextEvent.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#A3413A]/70 via-accent/40 to-stone-200" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute left-5 bottom-5 right-5 flex flex-wrap items-end justify-between gap-3 text-white">
                    <div>
                      <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium backdrop-blur-md">
                        {EVENT_TYPE_LABELS[nextEvent.eventType]}
                      </span>
                      <p className="mt-3 text-sm text-white/80">
                        {[
                          format(new Date(nextEvent.startDate), "EEE, MMM d, yyyy"),
                          format(new Date(nextEvent.startDate), "h:mm a"),
                          nextEvent.location,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {nextPrice && (
                      <span className="inline-flex items-center rounded-full border border-white/30 bg-white/85 px-3 py-1 text-xs font-semibold text-stone-900 shadow-sm backdrop-blur-md">
                        {nextPrice.isFree ? "Free" : `From ${nextPrice.display}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-between p-7">
                  <div>
                    <p className="font-serif italic leading-[1.45] text-[#A3413A]"
                      style={{ fontSize: "clamp(1.05rem, 2vw, 1.45rem)" }}
                    >
                      {nextEvent.description ||
                        "A curated, intimate gathering — for women who mean business, without the noise."}
                    </p>
                  </div>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      onClick={() => setAutoTriggerOpen(true)}
                      className="h-12 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white hover:bg-stone-900/90"
                    >
                      {nextPrice
                        ? nextPrice.isFree
                          ? "Register for free"
                          : nextEvent.ticketCardEnabled === true
                            ? "Reserve a spot"
                            : "Get event updates"
                        : "Get event updates"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      asChild
                      className="h-12 rounded-full"
                    >
                      <Link href="/news?tag=events">
                        Browse event write-ups
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

      <section id="upcoming" className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#A3413A]">
                Upcoming
              </p>
              <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                Save the date
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                {priceLoading
                  ? "Loading pricing and availability…"
                  : "Tap a card to be the first to hear about tickets, or book directly when booking is open."}
              </p>
            </div>
            <Button variant="outline" asChild className="h-11 rounded-full">
              <Link href="/news?tag=events">
                All events
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {upcoming.length === 0 ? (
            <Card className="border-dashed bg-background px-6 py-12 text-center text-sm text-muted-foreground">
              More dates coming soon. Drop your email above and we&apos;ll let you know first.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((ev) => (
                <EventCard key={ev.id} event={ev} price={pricesByEventId[ev.id]} />
              ))}
            </div>
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section className="border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Past events
              </p>
              <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                Recent gatherings
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Read the stories and galleries from our most recent events across Yorkshire.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {past.map((ev) => (
                <EventCard key={ev.id} event={ev} price={pricesByEventId[ev.id]} />
              ))}
            </div>
          </div>
        </section>
      )}

      {nextEvent && (
        <EventInterestPopover
          eventId={nextEvent.id}
          eventTitle={nextEvent.title}
          eventImage={nextEvent.image}
          eventDateLabel={`${format(new Date(nextEvent.startDate), "EEE, MMM d, yyyy")} · ${format(new Date(nextEvent.startDate), "h:mm a")}`}
          eventLocation={nextEvent.location}
          eventSlug={nextEvent.id}
          eventGhostId={nextEvent.id}
          open={autoTriggerOpen}
          onOpenChange={setAutoTriggerOpen}
          initialMode={
            nextPrice?.isFree
              ? "payment"
              : nextEvent.ticketCardEnabled === true && nextPrice
                ? "payment"
                : "interest"
          }
          price={nextPrice}
          sourceLabel="Save the date"
        />
      )}
    </div>
  );
}
