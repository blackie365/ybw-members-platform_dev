import { HeroSection } from "@/components/magazine/hero-section";
import { ArticleGrid } from "@/components/magazine/article-grid";
import { FeaturedInterview } from "@/components/magazine/featured-interview";
import { CategoriesSection } from "@/components/magazine/categories-section";
import { NewsletterSection } from "@/components/magazine/newsletter-section";
import { NewsletterPopup } from "@/components/magazine/newsletter-popup";
import { HomeEconomicInsights } from "@/components/magazine/home-economic-insights";
import { LatestEvents } from "@/components/magazine/latest-events";
import { CategorySection } from "@/components/magazine/category-section";
import { TestimonialsSection } from "@/components/magazine/testimonials-section";
import { MagazineExperience } from "@/components/magazine/magazine-experience";
import { getPosts, getTags } from "@/lib/ghost";
import { adminDb } from "@/lib/firebase-admin";
import Link from "next/link";

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

export const revalidate = 1800;

const FEATURED_MAX_AGE_DAYS = 60;
const RECENT_HERO_BONUS_FILL_N = 3;

function parsePostDate(d: unknown): Date | null {
  if (d instanceof Date) return d;
  if (typeof d === "number" && Number.isFinite(d) && d > 0) return new Date(d);
  if (typeof d === "string" && d.trim().length > 0) {
    const t = new Date(d);
    if (Number.isFinite(t.getTime())) return t;
  }
  return null;
}

function applyFeaturedStalenessFallback(
  featured: any[],
  recent: any[],
  now: Date = new Date()
): { heroPosts: any[]; gridRecent: any[]; diagnostics: Record<string, unknown> } {
  const cutoffMs = now.getTime() - FEATURED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const freshFeatured: any[] = [];
  const staleFeatured: any[] = [];
  for (const p of featured || []) {
    const dt = parsePostDate(p?.published_at ?? p?.publishedAt);
    if (dt && dt.getTime() < cutoffMs) staleFeatured.push(p);
    else freshFeatured.push(p);
  }

  const recentSorted = [...(recent || [])].sort((a: any, b: any) => {
    const da = (parsePostDate(a?.published_at ?? a?.publishedAt)?.getTime() ?? 0) * -1;
    const db = (parsePostDate(b?.published_at ?? b?.publishedAt)?.getTime() ?? 0) * -1;
    return da - db;
  });

  const recentById = new Map<string, any>();
  for (const p of recentSorted) if (p?.id) recentById.set(String(p.id), p);

  const staleIds = new Set<string>();
  for (const p of staleFeatured) if (p?.id) staleIds.add(String(p.id));

  let heroPosts = [...freshFeatured];
  const needed = 5 - heroPosts.length;
  if (needed > 0) {
    const fill: any[] = [];
    for (const p of recentSorted) {
      if (!p?.id) continue;
      const id = String(p.id);
      if (heroPosts.some((h: any) => h?.id && String(h.id) === id)) continue;
      if (staleIds.has(id)) continue;
      fill.push(p);
      if (fill.length >= needed) break;
    }
    heroPosts = [...heroPosts, ...fill];
  }

  const heroIds = new Set<string>();
  for (const p of heroPosts) if (p?.id) heroIds.add(String(p.id));

  const gridRecent = recentSorted.filter((p: any) => p?.id && !heroIds.has(String(p.id)));

  const diagnostics = {
    featuredTotal: (featured || []).length,
    freshFeatured: freshFeatured.length,
    staleFeaturedDropped: staleFeatured.length,
    filledFromRecent: Math.max(0, heroPosts.length - freshFeatured.length),
    heroPosts: heroPosts.length,
    gridRecent: gridRecent.length,
    staleDates: staleFeatured.map((p: any) => (parsePostDate(p?.published_at ?? p?.publishedAt)?.toISOString() ?? "").slice(0, 10)),
    heroDates: heroPosts.map((p: any) => (parsePostDate(p?.published_at ?? p?.publishedAt)?.toISOString() ?? "").slice(0, 10)),
  };

  return { heroPosts, gridRecent, diagnostics };
}

export default async function MagazinePage() {
  let featuredPosts: any[] = [];
  let recentPosts: any[] = [];
  let latestEvents: any[] = [];
  let editorsBlogPosts: any[] = [];
  let fashionPosts: any[] = [];
  let healthPosts: any[] = [];
  let tags: any[] = [];
  let featuredMember: any = null;
  let featuredHomepageEventSlug: string | null = null;
  let errorOccurred = false;

  try {
    const getFeaturedHomepageEventSlug = async (): Promise<string | null> => {
      try {
        if (!adminDb) return null;
        const doc = await adminDb.collection('settings').doc('featured-homepage-event').get();
        if (!doc.exists) return null;
        const d = doc.data() as { slug?: unknown } | undefined;
        return typeof d?.slug === 'string' && d.slug.trim() ? d.slug.trim() : null;
      } catch (e) {
        console.error("Home page failed to read featured-homepage-event:", e);
        return null;
      }
    };

    const [
      featuredPostsRes,
      recentPostsRes,
      eventsRes,
      editorsBlogRes,
      fashionRes,
      healthRes,
      tagsRes,
      featuredHomepageEventRes,
      featuredMembersRes,
    ] = await Promise.all([
      getPosts({ limit: 5, filter: "featured:true", order: "published_at DESC" }).catch(() => []),
      getPosts({ limit: 15, order: "published_at DESC" }).catch(() => []),
      getPosts({ limit: 3, filter: "tag:events", order: "published_at DESC" }).catch(() => []),
      getPosts({ limit: 3, filter: "tag:editorial,tag:editors-blog,tag:editors", order: "published_at DESC" }).catch(() => []),
      getPosts({ limit: 3, filter: "tag:fashion-lifestyle", order: "published_at DESC" }).catch(() => []),
      getPosts({ limit: 3, filter: "tag:health-wellbeing", order: "published_at DESC" }).catch(() => []),
      getTags({ limit: 5, include: 'count.posts', order: 'count.posts DESC' }).catch(() => []),
      getFeaturedHomepageEventSlug(),
      getFeaturedMembers(),
    ]);

    featuredPosts = featuredPostsRes;
    recentPosts = recentPostsRes;
    latestEvents = eventsRes;
    editorsBlogPosts = editorsBlogRes;
    fashionPosts = fashionRes;
    healthPosts = healthRes;
    tags = tagsRes;
    featuredHomepageEventSlug = featuredHomepageEventRes;
    featuredMember = featuredMembersRes.length > 0 ? featuredMembersRes[0] : null;
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
  const {
    heroPosts,
    gridRecent,
    diagnostics: heroDiag,
  } = applyFeaturedStalenessFallback(featuredPosts, recentPosts);
  const gridPosts = gridRecent.slice(0, 6);

  const heroTop3 = [...heroPosts].sort((a: any, b: any) => {
    const da = (parsePostDate(a?.published_at ?? a?.publishedAt)?.getTime() ?? 0) * -1;
    const db = (parsePostDate(b?.published_at ?? b?.publishedAt)?.getTime() ?? 0) * -1;
    return da - db;
  }).slice(0, 3);

  if (heroDiag.staleFeaturedDropped || heroDiag.filledFromRecent) {
    console.info(
      `[homepage] featured staleness fallback: dropStale=${heroDiag.staleFeaturedDropped} fillFromRecent=${heroDiag.filledFromRecent} fresh=${heroDiag.freshFeatured}/${heroDiag.featuredTotal} staleDates=${JSON.stringify(heroDiag.staleDates)} heroDates=${JSON.stringify(heroDiag.heroDates)}`
    );
  }

  return (
    <div className="bg-background">
      <NewsletterPopup />
      <div className="flex-1">
        <HeroSection posts={heroPosts} recentPosts={heroTop3} />
        <ArticleGrid posts={gridPosts} />
        <LatestEvents events={latestEvents} featuredHomepageEventSlug={featuredHomepageEventSlug} />
        <CategorySection title="Editors Blog" posts={editorsBlogPosts} tagSlug="editorial" />
        <CategorySection title="Fashion & Lifestyle" posts={fashionPosts} />
        <FeaturedInterview member={featuredMember} />
        <CategorySection title="Health & Wellbeing" posts={healthPosts} />
        <CategoriesSection tags={tags} />
        <HomeEconomicInsights />
        <MagazineExperience />
        <NewsletterSection />
        <TestimonialsSection />
      </div>
    </div>
  );
}
