/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  serverActions: {
    bodySizeLimit: '10mb',
  },
  staticPageGenerationTimeout: 180,
  experimental: {
    swcTraceProfiling: false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
