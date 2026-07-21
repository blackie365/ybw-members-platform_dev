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
      }
    ],
  },
}

export default nextConfig
