import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getMagazineIssueServer, getMagazineIssuesServer, getMagazinePagesServer } from '@/lib/magazine-service-server';
import IssuuReader from '@/components/magazine/IssuuReader';
import FirebaseMagazineReader from '@/components/magazine/FirebaseMagazineReader';
import { fixIssuuEmbedUrl } from '@/lib/magazine-utils';

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
  const [directIssue, allIssues] = await Promise.all([
    getMagazineIssueServer(id),
    getMagazineIssuesServer(),
  ]);
  const issue = directIssue ?? allIssues.find((candidate) => candidate.id === id) ?? null;

  if (!issue) {
    redirect('/new-edition');
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
