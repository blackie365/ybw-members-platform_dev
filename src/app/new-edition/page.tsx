import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen } from 'lucide-react';
import { getMagazineIssuesServer } from '@/lib/magazine-service-server';
import { getPosts } from '@/lib/ghost';
import { fixMagazineImageUrl, fixIssuuEmbedUrl } from '@/lib/magazine-utils';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'The Edition | Yorkshire Businesswoman',
  description: 'Read the latest edition of the Yorkshire Businesswoman magazine online.',
};

export default async function NewEditionPage() {
  const [allIssues, ghostPosts] = await Promise.all([
    getMagazineIssuesServer(),
    getPosts({ limit: 1, filter: "featured:true" })
  ]);

  const mergedIssues = allIssues.slice(0, 8);
  const latestIssue = mergedIssues[0];
  const featuredPost = ghostPosts[0];

  if (!latestIssue) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#F5F2EE]">
        <h2 className="font-serif text-2xl mb-4 text-[#1a1410]">The Edition</h2>
        <p className="text-[#7a6e65]">No magazine issues found in our database.</p>
        <div className="mt-8">
          <Link href="/" className="text-[#8b1f3f] hover:underline underline-offset-4">Return Home</Link>
        </div>
      </div>
    );
  }

  const IMAGE_VERSION = Date.now();

  return (
    <main className="flex-1 bg-[#F5F2EE]">

      {/* ── HERO: Full-bleed cover with editorial overlay ── */}
      <section className="relative min-h-screen flex items-end overflow-hidden bg-[#0c0a09]">
        {/* Cover image — full bleed */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fixMagazineImageUrl(latestIssue.coverImage, IMAGE_VERSION)}
            alt={latestIssue.title}
            className="w-full h-full object-cover object-center"
          />
          {/* Cinematic gradient — bottom-heavy */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a09] via-[#0c0a09]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0a09]/70 via-transparent to-transparent" />
        </div>

        {/* Masthead — top left */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-8 sm:px-14 pt-10 z-20">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/40 mb-1">Yorkshire BusinessWoman</p>
            <div className="h-px w-16 bg-white/20" />
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/30 hidden sm:block">
            Digital Edition
          </p>
        </div>

        {/* Hero copy — bottom left */}
        <div className="relative z-10 w-full px-8 sm:px-14 pb-16 sm:pb-24">
          <div className="max-w-3xl">
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#c9956a] mb-6">
              {new Date(latestIssue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              {latestIssue.issueNumber ? ` · Issue ${latestIssue.issueNumber}` : ''}
            </p>

            <h1 className="font-serif text-[clamp(2.8rem,7vw,6rem)] font-normal leading-[0.92] tracking-[-0.02em] text-white mb-8">
              {latestIssue.title || (
                <>
                  The <em className="italic">Digital</em>
                  <br />Edition
                </>
              )}
            </h1>

            {latestIssue.description && (
              <p className="text-white/55 text-base sm:text-lg font-light leading-relaxed max-w-xl mb-10">
                {latestIssue.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={`/magazine/issue/${latestIssue.id}`}
                className="group inline-flex items-center gap-3 bg-white text-[#0c0a09] px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] hover:bg-[#c9956a] hover:text-white transition-all duration-300"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Read Now
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="#archive"
                className="inline-flex items-center gap-2 text-white/50 text-xs font-medium uppercase tracking-[0.18em] hover:text-white transition-colors border-b border-white/20 hover:border-white/60 pb-0.5"
              >
                Browse Archive
              </Link>
            </div>
          </div>
        </div>

        {/* Issue counter — bottom right */}
        <div className="absolute bottom-10 right-8 sm:right-14 z-10 text-right hidden sm:block">
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25 mb-1">Latest Issue</p>
          <p className="font-serif text-5xl font-normal text-white/10 leading-none">
            {String(mergedIssues.length).padStart(2, '0')}
          </p>
        </div>
      </section>

      {/* ── FEATURED EDITORIAL STORY ── */}
      {featuredPost && (
        <section className="bg-[#F5F2EE] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-8 sm:px-14">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16 lg:gap-24 items-center">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#8b1f3f] mb-8">
                  Featured Editorial
                </p>
                <h2 className="font-serif text-[clamp(2rem,4vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.01em] text-[#1a1410] mb-8">
                  {featuredPost.title}
                </h2>
                <div className="w-12 h-px bg-[#8b1f3f] mb-8" />
                <p className="text-[#5a4e47] text-base leading-relaxed mb-10 max-w-lg">
                  {featuredPost.custom_excerpt || featuredPost.excerpt}
                </p>
                <Link
                  href={`/news/${featuredPost.slug}`}
                  className="group inline-flex items-center gap-3 text-[#1a1410] text-xs font-bold uppercase tracking-[0.2em] border-b border-[#1a1410] pb-1 hover:text-[#8b1f3f] hover:border-[#8b1f3f] transition-colors"
                >
                  Read the Story
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden">
                {featuredPost.feature_image && (
                  <Image
                    src={featuredPost.feature_image}
                    alt={featuredPost.title}
                    fill
                    className="object-cover"
                  />
                )}
                {/* Subtle corner accent */}
                <div className="absolute bottom-0 left-0 w-16 h-16 border-l-2 border-b-2 border-[#c9956a]/60 pointer-events-none" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── ISSUU READER ── */}
      <section className="bg-[#1a1410] py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-8 sm:px-14">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#c9956a] mb-4">Classic Reader</p>
              <h2 className="font-serif text-3xl sm:text-4xl font-normal text-white leading-tight">
                Flipping Book Edition
              </h2>
            </div>
            <div className="h-px flex-1 bg-white/[0.06] hidden sm:block mx-8" />
            <Link
              href={`/magazine/issue/${latestIssue.id}`}
              className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 hover:text-[#c9956a] transition-colors whitespace-nowrap border-b border-white/10 hover:border-[#c9956a]/40 pb-0.5"
            >
              Open Interactive Reader →
            </Link>
          </div>

          <div className="relative overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.06]">
            <div style={{ position: 'relative', paddingTop: 'max(60%, 326px)', height: 0, width: '100%' }}>
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

      {/* ── ARCHIVE ── */}
      <section id="archive" className="bg-[#F5F2EE] py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-8 sm:px-14">

          {/* Section header */}
          <div className="flex items-end justify-between mb-16">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#8b1f3f] mb-4">Archive</p>
              <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#1a1410] leading-tight">
                Past Editions
              </h2>
            </div>
            <div className="h-px flex-1 bg-[#1a1410]/10 mx-10 hidden sm:block" />
          </div>

          {/* Issues grid — editorial layout */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
            {mergedIssues.map((issue: any, idx: number) => (
              <Link
                key={issue.id}
                href={`/magazine/issue/${issue.id}`}
                className="group flex flex-col"
              >
                {/* Cover */}
                <div className="relative aspect-[3/4] overflow-hidden mb-4 bg-[#e8e2d9]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fixMagazineImageUrl(issue.coverImage, IMAGE_VERSION)}
                    alt={issue.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-[#0c0a09]/0 group-hover:bg-[#0c0a09]/30 transition-all duration-500 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2">
                      <span className="text-white text-[9px] font-bold uppercase tracking-[0.25em]">Read Now</span>
                    </div>
                  </div>
                  {/* Latest badge */}
                  {issue.isLatest && (
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#8b1f3f] text-white text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-1">
                        Latest
                      </span>
                    </div>
                  )}
                  {/* Issue number */}
                  <div className="absolute bottom-3 right-3">
                    <span className="font-serif text-white/30 text-2xl font-normal leading-none">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Meta */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#8b1f3f] mb-1.5">
                    {new Date(issue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                  <h3 className="font-serif text-base font-normal text-[#1a1410] leading-snug group-hover:text-[#8b1f3f] transition-colors line-clamp-2">
                    {issue.title}
                  </h3>
                  <div className="mt-3 h-px w-6 bg-[#8b1f3f]/40 group-hover:w-10 transition-all duration-300" />
                </div>
              </Link>
            ))}
          </div>

          <p className="mt-16 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-[#1a1410]/30">
            Full digital library available to members in the dashboard
          </p>
        </div>
      </section>

      {/* ── MEMBERSHIP CTA ── */}
      <section className="bg-[#1a1410] py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-8 sm:px-14 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#c9956a] mb-8">Membership</p>
          <h2 className="font-serif text-[clamp(2rem,5vw,4rem)] font-normal text-white leading-[1.05] tracking-[-0.01em] mb-8">
            Receive the Print Edition
          </h2>
          <div className="w-12 h-px bg-[#c9956a] mx-auto mb-8" />
          <p className="text-white/50 text-base leading-relaxed max-w-xl mx-auto mb-12">
            Join as a Premium Member and collect your complimentary print edition at our exclusive networking events across Yorkshire.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/membership"
              className="group inline-flex items-center gap-3 bg-[#c9956a] text-[#0c0a09] px-10 py-4 text-xs font-bold uppercase tracking-[0.18em] hover:bg-white transition-all duration-300"
            >
              Become a Member
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-white/40 text-xs font-medium uppercase tracking-[0.18em] hover:text-white transition-colors border-b border-white/10 hover:border-white/40 pb-0.5"
            >
              View Upcoming Events
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
