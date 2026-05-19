import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Clock, ArrowRight } from 'lucide-react';
import { Event, EVENT_TYPE_LABELS } from '@/lib/events';
import { format } from 'date-fns';

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const startDate = new Date(event.startDate);
  
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden">
        {event.image ? (
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Calendar className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute left-4 top-4">
          <span className="inline-flex items-center rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            {EVENT_TYPE_LABELS[event.eventType]}
          </span>
        </div>
      </div>
      
      <div className="p-5">
        <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {format(startDate, 'MMM d, yyyy')}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {format(startDate, 'h:mm a')}
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
        
        <Link
          href={`/events/${event.id}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          View Details
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
