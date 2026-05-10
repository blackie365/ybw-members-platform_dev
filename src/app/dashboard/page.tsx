import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { getPosts } from '@/lib/ghost';
import { adminDb } from '@/lib/firebase-admin';
import { getExternalNews } from '@/lib/externalNews';
import { getLatestMarketInsight } from '@/lib/marketInsights';
import { Suspense } from 'react';

export const revalidate = 60;

async function getTotalMembers() {
  try {
    if (!adminDb) return 0;
    const snapshot = await adminDb.collection('newMemberCollection').count().get();
    return snapshot.data().count || 0;
  } catch (err) {
    console.error('Error fetching total members count:', err);
    return 0;
  }
}

// Separate components for data fetching to allow Suspense streaming

async function QuickStats() {
  const [events, news, totalMembers] = await Promise.all([
    getPosts({ limit: 3, filter: 'tag:events' }),
    getPosts({ limit: 3, filter: 'tag:news' }),
    getTotalMembers()
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
      <div className="bg-white border border-border rounded-none p-6 shadow-sm dark:bg-zinc-950 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">Total Members</p>
          <p className="mt-2 font-serif text-4xl font-medium tracking-tight text-foreground">{totalMembers > 0 ? totalMembers : '--'}</p>
        </div>
        <div className="p-3 bg-muted rounded-none border border-border">
          <svg className="w-8 h-8 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>

      <div className="bg-white border border-border rounded-none p-6 shadow-sm dark:bg-zinc-950 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">Upcoming Events</p>
          <p className="mt-2 font-serif text-4xl font-medium tracking-tight text-foreground">{events.length}</p>
        </div>
        <div className="p-3 bg-muted rounded-none border border-border">
          <svg className="w-8 h-8 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <div className="bg-white border border-border rounded-none p-6 shadow-sm dark:bg-zinc-950 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">Latest News</p>
          <p className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground">{news.length > 0 ? 'Updated' : 'Empty'}</p>
        </div>
        <div className="p-3 bg-muted rounded-none border border-border">
          <svg className="w-8 h-8 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

async function UpcomingEvents() {
  const events = await getPosts({ limit: 3, filter: 'tag:events' });
  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium text-foreground">Upcoming Events</h2>
        <Link href="/news?tag=events" className="text-[10px] font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors">
          View All
        </Link>
      </div>

      <div className="space-y-6">
        {events.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event: any) => (
              <div key={event.id} className="group relative flex flex-col items-start justify-between">
                <div className="relative w-full mb-5 overflow-hidden">
                  {event.feature_image ? (
                    <Image
                      src={event.feature_image}
                      alt={event.title}
                      width={400}
                      height={250}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-x-3 text-[10px] uppercase tracking-wider mb-3">
                  <time dateTime={event.published_at} className="text-accent font-medium">
                    {event.published_at ? format(new Date(event.published_at), 'MMMM d, yyyy') : ''}
                  </time>
                </div>
                <h3 className="font-serif text-xl font-medium leading-snug text-foreground group-hover:text-accent transition-colors">
                  <Link href={`/news/${event.slug}`}>
                    <span className="absolute inset-0" />
                    <span className="line-clamp-2">{event.title}</span>
                  </Link>
                </h3>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border">
            <h3 className="mt-2 font-serif text-xl text-foreground">No upcoming events</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back later for new events from the community.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

async function RecentNews() {
  const news = await getPosts({ limit: 3, filter: 'tag:news' });
  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium text-foreground">Recent News</h2>
        <Link href="/news" className="text-[10px] font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors">
          View All
        </Link>
      </div>
      
      <div className="space-y-6">
        {news.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item: any) => (
              <div key={item.id} className="group relative flex flex-col items-start justify-between">
                <div className="relative w-full mb-5 overflow-hidden">
                  {item.feature_image ? (
                    <Image
                      src={item.feature_image}
                      alt={item.title}
                      width={400}
                      height={250}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-x-3 text-[10px] uppercase tracking-wider mb-3">
                  <time dateTime={item.published_at} className="text-accent font-medium">
                    {item.published_at ? format(new Date(item.published_at), 'MMMM d, yyyy') : ''}
                  </time>
                </div>
                <h3 className="font-serif text-xl font-medium leading-snug text-foreground group-hover:text-accent transition-colors">
                  <Link href={`/news/${item.slug}`}>
                    <span className="absolute inset-0" />
                    <span className="line-clamp-2">{item.title}</span>
                  </Link>
                </h3>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Catch up on the latest Yorkshire Businesswoman news.
            </p>
            <Link href="/news" className="inline-flex items-center bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors">
              Read News
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

async function ExternalNewsWidget() {
  const externalNews = await getExternalNews(6);
  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium text-foreground">Regional Women in Business News</h2>
      </div>
      
      <div className="mt-6 flow-root">
        {externalNews && externalNews.length > 0 ? (
          <ul role="list" className="-my-5 divide-y divide-border">
            {externalNews.map((item: any) => (
              <li key={item.id} className="py-6 group">
                <div className="relative">
                  <h3 className="font-serif text-xl font-medium text-foreground group-hover:text-accent transition-colors">
                    <a href={item.link} target="_blank" rel="noopener noreferrer">
                      <span className="absolute inset-0" aria-hidden="true" />
                      {item.title}
                    </a>
                  </h3>
                  {item.excerpt && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                      {item.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-x-3 text-[10px] uppercase tracking-wider">
                    <span className="font-bold text-foreground">{item.source || 'News'}</span>
                    <span className="text-muted-foreground">•</span>
                    <time dateTime={item.published_at} className="text-accent font-medium">
                      {item.published_at ? format(new Date(item.published_at), 'MMMM d, yyyy') : ''}
                    </time>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-16 border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No external insights available at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

async function MarketInsightsWidget() {
  const marketInsight = await getLatestMarketInsight();
  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium text-foreground">Economic Insights</h2>
      </div>
      
      <div className="space-y-6">
        {marketInsight && marketInsight.points && marketInsight.points.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {marketInsight.points.map((point: any, index: number) => (
              <div key={index} className="group relative flex flex-col items-start justify-between bg-muted/50 p-6 border border-border">
                <div className="flex items-center gap-x-4 text-[10px] uppercase tracking-wider mb-4">
                  <span className="inline-flex items-center bg-background px-3 py-1 font-bold text-foreground border border-border">
                    {point.sourceName || 'Report'}
                  </span>
                </div>
                <h3 className="font-serif text-xl font-medium leading-snug text-foreground mb-3">
                  {point.sourceUrl ? (
                    <a href={point.sourceUrl} target="_blank" rel="noopener noreferrer" className="group-hover:text-accent transition-colors">
                      <span className="absolute inset-0" aria-hidden="true" />
                      {point.summary}
                    </a>
                  ) : (
                    point.summary
                  )}
                </h3>
                <p className="mt-auto text-sm leading-relaxed text-muted-foreground line-clamp-4">
                  {point.fullText}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No economic insights available at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Skeleton loaders for Suspense
function WidgetSkeleton({ title }: { title?: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800 animate-pulse">
      {title && (
        <div className="flex justify-between items-center mb-6">
          <div className="h-7 bg-zinc-200 dark:bg-zinc-700 rounded w-48"></div>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-4">
            <div className="aspect-[16/9] w-full bg-zinc-200 dark:bg-zinc-700 rounded-lg"></div>
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3"></div>
            <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800 animate-pulse flex justify-between items-center">
          <div className="space-y-3">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24"></div>
            <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-16"></div>
          </div>
          <div className="w-14 h-14 bg-zinc-200 dark:bg-zinc-700 rounded-full"></div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardUpcomingEvents() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<StatsSkeleton />}>
        <QuickStats />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton title="Upcoming Events" />}>
        <UpcomingEvents />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton title="Recent News" />}>
        <RecentNews />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton title="Yorkshire News Updates" />}>
        <ExternalNewsWidget />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton title="Economic Insights" />}>
        <MarketInsightsWidget />
      </Suspense>
    </div>
  );
}
