"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, Clock, ArrowRight, Sparkles } from "lucide-react";
import { format } from "date-fns";

import { Event, EVENT_TYPE_LABELS } from "@/lib/events";
import { EventInterestPopover, EventInterestPrice } from "@/components/events/EventInterestPopover";

interface EventCardProps {
  event: Event;
  price?: EventInterestPrice;
}

export function EventCard({ event, price }: EventCardProps) {
  const startDate = new Date(event.startDate);
  const [open, setOpen] = useState(false);

  const dateLabel = format(startDate, "MMM d, yyyy");
  const timeLabel = format(startDate, "h:mm a");
  const dateTimeLabel = `${dateLabel} · ${timeLabel}`;

  const hasPaidOption = Boolean(
    price && (price.isFree || price.amount > 0 || price.standardAmount > 0),
  );

  const initialMode =
    hasPaidOption && price?.isFree
      ? "payment"
      : hasPaidOption && event.ticketCardEnabled === true
        ? "payment"
        : "interest";

  const ctaLabel = hasPaidOption
    ? price?.isFree
      ? "Register for free"
      : event.ticketCardEnabled === true
        ? "Book a spot"
        : "Get event updates"
    : "Get event updates";

  return (
    <>
      <article className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-lg">
        <div className="relative aspect-[16/9] overflow-hidden">
          {event.image ? (
            <Image
              src={event.image}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Calendar className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
              {EVENT_TYPE_LABELS[event.eventType]}
            </span>
            {hasPaidOption && event.accessLevel !== "members-only" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/50 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-stone-800 backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-[#A3413A]" />
                Direct booking
              </span>
            )}
          </div>
          {hasPaidOption && price && (
            <div className="absolute right-4 bottom-4 rounded-full border border-white/50 bg-white/85 px-3 py-1 text-xs font-semibold text-stone-900 backdrop-blur-md shadow-sm">
              {price.isFree ? "Free" : `From ${price.display}`}
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {dateLabel}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {timeLabel}
            </div>
          </div>

          <h3 className="mb-2 font-serif text-xl font-medium text-foreground line-clamp-1">
            {event.title}
          </h3>

          <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>

          <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#A3413A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A3413A]/90"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href={`/events/${event.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/5 sm:w-auto"
            >
              View details
            </Link>
          </div>
        </div>
      </article>

      <EventInterestPopover
        eventId={event.id}
        eventTitle={event.title}
        eventImage={event.image}
        eventDateLabel={dateTimeLabel}
        eventLocation={event.location}
        eventSlug={event.id}
        eventGhostId={event.id}
        open={open}
        onOpenChange={setOpen}
        initialMode={initialMode}
        price={price}
      />
    </>
  );
}
