import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { getPosts } from '@/lib/ghost';
import { ENDPOINTS } from '@/lib/firebase-functions';
import { getExternalNews } from '@/lib/externalNews';
import { getLatestMarketInsight } from '@/lib/marketInsights';
import { Suspense } from 'react';

export const revalidate = 60;

async function getTotalMembers() {
  try {
    const res = await fetch(ENDPOINTS.getMembers, { next: { revalidate: 3600 } });
    const data = await res.json();
    return data.members?.length || 0;
  } catch (err) {
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
      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Members</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{totalMembers > 0 ? totalMembers : '--'}</p>
        </div>
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
          <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Upcoming Events</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{events.length}</p>
        </div>
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
          <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Latest News</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{news.length > 0 ? 'Updated' : 'Empty'}</p>
        </div>
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-full">
          <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

async function UpcomingEvents() {
  const events = await getPosts({ limit: 3, filter: 'tag:events' });
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Upcoming Events</h2>
        <Link href="/news?tag=events" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          View All
        </Link>
      </div>

      <div className="space-y-6">
        {events.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event: any) => (
              <div key={event.id} className="group relative flex flex-col items-start justify-between">
                <div className="relative w-full mb-4">
                  {event.feature_image ? (
                    <Image
                      src={event.feature_image}
                      alt={event.title}
                      width={400}
                      height={250}
                      className="aspect-[16/9] w-full rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                    />
                  ) : (
                    <div className="aspect-[16/9] w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-x-4 text-xs mb-2">
                  <time dateTime={event.published_at} className="text-zinc-500 dark:text-zinc-400">
                    {event.published_at ? format(new Date(event.published_at), 'MMM d, yyyy') : ''}
                  </time>
                </div>
                <h3 className="text-sm font-semibold leading-6 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                  <Link href={`/news/${event.slug}`}>
                    <span className="absolute inset-0" />
                    {event.title}
                  </Link>
                </h3>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-lg dark:border-zinc-800">
            <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">No upcoming events</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
    <div className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Recent News</h2>
        <Link href="/news" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          View All
        </Link>
      </div>
      
      <div className="space-y-6">
        {news.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item: any) => (
              <div key={item.id} className="group relative flex flex-col items-start justify-between">
                <div className="relative w-full mb-4">
                  {item.feature_image ? (
                    <Image
                      src={item.feature_image}
                      alt={item.title}
                      width={400}
                      height={250}
                      className="aspect-[16/9] w-full rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                    />
                  ) : (
                    <div className="aspect-[16/9] w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-x-4 text-xs mb-2">
                  <time dateTime={item.published_at} className="text-zinc-500 dark:text-zinc-400">
                    {item.published_at ? format(new Date(item.published_at), 'MMM d, yyyy') : ''}
                  </time>
                </div>
                <h3 className="text-sm font-semibold leading-6 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                  <Link href={`/news/${item.slug}`}>
                    <span className="absolute inset-0" />
                    {item.title}
                  </Link>
                </h3>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-lg dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Catch up on the latest Yorkshire Businesswoman news.
            </p>
            <Link href="/news" className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
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
    <div className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Regional Women in Business News</h2>
      </div>
      
      <div className="space-y-6">
        {externalNews && externalNews.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {externalNews.map((item: any) => (
              <div key={item.id} className="group relative flex flex-col items-start justify-between">
                <div className="relative w-full mb-4">
                  {item.feature_image ? (
                    <Image
                      src={item.feature_image}
                      alt={item.title}
                      width={400}
                      height={250}
                      className="aspect-[16/9] w-full rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                    />
                  ) : (
                    <div className="aspect-[16/9] w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-x-4 text-xs mb-2">
                  <time dateTime={item.published_at} className="text-zinc-500 dark:text-zinc-400">
                    {item.published_at ? format(new Date(item.published_at), 'MMM d, yyyy') : ''}
                  </time>
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">{item.source}</span>
                </div>
                <h3 className="text-sm font-semibold leading-6 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                  <a href={item.link} target="_blank" rel="noopener noreferrer">
                    <span className="absolute inset-0" />
                    {item.title}
                  </a>
                </h3>
                {item.excerpt && (
                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400 line-clamp-3">
                    {item.excerpt}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-lg dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
    <div className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Economic Insights</h2>
      </div>
      
      <div className="space-y-6">
        {marketInsight && marketInsight.points && marketInsight.points.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {marketInsight.points.map((point: any, index: number) => (
              <div key={index} className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-x-4 text-xs mb-3">
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/30">
                    {point.sourceName || 'Report'}
                  </span>
                </div>
                <h3 className="text-sm font-semibold leading-6 text-zinc-900 dark:text-white mb-2">
                  {point.sourceUrl ? (
                    <a href={point.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                      {point.summary}
                    </a>
                  ) : (
                    point.summary
                  )}
                </h3>
                <p className="mt-auto text-xs leading-5 text-zinc-600 dark:text-zinc-400 line-clamp-4">
                  {point.fullText}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-lg dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
