import { MetadataRoute } from 'next';
import { getPosts } from '@/lib/ghost';
import { ENDPOINTS } from '@/lib/firebase-functions';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk';

  // 1. Core static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/members`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/membership`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }
  ];

  // 2. Fetch all public Ghost posts (News & Events)
  let postPages: MetadataRoute.Sitemap = [];
  try {
    // Fetch a large limit for the sitemap, or implement pagination if needed
    const posts = await getPosts({ limit: 1000 });
    
    if (posts && posts.length > 0) {
      postPages = posts.map((post: any) => ({
        url: `${siteUrl}/news/${post.slug}`,
        lastModified: new Date(post.updated_at || post.published_at),
        changeFrequency: 'weekly',
        priority: 0.7,
      }));
    }
  } catch (error) {
    console.error('Sitemap: Error fetching Ghost posts', error);
  }

  // 3. Fetch all public Member Profiles
  let memberPages: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(ENDPOINTS.getMembers, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.members) {
        memberPages = data.members.map((member: any) => ({
          url: `${siteUrl}/members/${member.slug || member.id}`,
          lastModified: new Date(member.updatedAt || Date.now()),
          changeFrequency: 'monthly',
          priority: 0.6,
        }));
      }
    }
  } catch (error) {
    console.error('Sitemap: Error fetching members', error);
  }

  return [...staticPages, ...postPages, ...memberPages];
}
