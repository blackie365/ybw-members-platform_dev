import { getPosts } from '@/lib/ghost';
import { adminDb } from '@/lib/firebase-admin';
import MemberOffersClient from '@/app/dashboard/offers/MemberOffersClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getAllActiveOffers() {
  try {
    if (!adminDb) return [];
    
    // 1. Fetch ALL ACTIVE offers from Firestore
    const snapshot = await adminDb?.collection('offer_requests')?.where('status', '==', 'active')?.get();
    
    const firestoreOffers = snapshot?.docs?.map(doc => {
      const data = doc?.data();
      return {
        id: doc?.id,
        title: data?.title || 'Untitled Offer',
        feature_image: data?.imageUrl || null,
        slug: data?.link ? '' : `internal-${doc?.id}`, 
        excerpt: data?.description || '',
        primary_author: { name: data?.userName || 'Member' },
        isFirestoreOffer: true,
        link: data?.link || '',
        isMembersOnly: data?.isMembersOnly ?? true,
        published_at: data?.createdAt || new Date()?.toISOString(),
        status: data?.status
      };
    });

    return firestoreOffers;
  } catch (error) {
    console.error('Error fetching all active Firestore offers:', error);
    return [];
  }
}

export default async function PublicOffersPage() {
  // 1. Fetch all active offers from Firestore
  const firestoreOffers = await getAllActiveOffers();
  
  // 2. Fetch public posts from Ghost (posts with member-offers tag are generally public unless we filter otherwise)
  const ghostOffers = await getPosts({ limit: 50, filter: 'tag:member-offers,tag:hash-member-offer' });
  
  const allOffers = [...firestoreOffers, ...ghostOffers];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-primary py-20 sm:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70 mb-4">
              Exclusive Opportunities
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-primary-foreground sm:text-5xl capitalize text-balance">
              Member & Partner Offers
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-primary-foreground/70">
              Explore exclusive discounts, perks, and opportunities from our network. 
              Some offers are exclusive to members.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-20">
        <MemberOffersClient initialOffers={allOffers} isPublicBoard={true} />
        
        <div className="mt-12 p-8 border border-dashed border-border rounded-xl bg-card text-center">
          <h3 className="font-serif text-xl font-medium mb-4">Want access to exclusive member-only offers?</h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto text-sm leading-relaxed">
            Join the Yorkshire Businesswoman community today to unlock all perks, 
            networking events, and member-only discounts.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/membership" 
              className="px-6 py-2.5 bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
            >
              View Membership Tiers
            </Link>
            <Link 
              href="/sign-in" 
              className="px-6 py-2.5 border border-border text-foreground font-medium hover:bg-muted transition-colors"
            >
              Member Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
