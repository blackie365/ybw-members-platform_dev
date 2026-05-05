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
    const snapshot = await adminDb.collection('newMemberCollection').limit(1).get();
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      }
    });
  } catch (error) {
    console.error("Error fetching featured members:", error);
    return [];
  }
}

export default async function MagazinePage() {
  const posts = await getPosts({ limit: 10 });
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
