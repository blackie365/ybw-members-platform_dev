import { Suspense } from "react";
import { adminDb } from "@/lib/firebase-admin";
import { Event, EVENT_TYPE_LABELS } from "@/lib/events";
import EventsPageClient from "./EventsPageClient";

export const metadata = {
  title: "Events",
  description:
    "Discover networking events, workshops, and conferences for businesswomen in Yorkshire.",
  openGraph: {
    title: "Events | Yorkshire BusinessWoman",
    description:
      "Discover networking events, workshops, and conferences for businesswomen in Yorkshire.",
    type: "website",
  },
};

async function getAllEvents() {
  try {
    if (!adminDb) {
      console.warn("Firebase Admin not initialized - returning empty events");
      return [];
    }

    const upcomingQuery = adminDb
      .collection("events")
      .where("status", "==", "published")
      .orderBy("startDate", "asc");

    const upcomingSnap = await upcomingQuery.limit(100).get();
    const events: Event[] = [];
    upcomingSnap.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() } as Event);
    });

    return events;
  } catch (error) {
    console.warn(
      "Error fetching events (Firebase Admin credentials may not be configured):",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function EventsLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card py-24" aria-hidden>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="h-16 w-48 animate-pulse rounded-full bg-muted" />
          <div className="mt-5 h-12 w-80 animate-pulse rounded-md bg-muted" />
          <div className="mt-4 h-6 w-[520px] max-w-full animate-pulse rounded-md bg-muted" />
        </div>
      </section>
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="aspect-[16/9] bg-muted" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-3/4 rounded bg-muted" />
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function EventsPage() {
  const events = await getAllEvents();

  return (
    <Suspense fallback={<EventsLoadingSkeleton />}>
      <EventsPageClient initialEvents={events} />
    </Suspense>
  );
}
