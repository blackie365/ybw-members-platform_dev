/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  staticPageGenerationTimeout: 180,
  experimental: {
    swcTraceProfiling: false,
    // src/middleware.ts canonicalises same-route requests to the public origin
    // (postProcess -> x-middleware-rewrite). Next.js treats an absolute-URL
    // rewrite as an *external* proxy, so the app makes a real outbound request
    // to its own public domain and back, and that proxy is hard-capped at 30s
    // (node_modules/next/dist/server/lib/router-utils/proxy-request.js:
    // `proxyTimeout || 30000`). Any legitimate request slower than 30s then
    // dies with a bare "Internal Server Error" 500 even though the work itself
    // completes — e.g. approving a social post, where the Instagram media
    // container takes ~45s to process. Raise the cap to match nginx's
    // proxy_read_timeout (180s) for this vhost.
    proxyTimeout: 180000,
    serverActions: {
      bodySizeLimit: '10mb',
    },
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
      {
        protocol: 'https',
        hostname: 'yorkshirebusinesswoman.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
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
      // Corrected slug: "exclipse" typo fixed to "eclipse". Keep the old URL alive.
      { source: '/news/sunshine-trains-and-an-exclipse', destination: '/news/sunshine-trains-and-an-eclipse', permanent: true },
      { source: '/sunshine-trains-and-an-exclipse', destination: '/news/sunshine-trains-and-an-eclipse', permanent: true },
      // Corrected directory slug: "huntingotn" typo fixed to "huntington".
      { source: '/members/brogan-huntingotn', destination: '/members/brogan-huntington', permanent: true },
    ];
  },
}

export default nextConfig
