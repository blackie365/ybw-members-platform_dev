import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Calendar, Star, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';
import { getPosts } from '@/lib/ghost';

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
      {/* Ghost Post Hero Section (The "Ghost Post" part) */}
      {featuredPost && (
        <section className="relative bg-primary pt-32 pb-20">
          <div className="absolute inset-0 bg-black/40 z-10" />
          {featuredPost.feature_image && (
            <Image 
              src={featuredPost.feature_image} 
              alt={featuredPost.title} 
              fill 
              className="object-cover"
              priority
            />
          )}
          <div className="relative z-20 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <Badge variant="outline" className="text-white border-white/20 mb-6 px-4 py-1.5 uppercase tracking-widest text-[10px] bg-white/5">
              Featured Story
            </Badge>
            <h1 className="font-serif text-4xl sm:text-6xl font-medium tracking-tight text-white mb-6">
              {featuredPost.title}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-white/80 leading-relaxed font-light mb-10">
              {featuredPost.custom_excerpt || featuredPost.excerpt}
            </p>
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-8" asChild>
              <Link href={`/news/${featuredPost.slug}`}>
                Read Featured Story
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* Issuu Flipping Book Section (The "Issuu Flipping Book" part) */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-5xl font-medium text-foreground mb-4">
              {latestIssue.title}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Enjoy the classic flipping book experience of our latest digital edition.
            </p>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-500">
            <div 
              style={{ position: 'relative', paddingTop: 'max(60%, 326px)', height: 0, width: '100%' }}
            >
              <iframe 
                title={latestIssue.title}
                allow="clipboard-write; autoplay; encrypted-media; fullscreen; picture-in-picture" 
                sandbox="allow-top-navigation allow-top-navigation-by-user-activation allow-downloads allow-scripts allow-same-origin allow-popups allow-modals allow-popups-to-escape-sandbox allow-forms" 
                allowFullScreen={true} 
                style={{ position: 'absolute', border: 'none', width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0 }} 
                src={latestIssue.pdfUrl || "https://e.issuu.com/embed.html?d=ybw_april-may_2026&u=blackie365"}
              />
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button size="lg" className="w-full sm:w-auto bg-accent text-white hover:bg-accent/90 h-16 px-10 text-lg font-medium group rounded-full shadow-lg" asChild>
              <Link href={`/magazine/issue/${latestIssue.id}`}>
                <Sparkles className="mr-2 h-5 w-5" />
                Try Premium Reader
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            
            {latestIssue.downloadUrl && (
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-16 px-10 text-lg font-medium rounded-full" asChild>
                <a href={latestIssue.downloadUrl} download>
                  <Download className="mr-2 h-5 w-5" />
                  Download PDF
                </a>
              </Button>
            )}
          </div>

          {/* Reading Tips */}
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">Click to turn pages</span>
            <span className="rounded-full bg-muted px-3 py-1">Double-click to zoom</span>
            <span className="rounded-full bg-muted px-3 py-1">Fullscreen available</span>
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
              href="/events" 
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
                  href={issue.id === 'issue-apr-may-2026' ? `/magazine/issue/${issue.id}` : issue.pdfUrl}
                  className="relative w-full max-w-[280px] aspect-[3/4] overflow-hidden block mt-6"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${issue.coverImage}?v=${IMAGE_VERSION}`}
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
                      {issue.tags.slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] font-normal uppercase tracking-wider px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="rounded-full text-[10px] h-8" asChild>
                        <Link href={issue.id === 'issue-apr-may-2026' ? `/magazine/issue/${issue.id}` : issue.pdfUrl}>
                          {issue.id === 'issue-apr-may-2026' ? 'Reader' : 'View'}
                        </Link>
                      </Button>
                      {issue.downloadUrl && (
                        <Button variant="secondary" size="sm" className="rounded-full text-[10px] h-8" asChild>
                          <Link href={issue.downloadUrl}>PDF</Link>
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
