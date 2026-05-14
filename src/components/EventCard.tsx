'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Event, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, formatEventDate, formatEventTime, isEventPast, isEventFull, getAvailableSpots } from '@/lib/events';

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
          <span className="text-xs font-medium text-accent uppercase">{month}</span>
          <span className="text-lg font-bold text-accent">{day}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground group-hover:text-accent transition-colors truncate">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {formatEventTime(event.startDate)} &middot; {event.isVirtual ? 'Online' : event.city || event.location}
          </p>
        </div>

        {/* Arrow */}
        <svg className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block overflow-hidden rounded-xl bg-card border border-border hover:border-accent/50 hover:shadow-lg transition-all"
    >
      {/* Cover Image */}
      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
        {event.coverImage ? (
          <Image
            src={event.coverImage}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
            <svg className="h-12 w-12 text-accent/30" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
        )}

        {/* Event Type Badge */}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${EVENT_TYPE_COLORS[event.eventType]}`}>
            {EVENT_TYPE_LABELS[event.eventType]}
          </span>
        </div>

        {/* Status Badges */}
        <div className="absolute top-3 right-3 flex gap-2">
          {isPast && (
            <span className="inline-flex items-center rounded-full bg-muted/90 backdrop-blur px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Past event
            </span>
          )}
          {!isPast && isFull && (
            <span className="inline-flex items-center rounded-full bg-destructive/90 backdrop-blur px-2.5 py-1 text-xs font-medium text-white">
              Sold out
            </span>
          )}
          {event.isPremiumOnly && (
            <span className="inline-flex items-center rounded-full bg-amber-500/90 backdrop-blur px-2.5 py-1 text-xs font-medium text-white">
              Premium
            </span>
          )}
        </div>

        {/* Date Box Overlay */}
        <div className="absolute bottom-3 left-3 w-14 h-14 rounded-lg bg-background/95 backdrop-blur shadow-lg flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-accent uppercase">{month}</span>
          <span className="text-lg font-bold text-foreground">{day}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-2">
          {event.title}
        </h3>

        {event.shortDescription && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {event.shortDescription}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {/* Time */}
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatEventTime(event.startDate)}</span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5">
            {event.isVirtual ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
                <span>Online</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="truncate">{event.city || event.location}</span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          {/* Price */}
          <div>
            {event.isFree ? (
              <span className="text-sm font-medium text-green-600">Free</span>
            ) : (
              <span className="text-sm font-medium text-foreground">
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
                <span className="text-amber-600 font-medium">{availableSpots} spots left</span>
              ) : (
                <span className="text-accent font-medium group-hover:underline">Register now</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default EventCard;
