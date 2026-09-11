import { getPosts } from '@/lib/ghost';
import MemberOffersClient from './MemberOffersClient';
import { getOfferRequestStore } from '@/features/offers/server/offer-request-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getFirestoreOffers() {
  try {
    const rows = await getOfferRequestStore().list({ orderCreatedDesc: true });

    const activeOffers = rows.map(row => {
        const data = row.data ?? {};
        const mapped = {
          id: row.id,
          title: typeof data.title === 'string' && data.title ? data.title : 'Untitled Offer',
          feature_image: typeof data.imageUrl === 'string' && data.imageUrl ? data.imageUrl : null,
          slug: typeof data.link === 'string' && data.link ? '' : `internal-${row.id}`,
          excerpt: typeof data.description === 'string' ? data.description : '',
          primary_author: { name: typeof data.userName === 'string' && data.userName ? data.userName : 'Member' },
          isFirestoreOffer: true,
          link: typeof data.link === 'string' ? data.link : '',
          isMembersOnly: typeof data.isMembersOnly === 'boolean' ? data.isMembersOnly : row.isMembersOnly ?? true,
          published_at: row.createdAt ?? typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
          status: typeof data.status === 'string' ? data.status : row.status,
        };
        return mapped;
      })?.filter(offer => {
        // In the dashboard, we show all active offers (both public and members-only)
        return offer?.status === 'active';
      });

    return activeOffers;
  } catch (error) {
    console.error('Error fetching dashboard offers:', error);
    return [];
  }
}

export default async function DashboardOffers() {
  // 1. Fetch approved offers from Firestore first (highest priority)
  const firestoreOffers = await getFirestoreOffers();
  
  // 2. Fetch posts from Ghost that are tagged with either 'member-offers' or '#member-offer'
  const ghostOffers = await getPosts({ limit: 50, filter: 'tag:member-offers,tag:hash-member-offer' });
  
  // Combine
  const allOffers = [...firestoreOffers, ...ghostOffers];
  
  console.log(`Total offers for dashboard: ${allOffers?.length}`);

  return <MemberOffersClient initialOffers={allOffers} />;
}