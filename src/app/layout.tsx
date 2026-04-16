import glob from 'fast-glob'
import { type Metadata } from 'next'

import { Providers } from '@/app/providers'
import { Layout } from '@/components/Layout'
import { type Section } from '@/components/SectionProvider'

import '@/styles/tailwind.css'

export const metadata: Metadata = {
  title: {
    template: '%s - Yorkshire Businesswoman',
    default: 'Yorkshire Businesswoman | Local Business News & Community',
  },
  description: 'The premier community and news platform for professionals and businesses across Yorkshire.',
  openGraph: {
    title: 'Yorkshire Businesswoman',
    description: 'The premier community and news platform for professionals and businesses across Yorkshire.',
    url: 'https://yorkshirebusinesswoman.co.uk',
    siteName: 'Yorkshire Businesswoman',
    locale: 'en_GB',
    type: 'website',
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let pages = await glob('**/*.mdx', { cwd: 'src/app' })
  let allSectionsEntries = (await Promise.all(
    pages.map(async (filename) => [
      '/' + filename.replace(/(^|\/)page\.mdx$/, ''),
      (await import(`./${filename}`)).sections,
    ]),
  )) as Array<[string, Array<Section>]>
  let allSections = Object.fromEntries(allSectionsEntries)

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full bg-white antialiased dark:bg-zinc-900">
        <Providers>
          <div className="w-full">
            <Layout allSections={allSections}>{children}</Layout>
          </div>
        </Providers>
      </body>
    </html>
  )
}
