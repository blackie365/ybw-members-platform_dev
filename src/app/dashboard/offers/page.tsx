import { getPosts } from '@/lib/ghost';
import MemberOffersClient from './MemberOffersClient';

export const revalidate = 3600;

export default async function DashboardOffers() {
  // Fetch posts from Ghost that are tagged with either 'member-offers' or '#member-offer'
  // Ghost internal tags start with hash-
  const offers = await getPosts({ limit: 50, filter: 'tag:member-offers,tag:hash-member-offer' });

  return <MemberOffersClient initialOffers={offers} />;
}