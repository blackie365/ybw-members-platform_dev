import { Metadata } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yorkshire BusinessWoman',
    short_name: 'YBW',
    description: 'Empowering businesswomen across Yorkshire with networking, support, and recognition.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#A020F0',
    icons: [
      {
        src: '/icon-light-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}

import { MetadataRoute } from 'next'
