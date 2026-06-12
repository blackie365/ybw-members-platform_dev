import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import { Providers } from '@/app/providers';
import { Header } from "@/components/magazine/header";
import { Footer } from "@/components/magazine/footer";
import { NewsTicker } from "@/components/magazine/news-ticker";
import { getPosts } from "@/lib/ghost";
import { CookieBanner } from "@/components/cookie-banner";
import './globals.css';

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: '--font-serif'
});

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-sans'
});

// Build a valid metadataBase URL. NEXT_PUBLIC_SITE_URL may be set without a
// protocol (e.g. "yorkshirebusinesswoman.co.uk"), which makes `new URL()` throw
// "Invalid URL" and 500s every page. Normalize it and fall back safely.
function resolveSiteUrl(): URL {
  const fallback = 'https://yorkshirebusinesswoman.co.uk';
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate = raw
    ? /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    : fallback;
  try {
    return new URL(candidate);
  } catch {
    return new URL(fallback);
  }
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: 'Yorkshire BusinessWoman | Business Magazine for Women',
  description: 'Empowering businesswomen across Yorkshire with networking, support, and recognition.',
  generator: 'v0.app',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Yorkshire BusinessWoman | Business Magazine for Women',
    description: 'Empowering businesswomen across Yorkshire with networking, support, and recognition.',
    url: '/',
    siteName: 'Yorkshire BusinessWoman',
    locale: 'en_GB',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yorkshire BusinessWoman | Business Magazine for Women',
    description: 'Empowering businesswomen across Yorkshire with networking, support, and recognition.'
  },
  icons: {
    icon: [
    {
      url: '/icon-light-32x32.png',
      media: '(prefers-color-scheme: light)'
    },
    {
      url: '/icon-dark-32x32.png',
      media: '(prefers-color-scheme: dark)'
    },
    {
      url: '/icon.svg',
      type: 'image/svg+xml'
    }],

    apple: '/apple-icon.png'
  },
  robots: {
    index: true,
    follow: true
  }
};

export default async function RootLayout({
  children

}: Readonly<{children: React.ReactNode;}>) {
  const trendingPosts = await getPosts({
    limit: 8,
    filter: "published_at:>='2024-01-01'",
    order: 'published_at DESC'
  }).catch(() => []);

  // Only enable Clerk when a publishable key is actually present. Without a key,
  // ClerkProvider falls into "keyless mode" and injects a client-side overlay
  // that never resolves, which blocks the preview with an infinite spinner.
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const tree = (
      <html lang="en" className="bg-background" suppressHydrationWarning>
        <body className={`${playfair.variable} ${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
          {/* Organization Schema */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Yorkshire BusinessWoman",
                "url": "https://yorkshirebusinesswoman.co.uk",
                "logo": "https://img.rocket.new/generatedImages/rocket_gen_img_170351519-1780874732339.png",
                "description": "Empowering businesswomen across Yorkshire with networking, support, and recognition.",
                "sameAs": [
                "https://www.facebook.com/YorkshireBusinesswoman",
                "https://twitter.com/YorkshireBW",
                "https://www.linkedin.com/company/yorkshire-businesswoman"]

              })
            }} />
          
          <Providers>
            <Header />
            <NewsTicker posts={trendingPosts} />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
            <CookieBanner />
          </Providers>
          {process.env.NODE_ENV === 'production' && <Analytics />}
          
          {/* Google Analytics */}
          {(process.env.NEXT_PUBLIC_GA_ID || 'G-DG46YGJBYR') &&
          <>
              <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID || 'G-DG46YGJBYR'}`}
              strategy="afterInteractive" />
            
              <Script id="google-analytics" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());

                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID || 'G-DG46YGJBYR'}');
                `}
              </Script>
            </>
          }

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fybwmember8082back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.19" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></body>
      </html>
  );

  if (!clerkPublishableKey) {
    return tree;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      {tree}
    </ClerkProvider>
  );
}
