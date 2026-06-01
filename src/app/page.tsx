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
import { getPosts, getTags } from "@/lib/ghost"
import { issuuService } from "@/lib/issuu"
import { adminDb } from "@/lib/firebase-admin"
import Link from "next/link"

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

    // 2c. Fetch category specific posts
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

    tags = await getTags({ limit: 5, include: 'count.posts', order: 'count.posts DESC' });
    const featuredMembers = await getFeaturedMembers();
    featuredMember = featuredMembers.length > 0 ? featuredMembers[0] : null;
    
    // Fetch real publications for the MagazineExperience section
    const realPublications = await issuuService.listPublications();
    if (realPublications.length > 0 && featuredMember) {
      const pub = realPublications[0];
      featuredMember.latestMagazine = {
        id: pub.slug,
        title: pub.title,
        coverImage: pub.coverUrl || pub.coverUrlLarge || `https://image.issuu.com/${pub.documentId}/jpg/page_1.jpg`,
        publishDate: pub.publishDate || pub.createdAt,
        premiumUrl: `https://e.issuu.com/embed.html?d=${pub.slug}&u=blackie365`
      };
    }
  } catch (error) {
    console.error("Critical error fetching data for MagazinePage:", error);
    errorOccurred = true;
  }

  if (errorOccurred) {
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

  // Filter out carousel posts from the main grid to avoid duplicates and limit to 6 stories
  const featuredIds = (featuredPosts || []).map((p: any) => p.id);
  const gridPosts = (recentPosts || [])
    .filter((p: any) => !featuredIds.includes(p.id))
    .slice(0, 6);

  return (
    <div className="bg-background">
      <div className="flex-1">
        <HeroSection posts={featuredPosts} recentPosts={recentPosts?.slice(0, 3)} />
        <ArticleGrid posts={gridPosts} />
        <LatestEvents events={latestEvents} />
        <CategorySection title="Fashion & Lifestyle" posts={fashionPosts} />
        <FeaturedInterview member={featuredMember} />
        <CategorySection title="Health & Wellbeing" posts={healthPosts} />
        <CategoriesSection tags={tags} />
        <HomeEconomicInsights />
        <MagazineExperience latestIssue={featuredMember?.latestMagazine} />
        <NewsletterSection />
        <TestimonialsSection />
      </div>
    </div>
  );
}
