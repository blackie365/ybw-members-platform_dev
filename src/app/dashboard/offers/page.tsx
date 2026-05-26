import { getPosts } from '@/lib/ghost';
import MemberOffersClient from './MemberOffersClient';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getFirestoreOffers() {
  try {
    if (!adminDb) {
      console.warn('adminDb not initialized in DashboardOffers');
      return [];
    }
    
    console.log('Fetching Firestore offers...');
    const offersRef = adminDb.collection('offer_requests');
    // Fetch everything and filter in JS to be safe against status case sensitivity
    const snapshot = await offersRef.get();
    
    console.log(`Found ${snapshot.size} total offers in Firestore`);
    
    const activeOffers = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled Offer',
          feature_image: data.imageUrl || null,
          slug: data.link ? '' : `internal-${doc.id}`, 
          excerpt: data.description || '',
          primary_author: { name: data.userName || 'Member' },
          isFirestoreOffer: true,
          link: data.link || '',
          isMembersOnly: data.isMembersOnly ?? true,
          published_at: data.createdAt || new Date().toISOString(),
          status: data.status // Explicitly include for filtering
        };
      })
      .filter(offer => offer.status === 'active');
    
    console.log(`Returning ${activeOffers.length} active Firestore offers`);
    return activeOffers;
  } catch (error) {
    console.error('Error fetching Firestore offers:', error);
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
  
  console.log(`Total offers for dashboard: ${allOffers.length}`);

  return <MemberOffersClient initialOffers={allOffers} />;
}