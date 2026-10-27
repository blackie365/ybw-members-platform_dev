import { getPosts } from '@/lib/ghost';
import { isPastEvent, resolveEventDate } from '@/lib/events';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Metadata } from 'next';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'News',
  description: 'Latest news, stories, and updates for businesswomen across Yorkshire. Stay informed with Yorkshire BusinessWoman.',
  openGraph: {
    title: 'News | Yorkshire BusinessWoman',
    description: 'Latest news, stories, and updates for businesswomen across Yorkshire.',
    type: 'website',
  },
};

function PostCard({ post, eventDate }: { post: any; eventDate?: Date | null }) {
  // Events carry their real date in a Ghost tag; other posts just show when they
  // were published.
  const shownDate = eventDate ?? (post.published_at ? new Date(post.published_at) : null);

  return (
    <article className="group flex flex-col">
      <div className="relative w-full overflow-hidden bg-muted mb-6">
        {post.feature_image ? (
          <Image
            src={post.feature_image}
            alt={post.title}
            width={800}
            height={500}
            className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="aspect-[16/10] w-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">No image</span>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-x-3 text-xs uppercase tracking-wider mb-3">
          <time dateTime={shownDate ? shownDate.toISOString().slice(0, 10) : undefined} className="text-accent font-medium">
            {shownDate ? format(shownDate, 'MMMM d, yyyy') : ''}
          </time>
          {post.primary_tag && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">{post.primary_tag.name}</span>
            </>
          )}
        </div>
        <h3 className="font-serif text-xl font-medium leading-snug text-foreground group-hover:text-accent transition-colors mb-3">
          <Link href={`/news/${post.slug}`}>
            <span className="line-clamp-2">{post.title}</span>
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
          {post.custom_excerpt || post.excerpt}
        </p>
        <Link
          href={`/news/${post.slug}`}
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors mt-4"
        >
          Read Article
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </article>
  );
}

export default async function NewsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const tag = typeof searchParams.tag === 'string' ? searchParams.tag : undefined;
  const isEventsTag = tag === 'events';

  // The filter was previously restricting posts to after 2024-01-01.
  // We're removing this to ensure all recent posts are fetched.
  const filter = tag ? `tag:${tag}` : undefined;

  // Events are split into upcoming/past client-side, so we need them all rather
  // than one page at a time. Every other tag keeps the original paging.
  const posts = await getPosts({
    limit: isEventsTag ? 'all' : 12,
    page: isEventsTag ? undefined : page,
    filter,
    order: 'published_at DESC',
  });

  const meta = (posts as any).meta;
  const hasNextPage = meta?.next || false;
  const hasPrevPage = meta?.prev || false;

  let upcomingPosts = posts as any[];
  let pastPosts: any[] = [];

  if (isEventsTag) {
    const dated = (posts as any[]).map((post) => ({ post, eventDate: resolveEventDate(post) }));

    // A post with no date is treated as "unknown" and never demoted.
    const upcoming = dated.filter((entry) => !entry.eventDate || !isPastEvent(entry.eventDate));
    const past = dated.filter((entry) => entry.eventDate && isPastEvent(entry.eventDate));

    // Soonest first; anything without a date sinks to the bottom.
    upcoming.sort((a, b) => {
      if (a.eventDate && b.eventDate) return a.eventDate.getTime() - b.eventDate.getTime();
      if (a.eventDate) return -1;
      if (b.eventDate) return 1;
      return 0;
    });
    // Most recent first once they've happened.
    past.sort((a, b) => b.eventDate!.getTime() - a.eventDate!.getTime());

    upcomingPosts = upcoming.map((entry) => entry.post);
    pastPosts = past.map((entry) => entry.post);
  }

  const eventDateFor = (post: any) => (isEventsTag ? resolveEventDate(post) : undefined);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-primary py-20 sm:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70 mb-4">
              {tag === 'events' ? 'Networking & Growth' : (tag ? 'Discover More' : 'Stay Informed')}
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-primary-foreground sm:text-5xl capitalize text-balance">
              {tag === 'events' ? 'Yorkshire BusinessWoman Events' : (tag ? tag.replace(/-/g, ' ') : 'Latest News')}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-primary-foreground/70">
              {tag === 'events' ?'Join us at one of our many fantastic events, designed to inspire, connect, and empower women across the region.' 
                : (tag 
                  ? `Explore all articles tagged with ${tag.replace(/-/g, ' ')}.`
                  : 'Insights, stories, and updates from Yorkshire\'s business community.')}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-20">
        {upcomingPosts.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {upcomingPosts.map((post: any) => (
              <PostCard key={post.id} post={post} eventDate={eventDateFor(post)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <h3 className="font-serif text-2xl text-foreground mb-2">
              {isEventsTag && pastPosts.length > 0 ? 'No upcoming events' : 'No articles found'}
            </h3>
            <p className="text-muted-foreground">
              {isEventsTag && pastPosts.length > 0
                ? 'New dates will appear here as soon as they are announced.'
                : 'Check back later for new content.'}
            </p>
          </div>
        )}

        {/* Past events — demoted below the upcoming grid once the event has been */}
        {isEventsTag && pastPosts.length > 0 && (
          <section className="mt-20 border-t border-border pt-12">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Past events
              </p>
              <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                Recent gatherings
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Read the stories and galleries from our most recent events across Yorkshire.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {pastPosts.map((post: any) => (
                <PostCard key={post.id} post={post} eventDate={eventDateFor(post)} />
              ))}
            </div>
          </section>
        )}

        {/* Pagination */}
        {!isEventsTag && (hasPrevPage || hasNextPage) && (
          <div className="mt-16 flex items-center justify-between border-t border-border pt-8">
            <div className="flex-1">
              {hasPrevPage ? (
                <Link
                  href={`/news?page=${page - 1}${tag ? `&tag=${tag}` : ''}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  Previous
                </Link>
              ) : (
                <span />
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{page}</span> of{' '}
              <span className="font-medium text-foreground">{meta?.pages || page}</span>
            </div>
            
            <div className="flex-1 flex justify-end">
              {hasNextPage && (
                <Link
                  href={`/news?page=${page + 1}${tag ? `&tag=${tag}` : ''}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
