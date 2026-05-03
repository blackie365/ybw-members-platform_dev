import { Header } from "@/components/magazine/header"
import { NewsTicker } from "@/components/magazine/news-ticker"
import { HeroSection } from "@/components/magazine/hero-section"
import { ArticleGrid } from "@/components/magazine/article-grid"
import { FeaturedInterview } from "@/components/magazine/featured-interview"
import { CategoriesSection } from "@/components/magazine/categories-section"
import { NewsletterSection } from "@/components/magazine/newsletter-section"
import { Footer } from "@/components/magazine/footer"

export default function MagazinePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <NewsTicker />
      <main>
        <HeroSection />
        <ArticleGrid />
        <FeaturedInterview />
        <CategoriesSection />
        <NewsletterSection />
      </main>
      <Footer />
    </div>
  )
}
