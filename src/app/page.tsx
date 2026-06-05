import { HeroSection } from "@/components/magazine/hero-section"
import { ArticleGrid } from "@/components/magazine/article-grid"
import { FeaturedInterview } from "@/components/magazine/featured-interview"
import { CategoriesSection } from "@/components/magazine/categories-section"
import { NewsletterSection } from "@/components/magazine/newsletter-section"
import { HomeEconomicInsights } from "@/components/magazine/home-economic-insights"
import { LatestEvents } from "@/components/magazine/latest-events"
import { CategorySection } from "@/components/magazine/category-section"
import { TestimonialsSection } from "@/components/magazine/testimonials-section"
import { MagazineExperience } from "@/components/magazine/magazine-experience"
import { EventsCountdownStrip } from "@/components/magazine/events-countdown-strip"
import { getPosts, getTags } from "@/lib/ghost"
import { adminDb } from "@/lib/firebase-admin"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

// Homepage - Yorkshire BusinessWoman Magazine

async function getFeaturedMembers() {
  try {
    if (!adminDb) return [];
    
    // First, try to fetch the explicitly featured member
    const featuredSnapshot = await adminDb.collection('newMemberCollection')
      .where('isFeatured', '==', true)
      .limit(1)
      .get();
      
    let members = [];
    
    if (!featuredSnapshot.empty) {
      const doc = featuredSnapshot.docs[0];
      const data = doc.data();
      members.push({
        id: doc.id,
        name: String(data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || ''),
        image: String(data.profileImage || data.image || data.avatarUrl || ''),
        company: String(data.companyName || data.company || ''),
        role: String(data.jobTitle || data.role || ''),
        bio: String(data.bio || ''),
        slug: String(data.slug || doc.id),
        isFeatured: data.isFeatured === true,
      });
    } else {
      // Fallback: Fetch a batch of members to find one with a complete profile
      const snapshot = await adminDb.collection('newMemberCollection').limit(50).get();
      members = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: String(data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || ''),
          image: String(data.profileImage || data.image || data.avatarUrl || ''),
          company: String(data.companyName || data.company || ''),
          role: String(data.jobTitle || data.role || ''),
          bio: String(data.bio || ''),
          slug: String(data.slug || doc.id),
          isFeatured: data.isFeatured === true,
        }
      }).filter((member: any) => {
        const hasImage = !!member.image;
        const hasBio = member.bio && typeof member.bio === 'string' && member.bio.trim().length > 20;
        const hasName = member.name && typeof member.name === 'string' && member.name.trim().length > 0;
        return hasImage && hasBio && hasName;
      });
    }

    return members;
  } catch (error) {
    console.error("Error fetching featured members:", error);
    return [];
  }
}

export const revalidate = 0;

export default async function MagazinePage() {
  let featuredPosts: any[] = [];
  let recentPosts: any[] = [];
  let latestEvents: any[] = [];
  let fashionPosts: any[] = [];
  let healthPosts: any[] = [];
  let tags: any[] = [];
  let featuredMember: any = null;
  let errorOccurred = false;

  try {
    // 1. Fetch the latest featured posts for the carousel
    featuredPosts = await getPosts({
      limit: 5,
      filter: "featured:true",
      order: "published_at DESC"
    });

    // 2. Fetch the latest posts chronologically for the grid
    recentPosts = await getPosts({ 
      limit: 15, 
      order: "published_at DESC" 
    });

    // 2b. Fetch latest events
    latestEvents = await getPosts({
      limit: 3,
      filter: "tag:events",
      order: "published_at DESC"
    });

    // 2c. Fetch category specific posts for Industry Hubs
    const agencyPosts = await getPosts({
      limit: 3,
      filter: "tag:agency",
      order: "published_at DESC"
    });

    const techPosts = await getPosts({
      limit: 3,
      filter: "tag:tech",
      order: "published_at DESC"
    });

    const businessPosts = await getPosts({
      limit: 3,
      filter: "tag:business",
      order: "published_at DESC"
    });

    fashionPosts = await getPosts({
      limit: 3,
      filter: "tag:fashion-lifestyle",
      order: "published_at DESC"
    });

    healthPosts = await getPosts({
      limit: 3,
      filter: "tag:health-wellbeing",
      order: "published_at DESC"
    });

    tags = await getTags({ limit: 10, include: 'count.posts', order: 'count.posts DESC' });
    const featuredMembers = await getFeaturedMembers();
    featuredMember = featuredMembers.length > 0 ? featuredMembers[0] : null;

    // Filter out carousel posts from the main grid to avoid duplicates and limit to 6 stories
    const featuredIds = (featuredPosts || []).map((p: any) => p.id);
    const gridPosts = (recentPosts || [])
      .filter((p: any) => !featuredIds.includes(p.id))
      .slice(0, 6);

    return (
      <div className="bg-background">
        <div className="flex-1">
          {/* Live Events Countdown Strip */}
          <EventsCountdownStrip 
            targetDate="2026-06-25T18:00:00" 
            title="Yorkshire BusinessWoman Awards 2026" 
            link="/news?tag=events" 
          />
          
          <HeroSection posts={featuredPosts} recentPosts={recentPosts?.slice(0, 3)} />
          
          {/* Industry Hubs - Quick Access Strip */}
          <div className="border-y border-border/50 bg-accent/5">
            <div className="mx-auto max-w-7xl px-4 lg:px-8 py-3 flex items-center justify-between overflow-x-auto scrollbar-hide gap-8 whitespace-nowrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent shrink-0">Industry Hubs:</span>
              <div className="flex gap-6 lg:gap-12">
                {['Agency', 'Tech', 'Business', 'Fashion', 'Health'].map((hub) => (
                  <Link key={hub} href={`/news?tag=${hub.toLowerCase()}`} className="text-xs font-medium hover:text-accent transition-colors">
                    {hub}
                  </Link>
                ))}
              </div>
              <Link href="/news" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors ml-auto">
                Explore All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <ArticleGrid posts={gridPosts} />
          
          {/* Dynamic Industry Hub Sections */}
          <CategorySection title="Agency News" posts={agencyPosts} />
          <CategorySection title="Tech & Digital" posts={techPosts} />
          
          <LatestEvents events={latestEvents} />
          <CategorySection title="Business Insights" posts={businessPosts} />
          
          <FeaturedInterview member={featuredMember} />
          
          <CategorySection title="Fashion & Lifestyle" posts={fashionPosts} />
          <CategorySection title="Health & Wellbeing" posts={healthPosts} />
          
          <CategoriesSection tags={tags} />
          <HomeEconomicInsights />
          <MagazineExperience />
          <NewsletterSection />
          <TestimonialsSection />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Critical error fetching data for MagazinePage:", error);
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="font-serif text-3xl mb-4">Welcome to Yorkshire BusinessWoman</h1>
          <p className="text-muted-foreground mb-8">We&apos;re currently updating our content. Please check back in a few moments.</p>
          <Link href="/news" className="text-accent font-medium hover:underline">View Latest News</Link>
        </div>
      </div>
    );
  }
}
