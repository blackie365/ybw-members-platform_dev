import { getPosts } from '@/lib/ghost';
import OpportunitiesClient from './OpportunitiesClient';

export const revalidate = 3600;

export default async function DashboardOpportunities() {
  // Fetch posts from Ghost that are tagged with 'jobs' or 'opportunities'
  const opportunities = await getPosts({ limit: 50, filter: 'tag:jobs,tag:opportunities,tag:hash-opportunities' });

  return <OpportunitiesClient initialOpportunities={opportunities} />;
}