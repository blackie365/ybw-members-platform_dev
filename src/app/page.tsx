import Image from 'next/image'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { getPosts, getTags } from '@/lib/ghost'
import { MemberCard } from '@/components/MemberCard'
import { CategorySection } from '@/components/CategorySection'
import { getLatestMarketInsight } from '@/lib/marketInsights'
import { getExternalNews } from '@/lib/externalNews'
import MarketInsightsWidget from '@/components/MarketInsightsWidget'
import VideoNewsWidget from '@/components/VideoNewsWidget'
import { adminDb } from '@/lib/firebase-admin'
import { HeroArticle } from '@/components/HeroArticle'
import { NewsGrid } from '@/components/NewsGrid'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

async function getFeaturedMembers() {
  try {
    const snapshot = await adminDb.collection('newMemberCollection').limit(4).get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : null,
        updatedAt: data.updatedAt?._seconds ? new Date(data.updatedAt._seconds * 1000).toISOString() : null,
      }
    });
  } catch (error) {
    console.error("Error fetching featured members:", error);
    return [];
  }
}

export default async function HomePage() {
  const [events, allPosts, featuredMembers, externalNews, marketInsight, topTags] = await Promise.all([
    getPosts({ limit: 4, filter: 'tag:events' }),
    getPosts({ limit: 7 }), // Fetch 1 hero + 6 grid posts
    getFeaturedMembers(),
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

  const featuredArticle = allPosts.length > 0 ? allPosts[0] : null;
  const mainNews = allPosts.length > 1 ? allPosts.slice(1, 7) : [];

  return (
    <div className="bg-background text-foreground pb-24">
      {/* Magazine Header / Title */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20 text-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter uppercase mb-6 text-primary font-serif">
            Yorkshire <span className="text-foreground">Businesswoman</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-muted-foreground leading-relaxed">
            The premier community and news platform for ambitious professionals across the region.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 space-y-24">
        
        {/* Featured Hero Article */}
        <section>
          <HeroArticle article={featuredArticle} />
        </section>

        <Separator className="my-12" />

        {/* Latest News Section with Sidebar */}
        <section>
          <div className="flex items-end justify-between mb-8">
            <h2 className="text-3xl font-bold tracking-tight uppercase border-b-4 border-primary pb-2 inline-block">
              Latest News
            </h2>
            <Button variant="link" asChild className="hidden sm:inline-flex">
              <Link href="/news">View all posts &rarr;</Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Left Content Area (Cols 1-3) */}
            <div className="lg:col-span-3">
              <NewsGrid posts={mainNews} />
            </div>

            {/* Right Sidebar (Col 4) */}
            <div className="lg:col-span-1 space-y-8">
              <MarketInsightsWidget insight={marketInsight} />

              {/* Web Ad Space */}
              <div className="w-full h-[250px] bg-muted rounded-xl border border-border flex flex-col items-center justify-center p-4 text-center shadow-sm">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Advertisement</span>
                <div className="w-full h-full border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">Ad Space</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Button variant="outline" asChild className="w-full">
              <Link href="/news">View all posts</Link>
            </Button>
          </div>
        </section>

        {/* Dynamic Category Sections */}
        {categoryBlocks.map((block: any) => (
          <CategorySection key={block.tag.slug} tag={block.tag} posts={block.posts} />
        ))}

        <VideoNewsWidget />

        {/* Upcoming Events Section */}
        {events.length > 0 && (
          <section className="bg-muted/50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-16 sm:py-24 rounded-none lg:rounded-3xl border-y lg:border border-border">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold tracking-tight uppercase border-b-4 border-primary pb-2 inline-block">
                  Upcoming Events
                </h2>
                <p className="mt-4 text-muted-foreground max-w-xl">Join us for our upcoming exclusive networking and business events across Yorkshire.</p>
              </div>
              <Button variant="outline" asChild className="hidden sm:inline-flex">
                <Link href="/news?tag=events">View all events</Link>
              </Button>
            </div>
            
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {events.map((event: any) => (
                <div key={event.id} className="group relative flex flex-col items-start justify-between bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-border">
                  <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
                    {event.feature_image ? (
                      <Image
                        src={event.feature_image}
                        alt={event.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                        No image
                      </div>
                    )}
                    <Badge className="absolute top-3 right-3 shadow-sm bg-primary/90 hover:bg-primary">Event</Badge>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <time dateTime={event.published_at} className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      {event.published_at ? format(new Date(event.published_at), 'MMM d, yyyy') : ''}
                    </time>
                    <h3 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">
                      <Link href={`/news/${event.slug}`}>
                        <span className="absolute inset-0" />
                        {event.title}
                      </Link>
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Member Spotlight */}
        {featuredMembers.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-10">
              <h2 className="text-3xl font-bold tracking-tight uppercase border-b-4 border-primary pb-2 inline-block">
                Member Spotlight
              </h2>
              <Button variant="link" asChild className="hidden sm:inline-flex">
                <Link href="/members">View directory &rarr;</Link>
              </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featuredMembers.map((member: any, index: number) => (
                <MemberCard key={member.id || member.email || member.slug || index} member={member} />
              ))}
            </div>
          </section>
        )}

        {/* Call to Action */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-24 text-center shadow-2xl rounded-3xl sm:px-16">
          <h2 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl uppercase font-serif">
            Empower your business journey
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-xl leading-relaxed text-primary-foreground/90">
            Join a network of successful women. Share your story, promote your business, and connect with like-minded professionals across Yorkshire.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto font-bold px-8">
              <Link href="/register">Get started today</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto font-bold bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link href="/members">View our members</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}