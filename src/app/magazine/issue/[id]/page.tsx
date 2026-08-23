import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getMagazineIssueServer, getMagazineIssuesServer, getMagazinePagesServer } from '@/lib/magazine-service-server';
import IssuuReader from '@/components/magazine/IssuuReader';
import FirebaseMagazineReader from '@/components/magazine/FirebaseMagazineReader';
import MagazineShell from '@/features/magazine/components/MagazineShell';
import { fixIssuuEmbedUrl } from '@/lib/magazine-utils';
import {
  getReaderEditionById,
  listReaderEditions,
} from '@/features/magazine/server/simple-reader';
import type { ReaderEdition } from '@/features/magazine/domain/types';
import { editionRecordsMatch } from '@/features/magazine/domain/edition-match';
import { deriveIssueSlug } from '@/features/magazine/domain/builder-to-reader';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const issue = await getMagazineIssueServer(id);
  return {
    title: issue ? `${issue.title} | Yorkshire BusinessWoman` : 'Magazine Edition',
    description: issue?.description || 'Read the latest edition of Yorkshire BusinessWoman magazine.',
  };
}

function pickLinkedReaderEdition(
  issue: any,
  readerEditions: ReaderEdition[],
): ReaderEdition | null {
  if (!issue) return null;
  const explicitId = String(issue.readerEditionId || '').trim();
  if (explicitId) {
    const direct = readerEditions.find((e) => e.id === explicitId) || null;
    if (direct) return direct;
  }
  const byIssueId = readerEditions.find(
    (e) => String((e as any).issueId || '') === String(issue.id || ''),
  );
  if (byIssueId) return byIssueId;
  const byMatch = readerEditions.find((edition) => editionRecordsMatch(issue, edition));
  return byMatch || null;
}

export default async function DigitalMagazinePage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const [directIssue, allIssues, readerEditions] = await Promise.all([
    getMagazineIssueServer(id),
    getMagazineIssuesServer(),
    listReaderEditions(100),
  ]);
  const issue = directIssue ?? allIssues.find((candidate) => candidate.id === id) ?? null;

  if (!issue) {
    redirect('/new-edition');
  }

  const canonicalSlug = deriveIssueSlug({
    id: String(issue.id || ''),
    title: String(issue.title || ''),
    ghostSyncTag: String((issue as any).ghostSyncTag || ''),
    readerEditionSlug: String((issue as any).readerEditionSlug || ''),
    slug: String((issue as any).slug || ''),
  }).trim().toLowerCase();
  const fallbackIdSlug = `issue-${String(issue.id || '').toLowerCase()}`;
  if (canonicalSlug && canonicalSlug !== fallbackIdSlug) {
    const sp = await searchParams;
    const query = new URLSearchParams();
    if (sp) {
      for (const [k, v] of Object.entries(sp)) {
        if (Array.isArray(v)) v.forEach((val) => query.append(k, String(val || '')));
        else if (v) query.set(k, String(v));
      }
    }
    const queryStr = query.toString();
    redirect(queryStr ? `/magazine/read/${canonicalSlug}?${queryStr}` : `/magazine/read/${canonicalSlug}`);
  }

  // Prefer a linked ReaderEdition whenever one exists — its pages[] are already
  // hydrated server-side with sanitized + repaired image URLs (1033 of 1033
  // exact storage matches for the Aug/Sept 2026 edition). MagazineShell is the
  // same renderer used by the working /magazine/read/[slug] route.
  let linkedFromReaderId: ReaderEdition | null = null;
  const explicitReaderId = String((issue as any).readerEditionId || '').trim();
  if (explicitReaderId) {
    try {
      linkedFromReaderId = await getReaderEditionById(explicitReaderId);
    } catch {
      linkedFromReaderId = null;
    }
  }
  const preferredReaderEdition =
    linkedFromReaderId ?? pickLinkedReaderEdition(issue, readerEditions);
  if (preferredReaderEdition && Array.isArray(preferredReaderEdition.pages) && preferredReaderEdition.pages.length > 0) {
    return <MagazineShell edition={preferredReaderEdition} />;
  }

  const pages = await getMagazinePagesServer(id);
  if (pages.length > 0) {
    return <FirebaseMagazineReader issue={issue} pages={pages} />;
  }

  // Fall back to Issuu embed if the issue has a flipbook / PDF URL
  const rawIssuuUrl = issue.flipbookUrl || issue.pdfUrl;
  if (rawIssuuUrl) {
    const embedUrl = fixIssuuEmbedUrl(rawIssuuUrl);
    return <IssuuReader url={embedUrl} title={issue.title ?? 'Yorkshire BusinessWoman'} />;
  }

  // Nothing renderable — bounce to the editions landing page
  redirect('/new-edition');
}
