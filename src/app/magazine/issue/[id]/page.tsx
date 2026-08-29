import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import type { ReaderEdition } from '@/features/magazine/domain/types';
import { editionRecordsMatch } from '@/features/magazine/domain/edition-match';
import { deriveIssueSlug } from '@/features/magazine/domain/builder-to-reader';

export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const issues = await getMagazineReadStore().getMagazineIssues();
    return issues.filter((i) => i && String(i.id || '').trim()).map((issue) => ({
      id: String(issue.id),
    }));
  } catch (e) {
    console.warn('[magazine/issue generateStaticParams] failed:', e);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const issue = await getMagazineReadStore().getMagazineIssue(id);
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

export default async function DigitalMagazinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getMagazineReadStore();
  const [directIssue, allIssues, readerEditions] = await Promise.all([
    store.getMagazineIssue(id),
    store.getMagazineIssues(),
    store.listReaderEditions(100),
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
    redirect(`/magazine/read/${canonicalSlug}`);
  }

  let linkedFromReaderId: ReaderEdition | null = null;
  const explicitReaderId = String((issue as any).readerEditionId || '').trim();
  if (explicitReaderId) {
    try {
      linkedFromReaderId = await store.getReaderEditionById(explicitReaderId);
    } catch {
      linkedFromReaderId = null;
    }
  }
  const preferredReaderEdition =
    linkedFromReaderId ?? pickLinkedReaderEdition(issue, readerEditions);
  if (preferredReaderEdition && Array.isArray(preferredReaderEdition.pages) && preferredReaderEdition.pages.length > 0) {
    redirect(`/magazine/read/${canonicalSlug || preferredReaderEdition.slug}`);
  }

  redirect('/new-edition');
}
