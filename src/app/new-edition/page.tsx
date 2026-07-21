import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Calendar, Monitor, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPosts } from '@/lib/ghost';
import { fixMagazineImageUrl, fixIssuuEmbedUrl } from '@/lib/magazine-utils';
import { checkAdmin } from '@/lib/server/auth-utils';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';

export const revalidate = 0; // Disable cache for debugging

export const metadata: Metadata = {
  title: 'Latest Edition | Yorkshire Businesswoman',
  description: 'Read the latest edition of the Yorkshire Businesswoman magazine online.',
};

export default async function NewEditionPage() {
  const [issues, ghostPosts] = await Promise.all([
    getMagazineIssuesServer(),
    getPosts({ limit: 1, filter: "featured:true" })
  ]);

  const liveIssue = issues.find((issue) => issue.isLatest) ?? issues[0] ?? null;
  const flipbookIssue = issues.find((issue) => issue.flipbookUrl || issue.pdfUrl) ?? liveIssue;
  const rawFlipbookUrl = flipbookIssue?.flipbookUrl || flipbookIssue?.pdfUrl || null;
  const flipbookEmbedUrl = rawFlipbookUrl ? fixIssuuEmbedUrl(rawFlipbookUrl) : null;
  const digitalEditionUrl = liveIssue ? `/magazine/issue/${liveIssue.id}` : '/new-edition';
  const mergedIssues = issues;
  const featuredPost = ghostPosts[0];

  const isAdmin = await (async () => {
    try {
      await checkAdmin();
      return true;
    } catch {
      return false;
    }
  })();
  
  console.log('[NewEditionPage] issues count:', issues.length);
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
                {liveIssue.title}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
                Read the latest Yorkshire BusinessWoman edition online in a polished magazine presentation built around the live issue and its full page-turning format.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-auto rounded-none border-none bg-[#A3413A] px-8 py-6 text-lg text-white shadow-xl transition-all duration-300 hover:bg-white hover:text-[#A3413A]">
                  <Link href={digitalEditionUrl}>
                    Open The Latest Edition
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
                  <span>{new Date(liveIssue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
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
                      src={fixMagazineImageUrl(liveIssue.coverImage, IMAGE_VERSION)}
                      alt={`${liveIssue.title} Cover`}
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
                    <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Print-Inspired</p>
                    <h2 className="mt-3 font-serif text-xl font-medium text-white">Live Digital Edition</h2>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                      The current issue opens directly in our live digital reading path, centered on the edition readers need right now.
                    </p>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Magazine View</p>
                    <h2 className="mt-3 font-serif text-xl font-medium text-white">Page-Turning Format</h2>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                      Browse the same issue in an inline flipbook section below, ideal for readers who want a familiar print-led presentation.
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
              Both formats give access to the same latest edition, presented in two distinct ways for different reading preferences.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="group overflow-hidden rounded-[2rem] border border-[#d8c8b5] bg-white shadow-[0_24px_90px_rgba(0,0,0,0.08)]">
              <div className="flex h-full flex-col justify-between p-8 sm:p-10">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <Badge className="border-none bg-[#16110f] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                      Featured Format
                    </Badge>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-[#8b6f5a]">Live Now</span>
                  </div>
                  <h3 className="mt-6 font-serif text-3xl font-medium sm:text-4xl">
                    Digital Edition
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#5a4a3f] sm:text-lg">
                    Open the current Yorkshire BusinessWoman issue directly in its live digital reading route, with the latest edition always featured first.
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Button asChild size="lg" className="h-auto rounded-none border-none bg-[#A3413A] px-8 py-5 text-base text-white hover:bg-[#8c362f]">
                    <Link href={digitalEditionUrl}>
                      <BookOpen className="mr-2 h-5 w-5" />
                      Open Latest Edition
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="group overflow-hidden rounded-[2rem] border border-[#d8c8b5] bg-[#16110f] text-white shadow-[0_24px_90px_rgba(0,0,0,0.14)]">
              <div className="flex h-full flex-col justify-between p-8 sm:p-10">
                <div>
                  <Badge className="border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                    Print-Led Format
                  </Badge>
                  <h3 className="mt-6 font-serif text-3xl font-medium">
                    Magazine View
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-zinc-300">
                    {flipbookEmbedUrl
                      ? 'Open the live issue in the embedded page-turning presentation below for a format that feels closest to the printed magazine.'
                      : 'The current issue can still be opened directly in the main digital edition route above.'}
                  </p>
                </div>

                <div className="mt-8">
                  <Button asChild size="lg" className="h-auto rounded-none border border-white/10 bg-white text-[#16110f] px-8 py-5 text-base hover:bg-accent hover:text-white">
                    <Link href={flipbookEmbedUrl ? '#classic-flipbook' : digitalEditionUrl}>
                      <Monitor className="mr-2 h-5 w-5" />
                      {flipbookEmbedUrl ? 'Open Magazine View' : 'Open Digital Edition'}
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
              <h2 className="font-serif text-3xl font-medium sm:text-4xl">Magazine View</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Browse the edition in a polished, page-turning format designed to echo the feel of the printed publication.
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
              Access past editions and revisit your favourite articles and interviews.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {mergedIssues.map((issue: any) => (
              <div key={issue.id} className="group relative flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 items-center text-center">
                {/* Cover Image - Entire image is now a link */}
                <Link 
                  href={`/magazine/issue/${issue.id}`}
                  className="relative w-full max-w-[280px] aspect-[3/4] overflow-hidden block mt-6"
                >
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
                </Link>

                {/* Content below cover */}
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
                      <Button variant="outline" size="sm" className="rounded-full text-[10px] h-8" asChild>
                        <Link href={`/magazine/issue/${issue.id}`}>
                          {issue.isLatest ? 'Open Live Issue' : 'Open Edition'}
                        </Link>
                      </Button>
                      {issue.pdfUrl ? (
                        <Button variant="secondary" size="sm" className="rounded-full text-[10px] h-8" asChild>
                          <Link href={issue.pdfUrl}>PDF</Link>
                        </Button>
                      ) : issue.flipbookUrl ? (
                        <Button variant="secondary" size="sm" className="rounded-full text-[10px] h-8" asChild>
                          <Link href={issue.flipbookUrl} target="_blank" rel="noreferrer">Issuu</Link>
                        </Button>
                      ) : null}
                      {isAdmin && issue?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-[10px] h-8 col-span-2 text-destructive hover:text-destructive"
                          asChild
                        >
                          <Link href={`/admin/magazine?delete=${issue.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Link>
                        </Button>
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
