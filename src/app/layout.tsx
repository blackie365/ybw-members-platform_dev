import type { Metadata } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/app/providers'
import { Header } from "@/components/magazine/header"
import { Footer } from "@/components/magazine/footer"
import { NewsTicker } from "@/components/magazine/news-ticker"
import { getPosts } from "@/lib/ghost"
import './globals.css'

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: '--font-serif'
});

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-sans'
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk'),
  title: 'Yorkshire Businesswoman | Business Magazine for Women',
  description: 'The premier digital magazine for ambitious businesswomen. Leadership insights, industry analysis, and inspiring stories.',
  generator: 'v0.app',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Yorkshire Businesswoman | Business Magazine for Women',
    description: 'The premier digital magazine for ambitious businesswomen. Leadership insights, industry analysis, and inspiring stories.',
    url: '/',
    siteName: 'Yorkshire Businesswoman',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yorkshire Businesswoman | Business Magazine for Women',
    description: 'The premier digital magazine for ambitious businesswomen. Leadership insights, industry analysis, and inspiring stories.',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const trendingPosts = await getPosts({ 
    limit: 8, 
    filter: "published_at:>='2024-01-01'", 
    order: 'published_at DESC' 
  }).catch(() => []);

  return (
    <html lang="en" className="bg-background">
      <body className={`${playfair.variable} ${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <Providers>
          <Header />
          <NewsTicker posts={trendingPosts} />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
