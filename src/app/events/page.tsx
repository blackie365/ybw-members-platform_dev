import { Suspense } from 'react';
import { adminDb } from '@/lib/firebase-admin';
import { Event, EVENT_TYPE_LABELS, EventType } from '@/lib/events';
import { EventCard } from '@/components/EventCard';
import Link from 'next/link';

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

    // Filter by type if specified (client-side since Firestore needs index)
    if (type && type in EVENT_TYPE_LABELS) {
      events = events.filter((e) => e.eventType === type);
    }

    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

function EventsLoadingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="animate-pulse rounded-xl bg-card border border-border overflow-hidden">
          <div className="aspect-[16/9] bg-muted" />
          <div className="p-4 space-y-3">
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
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <h3 className="font-serif text-xl font-semibold text-foreground">
          No {view === 'past' ? 'past' : 'upcoming'} events
        </h3>
        <p className="mt-2 text-muted-foreground">
          {view === 'past'
            ? "We don't have any past events to show yet."
            : 'Check back soon for new events, or browse our past events.'}
        </p>
        {view === 'upcoming' && (
          <Link
            href="/events?view=past"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
          >
            View past events
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
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
      <section className="bg-gradient-to-b from-accent/5 to-background py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground">
              Events
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Connect with fellow businesswomen at our networking events, workshops, 
              and conferences across Yorkshire and online.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-border bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <Link
                href="/events?view=upcoming"
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'upcoming'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Upcoming
              </Link>
              <Link
                href="/events?view=past"
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'past'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Past Events
              </Link>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
              <Link
                href={`/events?view=${view}`}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !selectedType
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </Link>
              {eventTypes.map(([type, label]) => (
                <Link
                  key={type}
                  href={`/events?view=${view}&type=${type}`}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedType === type
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
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
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<EventsLoadingSkeleton />}>
            <EventsList searchParams={params} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
