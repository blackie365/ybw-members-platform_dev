import { MetadataRoute } from 'next';
import { listReaderEditions } from '@/features/magazine/server/simple-reader';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk'

  const routes = [
    '',
    '/membership',
    '/about',
    '/contact',
    '/news',
    '/new-edition',
    '/events',
    '/offers',
    '/members',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  const editions = await listReaderEditions(50).catch(() => [])
  const editionRoutes = editions.map((edition) => ({
    url: `${baseUrl}/magazine/read/${edition.slug}`,
    lastModified: edition.createdAt || new Date().toISOString(),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }))

  return [...routes, ...editionRoutes]
}
