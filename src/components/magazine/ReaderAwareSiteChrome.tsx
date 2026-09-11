"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header, type HeaderAdConfig } from "@/components/magazine/header";
import { Footer } from "@/components/magazine/footer";
import { NewsTicker } from "@/components/magazine/news-ticker";
import { CookieBanner } from "@/components/cookie-banner";

type NewsPost = {
  id: string;
  title: string;
  slug: string;
};

type ReaderAwareSiteChromeProps = {
  children: ReactNode;
  headerAd?: HeaderAdConfig;
  trendingPosts: NewsPost[];
};

/**
 * The digital reader owns its entire viewport. Every other route retains the
 * normal YBW site frame; only /magazine/read/* becomes a distraction-free
 * reading environment.
 */
export function ReaderAwareSiteChrome({
  children,
  headerAd,
  trendingPosts,
}: ReaderAwareSiteChromeProps) {
  const pathname = usePathname();
  const isDigitalReader = pathname?.startsWith("/magazine/read/");

  if (isDigitalReader) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Header headerAd={headerAd} />
      <NewsTicker posts={trendingPosts} />
      <main className="flex-1">{children}</main>
      <Footer />
      <CookieBanner />
    </>
  );
}
