import { HeroSection } from "@/components/magazine/hero-section"
import { ArticleGrid } from "@/components/magazine/article-grid"
import { FeaturedInterview } from "@/components/magazine/featured-interview"
import { CategoriesSection } from "@/components/magazine/categories-section"
import { NewsletterSection } from "@/components/magazine/newsletter-section"
import { HomeEconomicInsights } from "@/components/magazine/home-economic-insights"
import { LatestEvents } from "@/components/magazine/latest-events"
import { CategorySection } from "@/components/magazine/category-section"
import { getPosts, getTags } from "@/lib/ghost"
import { adminDb } from "@/lib/firebase-admin"

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
        ...data,
        name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name,
        image: data.profileImage || data.image || data.avatarUrl,
        company: data.companyName || data.company,
        role: data.jobTitle || data.role,
        isFeatured: data.isFeatured === true,
      });
    } else {
      // Fallback: Fetch a batch of members to find one with a complete profile
      const snapshot = await adminDb.collection('newMemberCollection').limit(50).get();
      members = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name,
          image: data.profileImage || data.image || data.avatarUrl,
          company: data.companyName || data.company,
          role: data.jobTitle || data.role,
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
  try {
    // 1. Fetch the single most recent featured post
    const featuredPosts = await getPosts({
      limit: 1,
      filter: "featured:true",
      order: "published_at DESC"
    });
    const heroFeatured = featuredPosts.length > 0 ? featuredPosts[0] : null;

    // 2. Fetch the latest posts chronologically (fetch extra in case we need to filter out the featured one)
    const recentPosts = await getPosts({ 
      limit: 13, 
      order: "published_at DESC" 
    });

    // 2b. Fetch latest events
    const latestEvents = await getPosts({
      limit: 3,
      filter: "tag:events",
      order: "published_at DESC"
    });

    // 2c. Fetch category specific posts
    const fashionPosts = await getPosts({
      limit: 3,
      filter: "tag:fashion-lifestyle",
      order: "published_at DESC"
    });

    const healthPosts = await getPosts({
      limit: 3,
      filter: "tag:health-wellbeing",
      order: "published_at DESC"
    });

    // 3. Combine them: Hero featured post first, then chronological
    let posts = [];
    if (Array.isArray(recentPosts)) {
      if (heroFeatured) {
        posts = [heroFeatured, ...recentPosts.filter((p: any) => p.id !== heroFeatured.id)].slice(0, 12);
      } else {
        posts = recentPosts.slice(0, 12);
      }
    }

    const tags = await getTags({ limit: 5, include: 'count.posts', order: 'count.posts DESC' });
    const featuredMembers = await getFeaturedMembers();
    const featuredMember = featuredMembers.length > 0 ? featuredMembers[0] : null;

    return (
      <div className="bg-background">
        <div className="flex-1">
          <HeroSection posts={posts} />
          <ArticleGrid posts={posts.slice(3)} />
          <LatestEvents events={latestEvents} />
          <CategorySection title="Fashion & Lifestyle" posts={fashionPosts} />
          <FeaturedInterview member={featuredMember} />
          <CategorySection title="Health & Wellbeing" posts={healthPosts} />
          <CategoriesSection tags={tags} />
          <HomeEconomicInsights />
          <NewsletterSection />
        </div>
      </div>
    )
  } catch (error) {
    console.error("Critical error rendering MagazinePage:", error);
    // Fallback to a minimal version of the page instead of a complete crash
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="font-serif text-3xl mb-4">Welcome to Yorkshire BusinessWoman</h1>
          <p className="text-muted-foreground mb-8">We&apos;re currently updating our content. Please check back in a few moments.</p>
          <a href="/news" className="text-accent font-medium hover:underline">View Latest News</a>
        </div>
      </div>
    );
  }
}
