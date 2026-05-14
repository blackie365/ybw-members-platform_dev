'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Event, EVENT_TYPE_LABELS, formatEventTime, isEventPast, isEventFull, getAvailableSpots } from '@/lib/events';
import { Calendar, Clock, MapPin, Monitor, ArrowRight } from 'lucide-react';

interface EventCardProps {
  event: Event;
  compact?: boolean;
}

export function EventCard({ event, compact = false }: EventCardProps) {
  const isPast = isEventPast(event.endDate);
  const isFull = isEventFull(event);
  const availableSpots = getAvailableSpots(event);
  
  const startDate = new Date(event.startDate);
  const month = startDate.toLocaleDateString('en-GB', { month: 'short' });
  const day = startDate.getDate();

  if (compact) {
    return (
      <Link
        href={`/events/${event.slug}`}
        className="group flex items-center gap-4 rounded-lg p-3 hover:bg-muted/50 transition-colors"
      >
        {/* Date Box */}
        <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-accent/10 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">{month}</span>
          <span className="text-xl font-bold text-accent">{day}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground group-hover:text-accent transition-colors truncate">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {formatEventTime(event.startDate)} · {event.isVirtual ? 'Online' : event.city || event.location}
          </p>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
      </Link>
    );
  }

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block h-full overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-accent/30 hover:shadow-lg"
    >
      {/* Cover Image */}
      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
        {event.coverImage ? (
          <Image
            src={event.coverImage}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-accent/5 flex items-center justify-center">
            <Calendar className="h-12 w-12 text-accent/20" />
          </div>
        )}

        {/* Event Type Badge */}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center rounded-full bg-card/95 backdrop-blur-sm px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground shadow-sm">
            {EVENT_TYPE_LABELS[event.eventType]}
          </span>
        </div>

        {/* Status Badges */}
        <div className="absolute top-4 right-4 flex gap-2">
          {isPast && (
            <span className="inline-flex items-center rounded-full bg-muted/90 backdrop-blur-sm px-3 py-1.5 text-[10px] font-medium text-muted-foreground">
              Past event
            </span>
          )}
          {!isPast && isFull && (
            <span className="inline-flex items-center rounded-full bg-destructive px-3 py-1.5 text-[10px] font-semibold text-white">
              Sold out
            </span>
          )}
          {event.isPremiumOnly && (
            <span className="inline-flex items-center rounded-full bg-amber-500 px-3 py-1.5 text-[10px] font-semibold text-white">
              Premium
            </span>
          )}
        </div>

        {/* Date Box Overlay */}
        <div className="absolute bottom-4 left-4 w-14 h-16 rounded-lg bg-card/95 backdrop-blur-sm shadow-lg flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">{month}</span>
          <span className="text-2xl font-bold text-foreground">{day}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-serif text-lg font-medium text-foreground transition-colors group-hover:text-accent line-clamp-2">
          {event.title}
        </h3>

        {event.shortDescription && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {event.shortDescription}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {/* Time */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{formatEventTime(event.startDate)}</span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5">
            {event.isVirtual ? (
              <>
                <Monitor className="h-4 w-4" />
                <span>Online</span>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" />
                <span className="truncate max-w-[100px]">{event.city || event.location}</span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-5 border-t border-border flex items-center justify-between">
          {/* Price */}
          <div>
            {event.isFree ? (
              <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                Free
              </span>
            ) : (
              <span className="text-sm font-semibold text-foreground">
                £{event.price?.toFixed(2)}
              </span>
            )}
          </div>

          {/* Spots or CTA */}
          {!isPast && (
            <div className="text-sm">
              {isFull ? (
                <span className="text-muted-foreground">Join waitlist</span>
              ) : availableSpots !== null && availableSpots <= 10 ? (
                <span className="font-medium text-amber-600">{availableSpots} spots left</span>
              ) : (
                <span className="flex items-center gap-1 font-medium text-accent group-hover:gap-2 transition-all">
                  Register <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default EventCard;
