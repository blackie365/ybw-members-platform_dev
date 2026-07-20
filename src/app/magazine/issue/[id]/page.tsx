import React from 'react';
import { getMagazineIssueServer, getMagazinePagesServer } from '@/lib/magazine-service-server';
import MagazineReader from '@/components/magazine/MagazineReader';
import IssuuReader from '@/components/magazine/IssuuReader';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { siteContent } from '@/lib/site-content';
import { getPrimaryMagazineV2HrefForLegacyIssue } from '@/features/magazine/server/public-reader';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const issue = await getMagazineIssueServer(id);
  const fallbackIssue: any =
    id === 'demo'
      ? (siteContent.magazine.issues.find((i) => i.isLatest) ?? siteContent.magazine.issues[0] ?? null)
      : null;
  const resolvedIssue: any = issue ?? fallbackIssue;
  
  return {
    title: resolvedIssue ? `${resolvedIssue.title} | Yorkshire BusinessWoman` : 'Magazine Edition',
    description: resolvedIssue?.description || 'Read the latest edition of Yorkshire BusinessWoman magazine.',
  };
}

export default async function DigitalMagazinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fetch data on the server using Admin SDK (bypasses Firestore rules)
  const [issue, pages] = await Promise.all([
    getMagazineIssueServer(id),
    getMagazinePagesServer(id)
  ]);

  const fallbackIssue: any =
    id === 'demo'
      ? (siteContent.magazine.issues.find((i) => i.isLatest) ?? siteContent.magazine.issues[0] ?? null)
      : null;

  const resolvedIssue: any = issue ?? fallbackIssue;

  if (resolvedIssue) {
    const premiumReaderHref = await getPrimaryMagazineV2HrefForLegacyIssue(resolvedIssue);
    if (premiumReaderHref) {
      redirect(premiumReaderHref);
    }
  }

  if (!resolvedIssue) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center text-white p-8 text-center">
        <div className="max-w-md">
          <h1 className="text-4xl font-serif mb-6">Edition Not Found</h1>
          <p className="text-zinc-400 mb-10 leading-relaxed">
            We couldn&apos;t find the specific magazine edition you&apos;re looking for.
          </p>
          <Button asChild variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800 px-8 py-6 h-auto">
            <Link href="/admin/magazine">Return to Studio</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Handle Issuu Reader Type
  if (resolvedIssue.readerType === 'issuu' && resolvedIssue.pdfUrl) {
    return <IssuuReader url={resolvedIssue.pdfUrl} title={resolvedIssue.title} />;
  }

  // Fallback to static content ONLY if we are looking at the "demo" ID 
  // or if Firestore is truly empty for a new issue.
  const displayPages = pages.length > 0 ? pages : (id === 'demo' ? siteContent.magazinePages : []);

  if (displayPages.length === 0) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center text-white p-8 text-center">
        <div className="max-w-md">
          <h1 className="text-4xl font-serif mb-6">Empty Edition</h1>
          <p className="text-zinc-400 mb-10 leading-relaxed">
            This edition doesn&apos;t have any pages yet. Please add content in the builder or set an Issuu link.
          </p>
          <Button asChild variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800 px-8 py-6 h-auto">
            <Link href="/admin/magazine">Return to Studio</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Pass server-fetched data to the client-side interactive reader
  return (
    <>
      {/* Magazine Edition Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "PublicationIssue",
            "name": resolvedIssue.title,
            "description": resolvedIssue.description,
            "issueNumber": id,
            "datePublished": resolvedIssue.publishDate,
            "image": resolvedIssue.coverImage,
            "isPartOf": {
              "@type": "Periodical",
              "name": "Yorkshire BusinessWoman Magazine",
              "issn": "2633-3511", // Standard for magazines
              "publisher": "Yorkshire BusinessWoman"
            }
          })
        }}
      />
      <MagazineReader issue={resolvedIssue as any} pages={displayPages as any} id={id} />
    </>
  );
}
