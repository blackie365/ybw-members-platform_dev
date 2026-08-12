import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Calendar, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPosts } from '@/lib/ghost';
import { fixMagazineImageUrl, fixIssuuEmbedUrl } from '@/lib/magazine-utils';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';
import { listReaderEditions } from '@/features/magazine/server/simple-reader';
import type { ReaderEdition } from '@/features/magazine/domain/types';
import { editionRecordsMatch } from '@/features/magazine/domain/edition-match';

export const revalidate = 0; // Disable cache for debugging

export const metadata: Metadata = {
  title: 'Latest Edition',
  description: 'Read the latest edition of the Yorkshire BusinessWoman magazine online.',
  openGraph: {
    title: 'Latest Edition | Yorkshire BusinessWoman',
    description: 'Read the latest edition of the Yorkshire BusinessWoman magazine online.',
    type: 'website',
  },
};

const CURRENT_ISSUE_COVER_IMAGE =
  'https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/magazine%2Fjune-july%2Fybw_JUNE_clean_2026.jpg?alt=media&token=647ff4b0-8ee8-4141-8304-bd638f17913d';

function isCopySlug(value: unknown): boolean {
  return /copy/i.test(String(value || ''));
}

function getTimestamp(value: unknown): number {
  const parsed = new Date(String(value || ''));
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function compareReaderEditions(left: any, right: any): number {
  const leftIsCopy = isCopySlug(left?.slug);
  const rightIsCopy = isCopySlug(right?.slug);

  if (leftIsCopy !== rightIsCopy) {
    return leftIsCopy ? 1 : -1;
  }

  const leftCreated = getTimestamp(left?.createdAt);
  const rightCreated = getTimestamp(right?.createdAt);
  if (leftCreated !== rightCreated) {
    return rightCreated - leftCreated;
  }

  const leftPublished = getTimestamp(left?.publishDate);
  const rightPublished = getTimestamp(right?.publishDate);
  if (leftPublished !== rightPublished) {
    return rightPublished - leftPublished;
  }

  return String(right?.id || '').localeCompare(String(left?.id || ''));
}

function getEditionCoverImage(edition: ReaderEdition | null, version: number): string {
  if (!edition) return '';
  const coverPage = Array.isArray(edition.pages)
    ? edition.pages.find((page) => page?.template === 'cover')
    : undefined;
  const coverImage = String(coverPage?.content?.imageUrl || edition.coverImage || '');
  return fixMagazineImageUrl(coverImage, version);
}

function getArchiveCoverForEdition(
  edition: ReaderEdition,
  issues: Array<{ title?: string; publishDate?: string; coverImage?: string }>,
  version: number,
): string {
  const matchingIssue = issues.find((issue) => editionRecordsMatch(issue, edition));
  if (matchingIssue?.coverImage) {
    return fixMagazineImageUrl(matchingIssue.coverImage, version);
  }
  return getEditionCoverImage(edition, version);
}

export default async function NewEditionPage() {
  const [issues, ghostPosts, readerEditions] = await Promise.all([
    getMagazineIssuesServer(),
    getPosts({ limit: 1, filter: "featured:true" }),
    listReaderEditions()
  ]);

  const liveIssue = issues.find((issue) => issue.isLatest) ?? issues[0] ?? null;
  const matchedEditions = liveIssue
    ? readerEditions.filter((edition) => editionRecordsMatch(liveIssue, edition))
    : [];
  const preferredMatchedEdition = matchedEditions.length > 0
    ? [...matchedEditions].sort(compareReaderEditions)[0]
    : null;
  const latestReaderEdition =
    preferredMatchedEdition ??
    readerEditions[0] ??
    null;
  const matchedLatestLegacyIssue = latestReaderEdition
    ? issues.find((issue) => (
        editionRecordsMatch(issue, latestReaderEdition) &&
        (issue.flipbookUrl || issue.pdfUrl)
      )) ?? null
    : null;
  const flipbookIssue = latestReaderEdition
    ? matchedLatestLegacyIssue && (matchedLatestLegacyIssue.flipbookUrl || matchedLatestLegacyIssue.pdfUrl)
      ? matchedLatestLegacyIssue
      : null
    : issues.find((issue) => issue.featureInFlipbook && (issue.flipbookUrl || issue.pdfUrl))
      ?? issues.find((issue) => issue.isLatest && (issue.flipbookUrl || issue.pdfUrl))
      ?? issues.find((issue) => issue.flipbookUrl || issue.pdfUrl)
      ?? liveIssue;
  const rawFlipbookUrl = flipbookIssue?.flipbookUrl || flipbookIssue?.pdfUrl || null;
  const flipbookEmbedUrl = rawFlipbookUrl ? fixIssuuEmbedUrl(rawFlipbookUrl) : null;
  const archiveIssues = issues.filter((issue) => (
    Boolean(issue.flipbookUrl || issue.pdfUrl)
  ));
  const featuredPost = ghostPosts[0];

  const featuredEditionUrl = latestReaderEdition
    ? `/magazine/read/${latestReaderEdition.slug}`
    : liveIssue
      ? `/magazine/issue/${liveIssue.id}`
      : '/new-edition';
  console.log('[NewEditionPage] featuredPost:', featuredPost?.title);
  
  if (!liveIssue) {
    console.warn('[NewEditionPage] No latest issue found');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="font-serif text-2xl mb-4">Latest Edition</h2>
        <p className="text-muted-foreground">No magazine issues found in our database.</p>
        <div className="mt-8">
           <Link href="/" className="text-accent hover:underline">Return Home</Link>
        </div>
      </div>
    );
  }

  const IMAGE_VERSION = Date.now();
  const latestCoverImage = latestReaderEdition
    ? (getArchiveCoverForEdition(latestReaderEdition, issues, IMAGE_VERSION) ||
      fixMagazineImageUrl(CURRENT_ISSUE_COVER_IMAGE, IMAGE_VERSION))
    : fixMagazineImageUrl(CURRENT_ISSUE_COVER_IMAGE, IMAGE_VERSION);

  return (
    <main className="flex-1 bg-background">
      <section className="relative overflow-hidden bg-[#050505] py-24 text-white sm:py-32">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:32px_32px]" />
        </div>
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-white/10 blur-[140px]" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <Badge className="mb-6 border-none bg-accent px-4 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white">
                Latest Edition
              </Badge>
              <h1 className="font-serif text-5xl font-medium tracking-tight sm:text-7xl">
                {latestReaderEdition?.title || liveIssue?.title || 'Yorkshire BusinessWoman'}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
                {latestReaderEdition?.description || 'Read the latest Yorkshire BusinessWoman edition online in a polished magazine presentation.'}
              </p>

                <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                  <Button asChild size="lg" className="h-auto rounded-none border-none bg-[#A3413A] px-8 py-6 text-lg text-white shadow-xl transition-all duration-300 hover:bg-white hover:text-[#A3413A]">
                    <Link href={featuredEditionUrl}>
                      Open Digital Reader
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                <Button asChild size="lg" variant="outline" className="h-auto rounded-none border-white/15 bg-transparent px-8 py-6 text-lg text-white hover:bg-white hover:text-[#050505]">
                  <Link href="#edition-archive">
                    Browse Archive
                  </Link>
                </Button>
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-6 text-sm text-zinc-500">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  <span>{new Date(latestReaderEdition?.publishDate || liveIssue?.publishDate || Date.now()).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <p>Yorkshire BusinessWoman Magazine</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-10 top-10 h-[82%] rounded-[2rem] bg-accent/20 blur-[80px]" />
              <div className="relative grid gap-5 lg:grid-cols-[0.68fr_0.32fr]">
                <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[1.4rem] bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={latestCoverImage}
                      alt={`${latestReaderEdition?.title || liveIssue?.title || 'Yorkshire BusinessWoman'} Cover`}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/55 via-transparent to-white/10" />
                    <div className="absolute left-4 top-4">
                      <Badge className="border-none bg-white text-[#050505] px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                        Current Edition
                      </Badge>
                    </div>
                  </div>
                </div>

                  <div className="flex flex-col justify-between gap-4">
                    <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Primary Experience</p>
                      <h2 className="mt-3 font-serif text-xl font-medium text-white">Digital Reader</h2>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        Open the latest edition in our premium digital reader, designed for elegant on-screen reading rather than a print replica.
                      </p>
                    </div>
                    <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Alternate Format</p>
                      <h2 className="mt-3 font-serif text-xl font-medium text-white">Flipping Book</h2>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        The familiar page-turning version remains available below for readers who prefer a more print-led format.
                      </p>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="edition-formats" className="border-y border-border bg-[#f7f2eb] py-20 text-[#16110f]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <Badge className="border-none bg-[#A3413A] px-4 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white">
              Choose Your Format
            </Badge>
            <h2 className="mt-6 font-serif text-4xl font-medium sm:text-5xl">
              Read The Edition Your Way
            </h2>
              <p className="mt-4 text-lg leading-relaxed text-[#5a4a3f]">
                Start with the digital reader for the best screen experience, or open the flipping book if you prefer a familiar page-turning format.
              </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="group overflow-hidden rounded-[2rem] border border-[#d8c8b5] bg-white shadow-[0_24px_90px_rgba(0,0,0,0.08)]">
              <div className="flex h-full flex-col justify-between p-8 sm:p-10">
                <div>
                  <div className="flex items-center justify-between gap-4">
                      <Badge className="border-none bg-[#16110f] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                        Primary Format
                    </Badge>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-[#8b6f5a]">Live Now</span>
                  </div>
                  <h3 className="mt-6 font-serif text-3xl font-medium sm:text-4xl">
                      Digital Reader
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#5a4a3f] sm:text-lg">
                      Open the current Yorkshire BusinessWoman edition in the screen-native reading experience, with the latest edition always featured first.
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Button asChild size="lg" className="h-auto rounded-none border-none bg-[#A3413A] px-8 py-5 text-base text-white hover:bg-[#8c362f]">
                      <Link href={featuredEditionUrl}>
                      <BookOpen className="mr-2 h-5 w-5" />
                        Open Digital Reader
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="group overflow-hidden rounded-[2rem] border border-[#d8c8b5] bg-[#16110f] text-white shadow-[0_24px_90px_rgba(0,0,0,0.14)]">
              <div className="flex h-full flex-col justify-between p-8 sm:p-10">
                <div>
                  <Badge className="border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                      Alternate Format
                  </Badge>
                  <h3 className="mt-6 font-serif text-3xl font-medium">
                      Flipping Book
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-zinc-300">
                    {flipbookEmbedUrl
                        ? 'Open the same edition in the familiar page-turning format if you prefer a more print-led reading experience.'
                        : 'The digital reader remains the main experience for this edition.'}
                  </p>
                </div>

                <div className="mt-8">
                  <Button asChild size="lg" className="h-auto rounded-none border border-white/10 bg-white text-[#16110f] px-8 py-5 text-base hover:bg-accent hover:text-white">
                      <Link href={flipbookEmbedUrl ? '#classic-flipbook' : featuredEditionUrl}>
                      <Monitor className="mr-2 h-5 w-5" />
                        {flipbookEmbedUrl ? 'Open Flipping Book' : 'Open Digital Reader'}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {flipbookEmbedUrl && (
        <section id="classic-flipbook" className="border-b border-border bg-white py-24 dark:bg-zinc-950 scroll-mt-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="mb-10 text-center">
                <h2 className="font-serif text-3xl font-medium sm:text-4xl">Flipping Book</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Prefer a page-turning presentation? The same edition is also available here in its familiar flipping-book format.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_30px_110px_rgba(0,0,0,0.12)]">
              <div
                style={{ position: 'relative', paddingTop: 'max(60%, 326px)', height: 0, width: '100%' }}
              >
                <iframe
                  title={flipbookIssue?.title || 'Classic Flipping Book'}
                  allow="clipboard-write; autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen={true}
                  style={{ position: 'absolute', border: 'none', width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0 }}
                  src={flipbookEmbedUrl}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ghost Post Featured Story Section */}
      {featuredPost && (
        <section className="py-24 bg-white dark:bg-zinc-900">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col md:flex-row gap-16 items-center">
              <div className="flex-1">
                <Badge variant="outline" className="text-accent border-accent/30 mb-6 uppercase tracking-widest text-[10px]">
                  Featured Editorial
                </Badge>
                <h2 className="font-serif text-4xl sm:text-5xl font-medium mb-6">
                  {featuredPost.title}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                  {featuredPost.custom_excerpt || featuredPost.excerpt}
                </p>
                <Button size="lg" variant="link" className="text-accent p-0 h-auto text-lg group" asChild>
                  <Link href={`/news/${featuredPost.slug}`}>
                    Read full story
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
              <div className="flex-1 relative aspect-video w-full overflow-hidden">
                {featuredPost.feature_image && (
                  <Image 
                    src={featuredPost.feature_image} 
                    alt={featuredPost.title} 
                    fill 
                    className="object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="border-t border-border bg-card py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
            Want a Physical Copy?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join us as a Premium Member and pick up your complimentary print edition at our exclusive networking events.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link 
              href="/membership" 
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-medium text-white transition-all hover:bg-accent/90"
            >
              Become a Member
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link 
              href="/news?tag=events" 
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-8 py-3 text-sm font-medium text-foreground transition-all hover:border-accent/30 hover:bg-accent/5"
            >
              View Upcoming Events
            </Link>
          </div>
        </div>
      </section>

      {/* Edition Archive Section */}
      <section id="edition-archive" className="py-20 bg-zinc-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-serif text-3xl font-medium text-foreground sm:text-4xl">
              Edition Archive
            </h2>
              <p className="mt-4 text-muted-foreground">
                Browse past editions in the familiar page-turning format.
              </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {archiveIssues.map((issue: any) => (
              <div key={issue.id} className="group relative flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 items-center text-center">
                <div className="relative w-full max-w-[280px] aspect-[3/4] overflow-hidden block mt-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fixMagazineImageUrl(issue.coverImage, IMAGE_VERSION)}
                    alt={issue.title}
                    className="absolute inset-0 w-full h-full object-contain bg-black/5 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                    <div className="rounded-full bg-white/10 backdrop-blur-md p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/20">
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  {issue.isLatest && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-accent text-white border-none shadow-lg text-[10px] px-2 py-0">LATEST</Badge>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-6 items-center">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    <Calendar className="h-3 w-3" />
                    {new Date(issue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </div>
                  <h3 className="mb-2 font-serif text-lg font-medium text-foreground transition-colors group-hover:text-accent line-clamp-1">
                    {issue.title}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {issue.description}
                  </p>
                  
                  <div className="mt-auto flex flex-col gap-2 w-full">
                    <div className="grid grid-cols-2 gap-2">
                      {issue.pdfUrl ? (
                        <Button variant="secondary" size="sm" className="rounded-full text-[10px] h-8" asChild>
                          <Link href={issue.pdfUrl} target="_blank" rel="noreferrer">PDF</Link>
                        </Button>
                      ) : issue.flipbookUrl ? (
                        <Button variant="secondary" size="sm" className="rounded-full text-[10px] h-8" asChild>
                          <Link href={issue.flipbookUrl} target="_blank" rel="noreferrer">Issuu</Link>
                        </Button>
                      ) : (
                        <div className="col-span-2 rounded-full border border-dashed border-border px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Legacy Archive
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground italic">
              Our full digital library is available for members in the dashboard.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
