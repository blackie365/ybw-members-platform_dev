import React from 'react';
import { getMagazineIssueServer, getMagazinePagesServer } from '@/lib/magazine-service-server';
import DigitalReaderClient from './DigitalReaderClient';
import Link from 'next/link';
import { siteContent } from '@/lib/site-content';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Digital Reader | Yorkshire BusinessWoman',
  description: 'Read the latest edition of Yorkshire BusinessWoman magazine in our redesigned digital reader.',
};

export default async function DigitalReaderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id = 'demo' } = await searchParams;

  const [issue, pages] = await Promise.all([
    getMagazineIssueServer(id),
    getMagazinePagesServer(id),
  ]);

  const fallbackIssue: any =
    id === 'demo'
      ? (siteContent.magazine.issues.find((i: any) => i.isLatest) ??
          siteContent.magazine.issues[0] ??
          null)
      : null;

  const resolvedIssue: any = issue ?? fallbackIssue;

  if (!resolvedIssue) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div style={{ textAlign: 'center', color: '#fff', maxWidth: 400, padding: '2rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', marginBottom: '1rem' }}>
            Edition Not Found
          </h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>
            We couldn&apos;t find the edition you&apos;re looking for.
          </p>
          <Link
            href="/new-edition"
            style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              border: '1px solid #444',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            Browse Archive
          </Link>
        </div>
      </div>
    );
  }

  const displayPages =
    pages.length > 0
      ? pages
      : id === 'demo'
      ? siteContent.magazinePages
      : [];

  if (displayPages.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div style={{ textAlign: 'center', color: '#fff', maxWidth: 400, padding: '2rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', marginBottom: '1rem' }}>
            Empty Edition
          </h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>
            This edition has no pages yet.
          </p>
          <Link
            href="/new-edition"
            style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              border: '1px solid #444',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            Browse Archive
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DigitalReaderClient
      issue={resolvedIssue}
      pages={displayPages as any}
      issueId={id}
    />
  );
}
