import { HeroSection } from "@/components/magazine/hero-section"
import { ArticleGrid } from "@/components/magazine/article-grid"
import { FeaturedInterview } from "@/components/magazine/featured-interview"
import { CategoriesSection } from "@/components/magazine/categories-section"
import { NewsletterSection } from "@/components/magazine/newsletter-section"
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
        isFeatured: true,
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
        const hasBio = member.bio && member.bio.trim().length > 20;
        const hasName = member.name && member.name.trim().length > 0;
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
  // 1. Fetch the single most recent featured post
  const featuredPosts = await getPosts({
    limit: 1,
    filter: "featured:true+published_at:>='2024-01-01'",
    order: "published_at DESC"
  });
  const heroFeatured = featuredPosts.length > 0 ? featuredPosts[0] : null;

  // 2. Fetch the latest posts chronologically (fetch extra in case we need to filter out the featured one)
  const recentPosts = await getPosts({ 
    limit: 13, 
    filter: "published_at:>='2024-01-01'", 
    order: "published_at DESC" 
  });

  // 3. Combine them: Hero featured post first, then chronological
  let posts = [];
  if (heroFeatured) {
    posts = [heroFeatured, ...recentPosts.filter((p: any) => p.id !== heroFeatured.id)].slice(0, 12);
  } else {
    posts = recentPosts.slice(0, 12);
  }

  const tags = await getTags({ limit: 5, include: 'count.posts', order: 'count.posts DESC' });
  const featuredMembers = await getFeaturedMembers();
  const featuredMember = featuredMembers.length > 0 ? featuredMembers[0] : null;

  return (
    <div className="bg-background">
      <div className="flex-1">
        <HeroSection posts={posts} />
        <ArticleGrid posts={posts.slice(3)} />
        <FeaturedInterview member={featuredMember} />
        <CategoriesSection tags={tags} />
        <NewsletterSection />
      </div>
    </div>
  )
}
