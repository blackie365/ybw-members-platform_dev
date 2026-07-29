"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BellRing, MapPin } from "lucide-react";
import { format } from "date-fns";

import {
  EventInterestPopover,
  clearEventPopupMemory,
  hasRecentlyDismissed,
  hasRecentlySubmittedInterest,
  markHomepageEventAutoTrigger,
} from "@/components/events/EventInterestPopover";

const HOMEPAGE_AUTO_TRIGGER_DELAY_MS = 5_000;

function hasHomepagePreviewQuery(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("hp_event_preview") === "1";
  } catch {
    return false;
  }
}

interface GhostPost {
  id: string
  title: string
  slug: string
  feature_image?: string
  published_at: string
  custom_excerpt?: string
  excerpt?: string
  primary_tag?: {
    name: string
    slug: string
  }
}

export function LatestEvents({ events }: { events: GhostPost[] }) {
  const [activeEvent, setActiveEvent] = useState<GhostPost | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const topEvent = events && events.length > 0 ? events[0] : null;

  // Homepage soft auto-trigger: 5s after the first visitor lands on the homepage,
  // surface a translucent Instagram-style interest pop-up for the featured upcoming event.
  // Honours dismissed/submitted cooldowns, and bypasses them when ?hp_event_preview=1
  // is set (clears stale memory and opens after 200ms for QA).
  useEffect(() => {
    if (!topEvent) return;
    if (autoTriggered) return;
    let mounted = true;
    let timer: number | undefined;

    const open = () => {
      if (!mounted) return;
      setAutoTriggered(true);
      setActiveEvent(topEvent);
    };

    if (hasHomepagePreviewQuery()) {
      try {
        clearEventPopupMemory(topEvent.slug);
      } catch {
        // ignore
      }
      markHomepageEventAutoTrigger();
      timer = window.setTimeout(open, 200);
      return () => {
        mounted = false;
        if (timer) window.clearTimeout(timer);
      };
    }

    timer = window.setTimeout(() => {
      if (!mounted) return;
      markHomepageEventAutoTrigger();
      try {
        if (
          hasRecentlySubmittedInterest(topEvent.slug) ||
          hasRecentlyDismissed(topEvent.slug)
        ) {
          return;
        }
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          return;
        }
        open();
      } catch {
        // ignore
      }
    }, HOMEPAGE_AUTO_TRIGGER_DELAY_MS);

    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [topEvent, autoTriggered]);

  if (!events || events.length === 0) return null;

  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="font-serif text-2xl font-medium leading-tight"
            >
              Latest Events
            </motion.h2>
            <p className="mt-2 text-sm text-primary-foreground/60">
              Connect, learn, and grow with fellow businesswomen across Yorkshire.
            </p>
          </div>

          <Link
            href="/news?tag=events"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/60 hover:text-accent transition-colors"
          >
            View All Events
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {events.map((event, index) => {
            const dateLabel = event.published_at
              ? format(new Date(event.published_at), "MMM d, yyyy")
              : "TBA";
            return (
              <motion.article
                key={event.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="group border border-primary-foreground/10 bg-primary-foreground/5 transition-all duration-300 hover:bg-primary-foreground/10"
              >
                <Link href={`/news/${event.slug}`} className="flex flex-col h-full">
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={event.feature_image || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80"}
                      alt={event.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      sizes="(min-width: 768px) 33vw, 100vw"
                    />
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-primary-foreground/40">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wider text-accent">
                        {dateLabel}
                      </span>
                    </div>

                    <h3 className="mt-4 font-serif text-xl font-medium leading-snug group-hover:text-accent transition-colors line-clamp-2">
                      {event.title}
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-primary-foreground/60 line-clamp-2 flex-1">
                      {event.custom_excerpt || event.excerpt || "Join us for networking and professional growth."}
                    </p>

                    <div className="mt-6 flex items-center justify-between pt-4 border-t border-primary-foreground/10">
                      <span className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
                        <MapPin className="h-3.5 w-3.5" />
                        Yorkshire
                      </span>
                      <ArrowRight className="h-4 w-4 text-primary-foreground/40 transition-all group-hover:text-accent group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>

                <div className="px-6 pb-6">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveEvent(event);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-4 py-2.5 text-xs font-semibold tracking-wide text-primary-foreground transition-colors hover:bg-primary-foreground/10 hover:text-accent"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    Get event updates
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>

      {activeEvent && (
        <EventInterestPopover
          eventId={activeEvent.slug}
          eventTitle={activeEvent.title}
          eventImage={activeEvent.feature_image}
          eventDateLabel={
            activeEvent.published_at
              ? format(new Date(activeEvent.published_at), "MMM d, yyyy")
              : undefined
          }
          eventLocation="Yorkshire"
          eventSlug={activeEvent.slug}
          eventGhostId={activeEvent.id}
          open={Boolean(activeEvent)}
          onOpenChange={(next) => setActiveEvent(next ? activeEvent : null)}
          sourceLabel="Event updates"
        />
      )}
    </section>
  )
}
