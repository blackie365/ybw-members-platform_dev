import { HeroSection } from "@/components/magazine/hero-section"
import { ArticleGrid } from "@/components/magazine/article-grid"
import { FeaturedInterview } from "@/components/magazine/featured-interview"
import { CategoriesSection } from "@/components/magazine/categories-section"
import { NewsletterSection } from "@/components/magazine/newsletter-section"
import { getPosts, getTags } from "@/lib/ghost"
import { adminDb } from "@/lib/firebase-admin"
import Link from "next/link"
import Image from "next/image"

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

async function getFeaturedOffers() {
  try {
    if (!adminDb) return [];
    
    const snapshot = await adminDb.collection('offer_requests')
      .where('status', '==', 'active')
      .limit(3)
      .get();
      
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching featured offers:", error);
    return [];
  }
}

async function FeaturedOffers({ offers }: { offers: any[] }) {
  if (offers.length === 0) return null;

  return (
    <section className="py-20 bg-zinc-50 dark:bg-zinc-900/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="font-serif text-3xl font-medium text-foreground mb-4">Member & Partner Offers</h2>
            <p className="text-muted-foreground max-w-2xl">
              Exclusive discounts and opportunities from our network of businesswomen.
            </p>
          </div>
          <Link 
            href="/offers" 
            className="text-sm font-semibold text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
          >
            View all offers
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <div key={offer.id} className="group flex flex-col bg-background border border-border overflow-hidden hover:shadow-lg transition-all duration-300">
              {offer.imageUrl && (
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={offer.imageUrl}
                    alt={offer.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-accent">
                    {offer.userName || 'Member Perk'}
                  </span>
                  {offer.isMembersOnly && (
                    <span className="inline-flex items-center rounded-none bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      Members Only
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-xl font-medium text-foreground group-hover:text-accent transition-colors mb-3">
                  {offer.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                  {offer.description}
                </p>
                <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Available now
                  </span>
                  <Link 
                    href={offer.isMembersOnly ? "/dashboard/offers" : (offer.link || "/offers")}
                    className="text-xs font-bold text-accent uppercase tracking-widest hover:text-foreground transition-colors"
                  >
                    {offer.isMembersOnly ? 'Unlock →' : 'View →'}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
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
  const offers = await getFeaturedOffers();

  return (
    <div className="bg-background">
      <div className="flex-1">
        <HeroSection posts={posts} />
        <ArticleGrid posts={posts.slice(3)} />
        <FeaturedInterview member={featuredMember} />
        <FeaturedOffers offers={offers} />
        <CategoriesSection tags={tags} />
        <NewsletterSection />
      </div>
    </div>
  )
}
