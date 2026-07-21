import { MetadataRoute } from 'next';
import { listEditions } from '@/features/magazine/server/edition-repository';

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

  // Dynamic magazine editions (V2 reader URLs)
  const editions = await listEditions(50).catch(() => [])
  const editionRoutes = editions.map((edition) => ({
    url: `${baseUrl}/magazine/v2/${edition.slug}`,
    lastModified: edition.updatedAt || edition.publishDate || new Date().toISOString(),
    changeFrequency: 'monthly' as const,
    priority: edition.isLive ? 0.9 : 0.6,
  }))

  return [...routes, ...editionRoutes]
}
