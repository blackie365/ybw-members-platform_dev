/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    swcTraceProfiling: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'admin.yorkshirebusinesswoman.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'static.ghost.org',
      },
      {
        protocol: 'https',
        hostname: 'image.isu.pub',
      },
      {
        protocol: 'https',
        hostname: 'image.issuu.com',
      },
      {
        protocol: 'https',
        hostname: 'img.rocket.new',
      },
    ],
  },
  async redirects() {
    return [
      // RSS feed was removed; point old subscribers/crawlers at the news listing.
      { source: '/rss', destination: '/news', permanent: true },
      { source: '/feed', destination: '/news', permanent: true },
      // Legacy Ghost pagination URLs (no longer exist) -> news listing.
      { source: '/page/:page', destination: '/news', permanent: true },
      { source: '/tag/:slug/page/:page', destination: '/news', permanent: true },
      { source: '/news/page/:page', destination: '/news', permanent: true },
    ];
  },
}

export default nextConfig
