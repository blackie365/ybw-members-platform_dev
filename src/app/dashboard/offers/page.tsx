import { getPosts } from '@/lib/ghost';
import MemberOffersClient from './MemberOffersClient';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getFirestoreOffers() {
  try {
    if (!adminDb) return [];
    
    const offersRef = adminDb.collection('offer_requests');
    const snapshot = await offersRef.where('status', '==', 'active').get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        feature_image: data.imageUrl || null,
        slug: data.link || '#', // Internal offers might not have a Ghost slug
        excerpt: data.description,
        primary_author: { name: data.userName },
        isFirestoreOffer: true,
        link: data.link,
        isMembersOnly: data.isMembersOnly ?? true
      };
    });
  } catch (error) {
    console.error('Error fetching Firestore offers:', error);
    return [];
  }
}

export default async function DashboardOffers() {
  // 1. Fetch posts from Ghost that are tagged with either 'member-offers' or '#member-offer'
  const ghostOffersPromise = getPosts({ limit: 50, filter: 'tag:member-offers,tag:hash-member-offer' });
  
  // 2. Fetch approved offers from Firestore
  const firestoreOffersPromise = getFirestoreOffers();
  
  const [ghostOffers, firestoreOffers] = await Promise.all([
    ghostOffersPromise,
    firestoreOffersPromise
  ]);

  // Combine and sort by date if possible (Firestore offers have createdAt)
  const allOffers = [...firestoreOffers, ...ghostOffers];

  return <MemberOffersClient initialOffers={allOffers} />;
}