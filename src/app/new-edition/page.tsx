import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Calendar, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMagazineIssues } from '@/lib/magazine-service';

export const metadata: Metadata = {
  title: 'Latest Edition | Yorkshire Businesswoman',
  description: 'Read the latest edition of the Yorkshire Businesswoman magazine online.',
};

export default async function NewEditionPage() {
  const allIssues = await getMagazineIssues();
  const mergedIssues = allIssues.slice(0, 8);
  const latestIssue = mergedIssues[0];
  
  if (!latestIssue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No magazine issues found.</p>
      </div>
    );
  }

  const IMAGE_VERSION = Date.now();

  return (
    <main className="flex-1 bg-background">
      {/* Hero Section */}
      <section className="relative bg-primary py-20 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)]" />
        
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
            {new Date(latestIssue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
            Latest Edition
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            Explore the newest issue of Yorkshire Businesswoman magazine, featuring inspiring stories, 
            expert insights, and the latest from our thriving community.
          </p>
        </div>
      </section>

      {/* Magazine Embed Section */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Edition Info Bar */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" />
              <span>{new Date(latestIssue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" />
              <span>Digital Edition</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-accent" />
              <span>Free to Read</span>
            </div>
          </div>

          {/* Issuu Embed Container - Now with Premium Reader Link */}
          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-all duration-500 hover:shadow-2xl">
            {/* Decorative corners */}
            <div className="absolute left-0 top-0 h-16 w-16 border-l-2 border-t-2 border-accent/30 rounded-tl-2xl pointer-events-none" />
            <div className="absolute right-0 top-0 h-16 w-16 border-r-2 border-t-2 border-accent/30 rounded-tr-2xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row">
              {/* Cover Image */}
              <div className="lg:w-1/3 relative aspect-[3/4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={`${latestIssue.coverImage}?v=${IMAGE_VERSION}`}
                  alt={`${latestIssue.title} Cover`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <Badge className="mb-2 bg-accent text-white border-none">Latest Issue</Badge>
                  <h3 className="text-xl font-serif text-white">{latestIssue.title}</h3>
                </div>
              </div>

              {/* Reader Options */}
              <div className="lg:w-2/3 p-8 lg:p-12 flex flex-col justify-center bg-zinc-50 dark:bg-zinc-900/50">
                <div className="max-w-md">
                  <h2 className="text-3xl font-serif font-medium mb-4">Choose Your Experience</h2>
                  <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                    Access our latest edition through our high-end digital reader for the most immersive experience, or view the standard PDF version below.
                  </p>
                  
                  <div className="space-y-4">
                    <Button size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-16 text-lg group" asChild>
                      <Link href={`/magazine/issue/${latestIssue.id}`}>
                        <BookOpen className="mr-2 h-5 w-5" />
                        Launch Digital Edition
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Full Digital Archive | Issuu Interactive Reader
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Standard Embed Section */}
          <div className="mt-20">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1 bg-border" />
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Standard PDF Edition</h3>
              <div className="h-px flex-1 bg-border" />
            </div>
            
            <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg opacity-70 hover:opacity-100 transition-opacity">
              <div 
                style={{ position: 'relative', paddingTop: 'max(60%, 326px)', height: 0, width: '100%' }}
              >
                <iframe 
                  title="Yorkshire Businesswoman April-May 2026" 
                  allow="clipboard-write; autoplay; encrypted-media; fullscreen; picture-in-picture" 
                  sandbox="allow-top-navigation allow-top-navigation-by-user-activation allow-downloads allow-scripts allow-same-origin allow-popups allow-modals allow-popups-to-escape-sandbox allow-forms" 
                  allowFullScreen={true} 
                  style={{ position: 'absolute', border: 'none', width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0 }} 
                  src="https://e.issuu.com/embed.html?d=ybw_april-may_2026&u=blackie365"
                />
              </div>
            </div>
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
