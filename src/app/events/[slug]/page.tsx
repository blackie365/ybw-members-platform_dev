import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { Event, formatEventDate, formatEventTime, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, generateICSFile } from '@/lib/events';
import Image from 'next/image';
import Link from 'next/link';
import { EventRSVPButton } from './EventRSVPButton';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const snapshot = await adminDb
    .collection('events')
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { title: 'Event Not Found' };
  }

  const event = snapshot.docs[0].data() as Event;
  
  return {
    title: `${event.title} | Yorkshire Businesswoman`,
    description: event.shortDescription || event.description.substring(0, 160),
    openGraph: {
      title: event.title,
      description: event.shortDescription || event.description.substring(0, 160),
      images: event.coverImage ? [event.coverImage] : [],
    },
  };
}

async function getEvent(slug: string): Promise<Event | null> {
  try {
    const snapshot = await adminDb
      .collection('events')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Event;
  } catch (error) {
    console.error('Error fetching event:', error);
    return null;
  }
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    notFound();
  }

  const isPast = new Date(event.endDate) < new Date();
  const isFull = event.capacity ? event.registrationCount >= event.capacity : false;
  const availableSpots = event.capacity ? Math.max(0, event.capacity - event.registrationCount) : null;

  return (
    <main className="min-h-screen bg-background">
      {/* Hero with Cover Image */}
      <section className="relative">
        <div className="h-64 sm:h-80 lg:h-96 bg-gradient-to-br from-accent/20 to-accent/5 relative overflow-hidden">
          {event.coverImage && (
            <Image
              src={event.coverImage}
              alt={event.title}
              fill
              className="object-cover"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>

        {/* Floating Info Card */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
          <div className="bg-card rounded-2xl border border-border shadow-xl p-6 sm:p-8">
            <div className="flex flex-wrap items-start gap-4 mb-4">
              {/* Event Type Badge */}
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${EVENT_TYPE_COLORS[event.eventType]}`}>
                {EVENT_TYPE_LABELS[event.eventType]}
              </span>

              {/* Status Badges */}
              {isPast && (
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                  Past event
                </span>
              )}
              {!isPast && isFull && (
                <span className="inline-flex items-center rounded-full bg-destructive px-3 py-1 text-sm font-medium text-white">
                  Sold out
                </span>
              )}
              {event.isPremiumOnly && (
                <span className="inline-flex items-center rounded-full bg-amber-500 px-3 py-1 text-sm font-medium text-white">
                  Premium members only
                </span>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
              {event.title}
            </h1>

            {event.shortDescription && (
              <p className="mt-3 text-lg text-muted-foreground">
                {event.shortDescription}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Description */}
              <div className="bg-card rounded-xl border border-border p-6 sm:p-8">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
                  About this event
                </h2>
                <div className="prose prose-stone max-w-none text-muted-foreground">
                  {event.description.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {/* Organizer */}
              {event.organizerName && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
                    Hosted by
                  </h2>
                  <div className="flex items-center gap-4">
                    {event.organizerImage ? (
                      <Image
                        src={event.organizerImage}
                        alt={event.organizerName}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-lg font-medium text-muted-foreground">
                          {event.organizerName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-foreground">{event.organizerName}</p>
                      <Link 
                        href={`/members/${event.organizerId}`}
                        className="text-sm text-accent hover:underline"
                      >
                        View profile
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Registration Card */}
              <div className="bg-card rounded-xl border border-border p-6 sticky top-4">
                {/* Price */}
                <div className="text-center pb-4 border-b border-border">
                  {event.isFree ? (
                    <span className="text-2xl font-bold text-green-600">Free</span>
                  ) : (
                    <span className="text-2xl font-bold text-foreground">
                      £{event.price?.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="py-4 space-y-4">
                  {/* Date */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{formatEventDate(event.startDate)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatEventTime(event.startDate)} - {formatEventTime(event.endDate)}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      {event.isVirtual ? (
                        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      {event.isVirtual ? (
                        <>
                          <p className="font-medium text-foreground">Online Event</p>
                          <p className="text-sm text-muted-foreground">
                            Link will be shared after registration
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-foreground">{event.location}</p>
                          {event.address && (
                            <p className="text-sm text-muted-foreground">{event.address}</p>
                          )}
                          {event.city && (
                            <p className="text-sm text-muted-foreground">{event.city}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Capacity */}
                  {event.capacity && (
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {event.registrationCount} / {event.capacity} attending
                        </p>
                        {!isPast && availableSpots !== null && (
                          <p className={`text-sm ${availableSpots <= 10 && availableSpots > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {availableSpots === 0
                              ? 'Waitlist only'
                              : `${availableSpots} spot${availableSpots !== 1 ? 's' : ''} remaining`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* RSVP Button */}
                {!isPast && (
                  <div className="pt-4 border-t border-border">
                    <EventRSVPButton
                      eventId={event.id}
                      isFree={event.isFree}
                      isFull={isFull}
                      isPremiumOnly={event.isPremiumOnly}
                    />
                  </div>
                )}

                {/* Add to Calendar (after registration) */}
                {!isPast && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        const icsContent = generateICSFile(event);
                        const blob = new Blob([icsContent], { type: 'text/calendar' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${event.slug}.ics`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-sm text-accent hover:text-accent/80 transition-colors"
                    >
                      Add to calendar
                    </button>
                  </div>
                )}
              </div>

              {/* Share Card */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-medium text-foreground mb-3">Share this event</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: event.title,
                          text: event.shortDescription || event.description.substring(0, 100),
                          url: window.location.href,
                        });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                      }
                    }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Back Link */}
      <section className="pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to all events
          </Link>
        </div>
      </section>
    </main>
  );
}
