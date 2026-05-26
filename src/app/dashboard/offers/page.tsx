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
    
    const offersRef = adminDb.collection('offer_requests');
    const snapshot = await offersRef.where('status', '==', 'active').get();
    
    console.log(`Fetched ${snapshot.size} active Firestore offers`);
    
    return snapshot.docs.map(doc => {
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
        published_at: data.createdAt || new Date().toISOString()
      };
    });
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