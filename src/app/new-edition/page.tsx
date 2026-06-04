import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Calendar, Star, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';
import { getPosts } from '@/lib/ghost';
import { fixMagazineImageUrl, fixIssuuEmbedUrl } from '@/lib/magazine-utils';

export const revalidate = 0; // Disable cache for debugging

export const metadata: Metadata = {
  title: 'Latest Edition | Yorkshire Businesswoman',
  description: 'Read the latest edition of the Yorkshire Businesswoman magazine online.',
};

export default async function NewEditionPage() {
  // Use server-side fetcher for reliability in server component
  const [allIssues, ghostPosts] = await Promise.all([
    getMagazineIssuesServer(),
    getPosts({ limit: 1, filter: "featured:true" })
  ]);
  
  const mergedIssues = allIssues.slice(0, 8);
  const latestIssue = mergedIssues[0];
  const featuredPost = ghostPosts[0];
  
  console.log('[NewEditionPage] allIssues count:', allIssues.length);
  console.log('[NewEditionPage] featuredPost:', featuredPost?.title);
  
  if (!latestIssue) {
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
      {/* Premium Reader Hero Section - The "Best Part of the Site" */}
      <section className="relative bg-[#050505] text-white py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:32px_32px]" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col items-start text-left">
              <Badge className="bg-accent text-white border-none mb-6 px-4 py-1.5 uppercase tracking-widest text-[10px] animate-pulse">
                Interactive Experience
              </Badge>
              <h1 className="font-serif text-5xl sm:text-7xl font-medium tracking-tight mb-8 leading-tight">
                The <span className="italic text-accent">Premium</span> <br />Digital Reader
              </h1>
              <p className="text-xl text-zinc-400 leading-relaxed font-light mb-12 max-w-xl">
                Experience our cinematic, smooth-turning digital edition. Optimized for every screen with high-resolution spreads and interactive content.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="bg-[#A3413A] hover:bg-white hover:text-[#A3413A] text-white px-8 py-6 h-auto text-lg rounded-none transition-all duration-300 shadow-xl border-none">
                  <Link href={`/magazine/issue/${latestIssue.id}`}>
                    <BookOpen className="mr-2 h-5 w-5" />
                    Launch Digital Reader
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-zinc-700 text-white hover:bg-zinc-800 px-8 py-6 h-auto text-lg rounded-none">
                  <Link href="/events">
                    Pick Up Print Copy
                  </Link>
                </Button>
              </div>

              <div className="mt-12 flex items-center gap-4 text-sm text-zinc-500">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-zinc-800" />
                  ))}
                </div>
                <p>Join <span className="text-white font-medium">5,000+</span> digital visitors</p>
              </div>
            </div>

            <div className="relative group cursor-pointer">
              <Link href={`/magazine/issue/${latestIssue.id}`}>
                <div className="relative aspect-[3/4] max-w-[450px] mx-auto shadow-[0_0_100px_rgba(0,0,0,0.8)] transform transition-transform duration-700 group-hover:scale-105 group-hover:rotate-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`${fixMagazineImageUrl(latestIssue.coverImage)}?v=${IMAGE_VERSION}`}
                    alt={`${latestIssue.title} Cover`}
                    className="absolute inset-0 w-full h-full object-cover border border-white/10"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-white/10" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white/10 backdrop-blur-xl p-6 rounded-full border border-white/20">
                      <BookOpen className="h-10 w-10 text-white" />
                    </div>
                  </div>
                </div>
              </Link>
              {/* Decorative light flare */}
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/20 blur-[120px] rounded-full pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

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

      {/* Issuu Flipping Book Section */}
      <section className="py-24 bg-zinc-50 dark:bg-zinc-950 border-y border-border">
        <div className="mx-auto max-w-6xl px-6 lg:px-8 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-medium mb-12">
            Classic Flipping Book
          </h2>

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div 
              style={{ position: 'relative', paddingTop: 'max(60%, 326px)', height: 0, width: '100%' }}
            >
              <iframe 
                title={latestIssue.title}
                allow="clipboard-write; autoplay; encrypted-media; fullscreen; picture-in-picture" 
                allowFullScreen={true} 
                style={{ position: 'absolute', border: 'none', width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0 }} 
                src={fixIssuuEmbedUrl(latestIssue.pdfUrl)}
              />
            </div>
          </div>
        </div>
      </section>

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
      <section className="py-20 bg-zinc-50/50">
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
              <div key={issue.id} className="group flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 items-center text-center">
                {/* Cover Image - Entire image is now a link */}
                <Link 
                  href={`/magazine/issue/${issue.id}`}
                  className="relative w-full max-w-[280px] aspect-[3/4] overflow-hidden block mt-6"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${fixMagazineImageUrl(issue.coverImage)}?v=${IMAGE_VERSION}`}
                    alt={issue.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
                    <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
                      {issue.tags?.slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] font-normal uppercase tracking-wider px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="rounded-full text-[10px] h-8" asChild>
                        <Link href={`/magazine/issue/${issue.id}`}>
                          Reader
                        </Link>
                      </Button>
                      {issue.downloadUrl ? (
                        <Button variant="secondary" size="sm" className="rounded-full text-[10px] h-8" asChild>
                          <Link href={issue.downloadUrl}>PDF</Link>
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" className="rounded-full text-[10px] h-8" asChild>
                          <Link href={issue.pdfUrl || '#'}>Issuu</Link>
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
