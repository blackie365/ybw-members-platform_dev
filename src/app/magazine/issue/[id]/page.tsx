import React from 'react';
import { getMagazineIssueServer, getMagazinePagesServer } from '@/lib/magazine-service-server';
import MagazineReader from '@/components/magazine/MagazineReader';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const issue = await getMagazineIssueServer(id);
  
  return {
    title: issue ? `${issue.title} | Yorkshire BusinessWoman` : 'Magazine Edition',
    description: issue?.description || 'Read the latest edition of Yorkshire BusinessWoman magazine.',
  };
}

export default async function DigitalMagazinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fetch data on the server using Admin SDK (bypasses Firestore rules)
  const [issue, pages] = await Promise.all([
    getMagazineIssueServer(id),
    getMagazinePagesServer(id)
  ]);

  if (!issue || pages.length === 0) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center text-white p-8 text-center">
        <div className="max-w-md">
          <h1 className="text-4xl font-serif mb-6">Edition Not Found</h1>
          <p className="text-zinc-400 mb-10 leading-relaxed">
            We couldn&apos;t find the specific magazine edition you&apos;re looking for. It may have been moved or is currently being updated.
          </p>
          <Button asChild variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800 px-8 py-6 h-auto">
            <Link href="/new-edition">Return to Archive</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Pass server-fetched data to the client-side interactive reader
  return <MagazineReader issue={issue} pages={pages} id={id} />;
}
