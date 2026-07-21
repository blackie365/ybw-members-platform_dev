import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getMagazineIssueServer } from '@/lib/magazine-service-server';
import IssuuReader from '@/components/magazine/IssuuReader';
import { getPrimaryMagazineV2HrefForLegacyIssue } from '@/features/magazine/server/public-reader';
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
  const issue = await getMagazineIssueServer(id);

  // Redirect to V2 premium reader if an assembled edition is ready
  if (issue) {
    const v2href = await getPrimaryMagazineV2HrefForLegacyIssue(issue);
    if (v2href) redirect(v2href);
  }

  // Fall back to Issuu embed if the issue has a flipbook / PDF URL
  const rawIssuuUrl = issue?.flipbookUrl || issue?.pdfUrl;
  if (rawIssuuUrl) {
    const embedUrl = fixIssuuEmbedUrl(rawIssuuUrl);
    return <IssuuReader url={embedUrl} title={issue?.title ?? 'Yorkshire BusinessWoman'} />;
  }

  // Nothing renderable — bounce to the editions landing page
  redirect('/new-edition');
}
