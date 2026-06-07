import { MetadataRoute } from 'next';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk'

  // Static routes
  const routes = [
    '',
    '/membership',
    '/dashboard',
    '/news',
    '/new-edition',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  // Dynamic magazine issues
  const issues = await getMagazineIssuesServer()
  const issueRoutes = issues.map((issue) => ({
    url: `${baseUrl}/magazine/issue/${issue.id}`,
    lastModified: issue.publishDate || new Date().toISOString(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...routes, ...issueRoutes]
}
