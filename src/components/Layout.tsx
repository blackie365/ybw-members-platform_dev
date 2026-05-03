'use client'

import { usePathname } from 'next/navigation'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { TopBanner } from '@/components/TopBanner'
import { SectionProvider, type Section } from '@/components/SectionProvider'

export function Layout({
  children,
  allSections,
}: {
  children: React.ReactNode
  allSections: Record<string, Array<Section>>
}) {
  let pathname = usePathname()

  // We are now exclusively using the full-width Magazine layout!
  return (
    <SectionProvider sections={allSections[pathname] ?? []}>
      <div className="flex min-h-screen flex-col bg-background text-foreground font-sans">
        <TopBanner />
        <Header />
        <main className="flex-auto">{children}</main>
        <Footer />
      </div>
    </SectionProvider>
  );
}