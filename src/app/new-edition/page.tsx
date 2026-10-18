import { cache } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPosts } from '@/lib/ghost';
import { fixMagazineImageUrl, fixIssuuEmbedUrl } from '@/lib/magazine-utils';
import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import { editionRecordsMatch } from '@/features/magazine/domain/edition-match';
import { deriveIssueSlug } from '@/features/magazine/domain/builder-to-reader';

export const revalidate = 600;

/**
 * Resolving the live issue is needed twice per request: once by `generateMetadata()`
 * for the <head>, once by the page body. React `cache()` collapses that to a single
 * store read, so naming the current edition in the <head> costs nothing extra on an
 * ISR cycle.
 */
const loadEditionContext = cache(async () => {
  const issues = await getMagazineReadStore().getMagazineIssues();
  const flagged = issues.find((issue) => issue.isLatest) ?? null;

  if (!flagged && issues.length > 0) {
    console.warn(
      '[NewEditionPage] No issue is flagged isLatest=true; falling back to issues[0]. ' +
        'Exactly one row is expected to carry this flag.',
    );
  }

  return { issues, liveIssue: flagged ?? issues[0] ?? null };
});

export async function generateMetadata(): Promise<Metadata> {
  const { liveIssue } = await loadEditionContext();

  if (!liveIssue) {
    return {
      title: 'Latest Edition',
      description: 'Read the latest edition of the Yorkshire BusinessWoman magazine online.',
      alternates: { canonical: '/new-edition' },
      openGraph: {
        title: 'Latest Edition | Yorkshire BusinessWoman',
        description: 'Read the latest edition of the Yorkshire BusinessWoman magazine online.',
        type: 'website',
      },
    };
  }

  const editionTitle = humanizeEditionTitle(liveIssue);
  const description =
    String(liveIssue.description || '').trim() ||
    'Read the latest Yorkshire BusinessWoman edition online in a polished magazine presentation.';
  // Left relative on purpose: the root layout's `metadataBase` turns it into the
  // absolute URL that social crawlers require.
  const coverImage = liveIssue.coverImage
    ? fixMagazineImageUrl(liveIssue.coverImage, liveIssue.publishDate || '')
    : '';

  return {
    // `absolute` because the root layout template appends " | Yorkshire BusinessWoman"
    // and the humanised edition title already carries the brand.
    title: { absolute: editionTitle },
    description,
    alternates: { canonical: '/new-edition' },
    openGraph: {
      title: `${editionTitle} | Yorkshire BusinessWoman`,
      description,
      url: '/new-edition',
      type: 'website',
      images: coverImage ? [{ url: coverImage, alt: `${editionTitle} cover` }] : undefined,
    },
    // A page-level `twitter` object replaces the layout's wholesale rather than
    // merging into it, so `card` has to be repeated here or the share silently
    // downgrades to the small "summary" card.
    twitter: {
      card: 'summary_large_image',
      title: `${editionTitle} | Yorkshire BusinessWoman`,
      description,
    },
  };
}

function isCopySlug(value: unknown): boolean {
  return /copy/i.test(String(value || ''));
}

function getTimestamp(value: unknown): number {
  const parsed = new Date(String(value || ''));
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Edition dates are pinned to the publication's own timezone: the server runs UTC, so
 * an unpinned `toLocaleDateString` can push a first-of-month edition into the previous
 * month. Returns '' for a missing date so callers can hide the row instead of
 * rendering "Invalid Date".
 */
function formatEditionDate(value: unknown): string {
  const parsed = new Date(String(value || ''));
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
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

function humanizeEditionTitle(issue: any): string {
  const raw = String(issue?.title || '').trim();
  // Titles from the ingest pipeline are often slugs (e.g. "ybw_October_2026").
  if (raw && !raw.includes('_') && !raw.includes('-')) return raw;
  const date = new Date(String(issue?.publishDate || ''));
  if (!Number.isNaN(date.getTime())) {
    const monthYear = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return `Yorkshire BusinessWoman ${monthYear} Edition`;
  }
  return 'Yorkshire BusinessWoman';
}

export default async function NewEditionPage() {
  const store = getMagazineReadStore();
  const [{ issues, liveIssue }, ghostPosts, readerEditions] = await Promise.all([
    loadEditionContext(),
    getPosts({ limit: 1, filter: "featured:true" }),
    store.listReaderEditions()
  ]);

  const exactLiveReaderEdition = liveIssue
    ? readerEditions.find((edition) => {
        const editionIssueId = (edition as any)?.issueId;
        return editionIssueId && liveIssue.id && String(editionIssueId) === String(liveIssue.id);
      }) ?? null
    : null;
  const matchedEditions = liveIssue
    ? readerEditions.filter((edition) => {
        const editionIssueId = (edition as any)?.issueId;
        if (editionIssueId && liveIssue.id && String(editionIssueId) === String(liveIssue.id)) {
          return true;
        }
        return editionRecordsMatch(liveIssue, edition);
      })
    : [];
  const preferredMatchedEdition = exactLiveReaderEdition
    ?? (matchedEditions.length > 0
      ? [...matchedEditions].sort(compareReaderEditions)[0]
      : null);
  const latestReaderEdition =
    preferredMatchedEdition ??
    readerEditions[0] ??
    null;
  const matchedLatestLegacyIssue = latestReaderEdition
    ? issues.find((issue) => (
        ((liveIssue?.id && latestReaderEdition.issueId && String(latestReaderEdition.issueId) === String(liveIssue.id)) ||
          editionRecordsMatch(issue, latestReaderEdition)) &&
        (issue.flipbookUrl || issue.pdfUrl)
      )) ?? null
    : null;
  const flipbookIssue = (liveIssue && (liveIssue.flipbookUrl || liveIssue.pdfUrl))
    ? liveIssue
    : (latestReaderEdition
      ? (matchedLatestLegacyIssue && (matchedLatestLegacyIssue.flipbookUrl || matchedLatestLegacyIssue.pdfUrl)
        ? matchedLatestLegacyIssue
        : null)
      : issues.find((issue) => issue.featureInFlipbook && (issue.flipbookUrl || issue.pdfUrl))
        ?? issues.find((issue) => issue.isLatest && (issue.flipbookUrl || issue.pdfUrl))
        ?? issues.find((issue) => issue.flipbookUrl || issue.pdfUrl)
        ?? liveIssue);
  const rawFlipbookUrl = flipbookIssue?.flipbookUrl || flipbookIssue?.pdfUrl || null;
  const flipbookEmbedUrl = rawFlipbookUrl ? fixIssuuEmbedUrl(rawFlipbookUrl) : null;
  // The archive is for *past* editions: newest first, and never a second copy of the
  // edition already sitting in the hero above.
  const archiveIssues = issues
    .filter((issue) => Boolean(issue.flipbookUrl || issue.pdfUrl))
    .filter((issue) => !liveIssue || String(issue.id) !== String(liveIssue.id))
    .sort((left, right) => getTimestamp(right.publishDate) - getTimestamp(left.publishDate));
  const featuredPost = ghostPosts[0];

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

  // The top hero always reflects the *live* issue (not the reader editions,
  // which can lag behind the current edition).
  const editionTitle = humanizeEditionTitle(liveIssue);
  const editionDateLabel = formatEditionDate(liveIssue.publishDate);
  const editionDescription =
    String(liveIssue.description || '').trim() ||
    'Read the latest Yorkshire BusinessWoman edition online in a polished magazine presentation.';
  // Cache-buster is derived from the edition itself, so the URL only changes when
  // the edition does. A per-render `Date.now()` gave every render a unique URL,
  // defeating the Next image cache, the 1-year minimumCacheTTL and any CDN cache.
  const liveCoverImage = liveIssue.coverImage
    ? fixMagazineImageUrl(liveIssue.coverImage, liveIssue.publishDate || '')
    : '';
  const featuredEditionUrl = (() => {
    const slug = deriveIssueSlug({
      id: String(liveIssue.id || ''),
      title: String(liveIssue.title || ''),
      ghostSyncTag: String((liveIssue as any).ghostSyncTag || ''),
      readerEditionSlug: String((liveIssue as any).readerEditionSlug || ''),
      slug: String((liveIssue as any).slug || ''),
    }).trim().toLowerCase();
    if (slug && slug !== `issue-${String(liveIssue.id || '').toLowerCase()}`) {
      return `/magazine/read/${slug}`;
    }
    return `/magazine/issue/${liveIssue.id}`;
  })();

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
                {editionTitle}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
                {editionDescription}
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
                {editionDateLabel && (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-accent" />
                      <span>{editionDateLabel}</span>
                    </div>
                    <div className="h-4 w-px bg-white/10" />
                  </>
                )}
                <p>Yorkshire BusinessWoman Magazine</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-10 top-10 h-[82%] rounded-[2rem] bg-accent/20 blur-[80px]" />
              <div className="relative grid gap-5 lg:grid-cols-[0.68fr_0.32fr]">
                <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[1.4rem] bg-black/30">
                    {liveCoverImage && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={liveCoverImage}
                        alt={`${editionTitle} Cover`}
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    )}
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

      {flipbookEmbedUrl && (
        <section id="classic-flipbook" className="border-b border-zinc-200 bg-white py-24 text-zinc-900 scroll-mt-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="mb-10 text-center">
              <h2 className="font-serif text-3xl font-medium sm:text-4xl">The Complete Edition, At Your Fingertips</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
                Explore every feature, interview and insight from the latest edition below — presented in a familiar page-turning format you can enjoy on any device.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_30px_110px_rgba(0,0,0,0.12)]">
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
            {archiveIssues.map((issue: any) => {
              const dateLabel = formatEditionDate(issue.publishDate);
              return (
              <div key={issue.id} className="group relative flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 items-center text-center">
                <div className="relative w-full max-w-[280px] aspect-[3/4] overflow-hidden block mt-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fixMagazineImageUrl(issue.coverImage, issue.publishDate || '')}
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
                  {dateLabel && (
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      <Calendar className="h-3 w-3" />
                      {dateLabel}
                    </div>
                  )}
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
              );
            })}
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
