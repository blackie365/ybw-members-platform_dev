import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk'

  return {
    rules: [
      // AI / scraping crawlers: high request volumes, no referrer value.
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'OAI-SearchBot',
          'ClaudeBot',
          'Claude-Web',
          'PerplexityBot',
          'CCBot',
          'Bytespider',
          'PetalBot',
          'Amazonbot',
          'Google-Extended',
          'Applebot-Extended',
          'meta-externalagent',
        ],
        disallow: '/',
      },
      // High-volume SEO crawlers known to hammer sites repeatedly.
      {
        userAgent: [
          'AhrefsBot',
          'SemrushBot',
          'MJ12bot',
          'DotBot',
          'DataForSeoBot',
          'Barkrowler',
          'Exabot',
        ],
        disallow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/dashboard/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
