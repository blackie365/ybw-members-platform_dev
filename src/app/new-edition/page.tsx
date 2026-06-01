import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Calendar, Star } from 'lucide-react';

const archiveIssues = [
  {
    id: "issue-apr-may-2026",
    title: "April / May 2026",
    coverImage: "https://yorkshirebusinesswoman.co.uk/images/magazine/covers/apr-may-2026.jpg",
    publishDate: "2026-04-01",
    description: "Featuring our Spring leadership summit highlights and exclusive interviews with Yorkshire's top female entrepreneurs.",
    pdfUrl: "https://e.issuu.com/embed.html?d=ybw_april-may_2026&u=blackie365",
    tags: ["Leadership", "Innovation", "Spring Edition"]
  },
  {
    id: "issue-feb-mar-2026",
    title: "February / March 2026",
    coverImage: "https://yorkshirebusinesswoman.co.uk/images/magazine/covers/feb-mar-2026.jpg",
    publishDate: "2026-02-01",
    description: "The Wellness Issue: Balancing ambition with self-care, and the future of work-life integration.",
    pdfUrl: "https://e.issuu.com/embed.html?d=ybw_feb-mar_2026&u=blackie365",
    tags: ["Wellness", "Future of Work"]
  }
];

export const metadata: Metadata = {
  title: 'Latest Edition | Yorkshire Businesswoman',
  description: 'Read the latest edition of the Yorkshire Businesswoman magazine online.',
};

export default function NewEditionPage() {
  return (
    <main className="flex-1 bg-background">
      {/* Hero Section */}
      <section className="relative bg-primary py-20 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)]" />
        
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
            April / May 2026
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
              <span>April - May 2026</span>
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

          {/* Issuu Embed Container */}
          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-shadow duration-300 hover:shadow-xl">
            {/* Decorative corners */}
            <div className="absolute left-0 top-0 h-16 w-16 border-l-2 border-t-2 border-accent/30 rounded-tl-2xl pointer-events-none" />
            <div className="absolute right-0 top-0 h-16 w-16 border-r-2 border-t-2 border-accent/30 rounded-tr-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 h-16 w-16 border-b-2 border-l-2 border-accent/30 rounded-bl-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 h-16 w-16 border-b-2 border-r-2 border-accent/30 rounded-br-2xl pointer-events-none" />
            
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

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {archiveIssues.map((issue) => (
              <div key={issue.id} className="group flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                {/* Cover Image */}
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src={issue.coverImage}
                    alt={issue.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-6 text-center">
                    <Link 
                      href={issue.pdfUrl}
                      target="_blank"
                      className="rounded-full bg-white px-6 py-2 text-sm font-medium text-black transition-transform duration-300 hover:bg-accent hover:text-white"
                    >
                      Read Edition
                    </Link>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Calendar className="h-3 w-3 text-accent" />
                    <span>{new Date(issue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <h3 className="font-serif text-xl font-medium mb-3 group-hover:text-accent transition-colors">
                    {issue.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                    {issue.description}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {issue.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-16 text-center">
            <Link 
              href="https://app.yorkshirebusinesswoman.co.uk/magazine" 
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              Browse Full Digital Library in the App
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
