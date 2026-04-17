import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'

import { Button } from '@/components/Button'
import { HeroPattern } from '@/components/HeroPattern'
import { getPosts, getTags } from '@/lib/ghost'
import { ENDPOINTS } from '@/lib/firebase-functions'
import { MemberCard } from '@/components/MemberCard'
import { getExternalNews } from '@/lib/externalNews'
import { getLatestMarketInsight } from '@/lib/marketInsights'
// Import components that use client-side state
import MarketInsightsWidget from '@/components/MarketInsightsWidget';
import VideoNewsWidget from '@/components/VideoNewsWidget';
import { CategorySection } from '@/components/CategorySection';

export const metadata = {
  title: 'Yorkshire Businesswoman | Home',
  description: 'Welcome to the Yorkshire Businesswoman community. Connect with local professionals, stay up to date with the latest business news, and discover exclusive events.',
}

export const revalidate = 60

async function getMembers() {
  try {
    const res = await fetch(ENDPOINTS.getMembers);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data.members || [];
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return [];
  }
}

function getFeaturedMedia(html?: string) {
  if (!html) return null;
  const iframeMatch = html.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
  if (iframeMatch) {
    let iframeHtml = iframeMatch[0];
    iframeHtml = iframeHtml.replace(/style="[^"]*"/g, '');
    iframeHtml = iframeHtml.replace('<iframe', '<iframe class="w-full h-full absolute inset-0 border-0"');
    return iframeHtml;
  }
  const videoMatch = html.match(/<video[^>]*>[\s\S]*?<\/video>/i);
  if (videoMatch) {
    let videoHtml = videoMatch[0];
    videoHtml = videoHtml.replace(/style="[^"]*"/g, '');
    videoHtml = videoHtml.replace('<video', '<video class="w-full h-full absolute inset-0 object-contain"');
    return videoHtml;
  }
  return null;
}

export default async function HomePage() {
  const [events, allPosts, allMembers, externalNews, marketInsight, topTags] = await Promise.all([
    getPosts({ limit: 4, filter: 'tag:events' }),
    getPosts({ limit: 6 }), // Fetch the 6 absolute newest posts across all categories
    getMembers(),
    getExternalNews(8),
    getLatestMarketInsight(),
    getTags({ limit: 6, include: 'count.posts', order: 'count.posts DESC', filter: 'visibility:public' })
  ]);

  // Filter out system/common tags like 'news' or 'events' to get the actual content categories
  const displayTags = topTags.filter((t: any) => t.slug !== 'news' && t.slug !== 'events').slice(0, 4);

  // Fetch the latest posts for each of the top categories
  const categoryBlocks = await Promise.all(
    displayTags.map(async (tag: any) => {
      const posts = await getPosts({ limit: 4, filter: `tag:${tag.slug}` });
      return { tag, posts };
    })
  );

  // Get a few members for the spotlight section
  const featuredMembers = allMembers.slice(0, 4);

  // Extract featured article from the newest posts overall
  const featuredArticle = allPosts.length > 0 ? allPosts[0] : null;
  const mainNews = allPosts.length > 1 ? allPosts.slice(1, 6) : [];

  return (
    <div className="relative">
      <HeroPattern />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14">
        {/* Hero Section */}
        <div className="relative pb-16 pt-10 sm:pb-24">
          <div className="max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl dark:text-white">
            Yorkshire Businesswoman
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Welcome to the online platform for the region's most inspiring and ambitious women. 
            Connect with local professionals, stay up to date with the latest business news, and discover exclusive events.
          </p>
          <div className="mt-8 flex gap-4">
            <Button href="/register" arrow="right">
              Join the Community
            </Button>
            <Button href="/news" variant="outline">
              Read Latest News
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-20 pb-20">
        
        {/* Latest News Section */}
        {allPosts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Latest Posts</h2>
              <Link href="/news" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                View all posts <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* Left Content Area (Cols 1-3) */}
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8 lg:grid-cols-3">
                {/* Featured Article (spans 2 columns) */}
                {featuredArticle && (
                  <div key={featuredArticle.id} className="sm:col-span-2 lg:col-span-2 group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20">
                    <div className="relative w-full mb-4">
                      {getFeaturedMedia(featuredArticle.html) ? (
                        <div className="aspect-[16/9] w-full rounded-lg bg-black flex items-center justify-center overflow-hidden relative">
                          <div dangerouslySetInnerHTML={{ __html: getFeaturedMedia(featuredArticle.html) as string }} className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:top-0 [&>iframe]:left-0 [&>iframe]:border-0" />
                        </div>
                      ) : featuredArticle.feature_image ? (
                        <Image
                          src={featuredArticle.feature_image}
                          alt={featuredArticle.title}
                          width={800}
                          height={400}
                          priority={true}
                          className="aspect-[16/9] w-full rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                        />
                      ) : (
                        <div className="aspect-[16/9] w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <span className="text-zinc-400 dark:text-zinc-500 text-sm">No featured media</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-x-4 text-xs mb-2">
                      <time dateTime={featuredArticle.published_at} className="text-zinc-500 dark:text-zinc-400">
                        {featuredArticle.published_at ? format(new Date(featuredArticle.published_at), 'MMM d, yyyy') : ''}
                      </time>
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold leading-7 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                      <Link href={`/news/${featuredArticle.slug}`}>
                        <span className="absolute inset-0" />
                        {featuredArticle.title}
                      </Link>
                    </h3>
                    {(featuredArticle.custom_excerpt || featuredArticle.excerpt) && (
                      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400 line-clamp-3">
                        {featuredArticle.custom_excerpt || featuredArticle.excerpt}
                      </p>
                    )}
                  </div>
                )}

                {/* Third Column Top: 2 Stacked Articles (compact to match featured article height) */}
                {mainNews.length > 0 && (
                  <div className="col-span-full lg:col-span-1 flex flex-col gap-6">
                    {mainNews.slice(0, 2).map((item: any) => (
                      <div key={item.id} className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20 flex-1">
                        <div className="relative w-full mb-3">
                          {item.feature_image ? (
                            <Image
                              src={item.feature_image}
                              alt={item.title}
                              width={400}
                              height={200}
                              className="aspect-[16/9] lg:aspect-[2/1] w-full rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                            />
                          ) : (
                            <div className="aspect-[16/9] lg:aspect-[2/1] w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                              <span className="text-zinc-400 dark:text-zinc-500 text-xs">No image</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col justify-end flex-1 w-full">
                          <div className="flex items-center gap-x-4 text-xs mb-1">
                            <time dateTime={item.published_at} className="text-zinc-500 dark:text-zinc-400">
                              {item.published_at ? format(new Date(item.published_at), 'MMM d, yyyy') : ''}
                            </time>
                          </div>
                          <h3 className="text-sm font-semibold leading-6 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 line-clamp-3">
                            <Link href={`/news/${item.slug}`}>
                              <span className="absolute inset-0" />
                              {item.title}
                            </Link>
                          </h3>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Other Main News Articles */}
                {mainNews.slice(2).map((item: any) => (
                  <div key={item.id} className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20">
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
                    {(item.custom_excerpt || item.excerpt) && (
                      <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {item.custom_excerpt || item.excerpt}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Right Sidebar (Col 4) */}
              <div className="lg:col-span-1 space-y-8">
                {/* Market Insights Widget */}
                <MarketInsightsWidget insight={marketInsight} />

                {/* Web Ad Space */}
                <div className="w-full aspect-square sm:aspect-auto sm:h-[250px] bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center p-4 text-center">
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Advertisement</span>
                  <div className="w-full h-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg flex items-center justify-center">
                    <span className="text-zinc-400 dark:text-zinc-500 text-sm">Ad Space</span>
                  </div>
                </div>

              </div>

            </div>
          </section>
        )}

        {/* Dynamic Category Sections */}
        {categoryBlocks.map((block: any) => (
          <CategorySection key={block.tag.slug} tag={block.tag} posts={block.posts} />
        ))}

        {/* Video News Section */}
        <VideoNewsWidget />

        {/* Upcoming Events Section */}
        {events.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Upcoming Events</h2>
              <Link href="/news?tag=events" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                View all events <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {events.map((event: any) => (
                <div key={event.id} className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20">
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
                  {(event.custom_excerpt || event.excerpt) && (
                    <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {event.custom_excerpt || event.excerpt}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Member Spotlight */}
        {featuredMembers.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Member Spotlight</h2>
              <Link href="/members" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                View directory <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {featuredMembers.map((member: any, index: number) => (
                <MemberCard key={member.id || member.email || member.slug || index} member={member} />
              ))}
            </div>
          </section>
        )}

        {/* Call to Action */}
        <section className="relative isolate overflow-hidden bg-zinc-900 px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16 dark:bg-zinc-800/50 dark:ring-1 dark:ring-white/10">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Empower your business journey
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-zinc-300">
            Join a network of successful women. Share your story, promote your business, and connect with like-minded professionals across Yorkshire.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/register"
              className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get started
            </Link>
            <Link href="/members" className="text-sm font-semibold leading-6 text-white">
              View our members <span aria-hidden="true">→</span>
            </Link>
          </div>
          <svg
            viewBox="0 0 1024 1024"
            className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-x-1/2 [mask-image:radial-gradient(closest-side,white,transparent)]"
            aria-hidden="true"
          >
            <circle cx={512} cy={512} r={512} fill="url(#gradient)" fillOpacity="0.7" />
            <defs>
              <radialGradient id="gradient">
                <stop stopColor="#4f46e5" />
                <stop offset={1} stopColor="#818cf8" />
              </radialGradient>
            </defs>
          </svg>
        </section>
      </div>
      </div>
    </div>
  );
}

