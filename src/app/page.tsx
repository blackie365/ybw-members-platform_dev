import { Header } from "@/components/magazine/header"
import { NewsTicker } from "@/components/magazine/news-ticker"
import { HeroSection } from "@/components/magazine/hero-section"
import { ArticleGrid } from "@/components/magazine/article-grid"
import { FeaturedInterview } from "@/components/magazine/featured-interview"
import { CategoriesSection } from "@/components/magazine/categories-section"
import { NewsletterSection } from "@/components/magazine/newsletter-section"
import { Footer } from "@/components/magazine/footer"
import { getPosts } from "@/lib/ghost"
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
  const featuredMembers = await getFeaturedMembers();
  const featuredMember = featuredMembers.length > 0 ? featuredMembers[0] : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <NewsTicker />
      <main>
        <HeroSection posts={posts} />
        <ArticleGrid posts={posts.slice(3)} />
        <FeaturedInterview member={featuredMember} />
        <CategoriesSection />
        <NewsletterSection />
      </main>
      <Footer />
    </div>
  )
}
