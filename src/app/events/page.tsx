import { Suspense } from 'react';
import { adminDb } from '@/lib/firebase-admin';
import { Event, EVENT_TYPE_LABELS, EventType } from '@/lib/events';
import { EventCard } from '@/components/EventCard';
import Link from 'next/link';
import { Calendar, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Events | Yorkshire Businesswoman',
  description: 'Discover networking events, workshops, and conferences for businesswomen in Yorkshire.',
};

interface SearchParams {
  type?: string;
  view?: 'upcoming' | 'past';
}

async function getEvents(searchParams: SearchParams) {
  const { type, view = 'upcoming' } = searchParams;
  const now = new Date().toISOString();

  try {
    // Check if adminDb is properly initialized with credentials
    if (!adminDb) {
      console.warn('Firebase Admin not initialized - returning empty events');
      return [];
    }
    
    // Try to access Firestore - this will throw if credentials aren't set
    let query = adminDb.collection('events').where('status', '==', 'published');

    if (view === 'upcoming') {
      query = query.where('startDate', '>=', now).orderBy('startDate', 'asc');
    } else {
      query = query.where('endDate', '<', now).orderBy('startDate', 'desc');
    }

    const snapshot = await query.limit(50).get();
    
    let events: Event[] = [];
    snapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() } as Event);
    });

    if (type && type in EVENT_TYPE_LABELS) {
      events = events.filter((e) => e.eventType === type);
    }

    return events;
  } catch (error) {
    // Log but don't throw - return empty array so page still renders
    console.warn('Error fetching events (Firebase Admin credentials may not be configured):', error instanceof Error ? error.message : error);
    return [];
  }
}

function EventsLoadingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-border bg-card">
          <div className="aspect-[16/9] bg-muted" />
          <div className="p-5 space-y-3">
            <div className="h-5 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function EventsList({ searchParams }: { searchParams: SearchParams }) {
  const events = await getEvents(searchParams);
  const view = searchParams.view || 'upcoming';

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-5">
          <Calendar className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="font-serif text-2xl font-medium text-foreground">
          No {view === 'past' ? 'past' : 'upcoming'} events
        </h3>
        <p className="mt-3 text-muted-foreground max-w-sm mx-auto">
          {view === 'past'
            ? "We don't have any past events to show yet."
            : 'Check back soon for new events, or browse our past events.'}
        </p>
        {view === 'upcoming' && (
          <Link
            href="/events?view=past"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
          >
            View past events
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = params.view || 'upcoming';
  const selectedType = params.type;

  const eventTypes = Object.entries(EVENT_TYPE_LABELS) as [EventType, string][];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-card py-16 sm:py-24">
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent" />
          <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Connect & Grow
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-foreground sm:text-5xl">
              Events
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Connect with fellow businesswomen at our networking events, workshops, 
              and conferences across Yorkshire and online.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-border bg-background sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Link
                href="/events?view=upcoming"
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  view === 'upcoming'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Upcoming
              </Link>
              <Link
                href="/events?view=past"
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  view === 'past'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Past Events
              </Link>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-thin">
              <Link
                href={`/events?view=${view}`}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  !selectedType
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                All
              </Link>
              {eventTypes.map(([type, label]) => (
                <Link
                  key={type}
                  href={`/events?view=${view}&type=${type}`}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedType === type
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<EventsLoadingSkeleton />}>
            <EventsList searchParams={params} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
