import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/'], // Protect private routes
    },
    sitemap: 'https://yorkshirebusinesswoman.co.uk/sitemap.xml',
  };
}
