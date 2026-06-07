'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X, Menu, Download, Share2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { MagazinePage, MagazineIssue } from '@/lib/magazine-service';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';

interface MagazineReaderProps {
  issue: MagazineIssue;
  pages: MagazinePage[];
  id: string;
}

export default function MagazineReader({ issue, pages }: MagazineReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [imageVersion, setImageVersion] = useState<string>('');
  const isCover = pages[currentPage]?.type === 'cover';

  useEffect(() => {
    setImageVersion(Date.now().toString());
  }, []);

  const nextPage = useCallback(() => {
    if (currentPage < pages.length - 1) {
      setDirection(1);
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, pages.length]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const goToPage = (index: number) => {
    setDirection(index > currentPage ? 1 : -1);
    setCurrentPage(index);
    setIsNavOpen(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'Escape') setIsNavOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage]);

  const variants: any = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.9,
      rotateY: direction > 0 ? 45 : -45,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        x: { type: "spring", stiffness: 200, damping: 30 },
        opacity: { duration: 0.4 },
        rotateY: { duration: 0.6, ease: "easeOut" }
      }
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1.1,
      rotateY: direction < 0 ? 45 : -45,
      transition: {
        x: { type: "spring", stiffness: 200, damping: 30 },
        opacity: { duration: 0.4 },
        rotateY: { duration: 0.6, ease: "easeIn" }
      }
    })
  };

  return (
    <div className="magazine-rocket-theme fixed inset-0 h-[100dvh] bg-[#050505] text-zinc-100 flex flex-col z-[100] overflow-hidden perspective-1000 overscroll-none selection:bg-accent/30">
      
      {/* Top Control Bar */}
      <header className="h-14 sm:h-16 border-b border-zinc-800 flex items-center justify-between px-4 sm:px-6 bg-zinc-900/50 backdrop-blur-md z-50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/new-edition" className="text-zinc-400 hover:text-white transition-colors">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Link>
          <div className="h-6 w-px bg-zinc-800 mx-1 sm:mx-2" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-6 sm:h-8 brightness-0 invert" />
            <span className="text-zinc-500 hidden sm:block">|</span>
            <p className="text-[10px] sm:text-sm font-medium tracking-wide uppercase text-accent truncate max-w-[100px] sm:max-w-none">
              {(pages[currentPage]?.content as any)?.date || issue?.title || "Edition"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 font-mono text-[9px] sm:text-xs px-1.5 py-0">
            {currentPage + 1} / {pages.length}
          </Badge>
          <div className="h-6 w-px bg-zinc-800 mx-1 sm:mx-2" />
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-8 w-8 sm:h-10 sm:w-10">
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-8 w-8 sm:h-10 sm:w-10">
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-zinc-400 hover:text-white lg:hidden h-8 w-8"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Reader Stage */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden touch-pan-y">
        
        {/* Navigation Arrows (Desktop) */}
        <button 
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-6 z-40 h-12 w-12 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 hover:scale-110 transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-2xl"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button 
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
          className="absolute right-6 z-40 h-12 w-12 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 hover:scale-110 transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-2xl"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Page Viewport */}
        <div
          className={[
            'relative w-full h-full mx-auto overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.4)] bg-white text-zinc-900 self-center',
            isCover
              ? 'max-w-none aspect-auto lg:h-[min(92vh,980px)]'
              : 'max-w-[min(94vw,1200px)] aspect-[3/4] lg:aspect-auto lg:h-[min(90vh,850px)] xl:h-[min(80vh,950px)]',
          ].join(' ')}
        >
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
                key={currentPage}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={(_, info) => {
                  const swipe = info.offset.x;
                  const swipeY = info.offset.y;
                  const velocity = info.velocity.x;
                  
                  // If vertical movement is significant compared to horizontal, ignore the swipe
                  // This prevents accidental page turns while the user is trying to scroll up/down
                  if (Math.abs(swipeY) > Math.abs(swipe) * 1.5) return;

                  if (swipe > 100 || velocity > 500) prevPage();
                  else if (swipe < -100 || velocity < -500) nextPage();
                }}
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="absolute inset-0 w-full h-full will-change-transform touch-pan-y overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-thin overscroll-contain touch-action-pan-y"
              >
                {renderPage(pages[currentPage], imageVersion)}
              </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Page Scrubber */}
      <footer className="h-16 sm:h-20 bg-zinc-900 border-t border-zinc-800 px-4 sm:px-6 flex items-center gap-4 sm:gap-6 z-50 shrink-0">
        <div className="flex-1 h-1 bg-zinc-800 rounded-full relative group cursor-pointer">
          <div 
            className="absolute h-full bg-accent rounded-full transition-all duration-300" 
            style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
          />
          <div className="flex justify-between absolute -top-8 w-full">
            {pages.map((_, i) => (
              <button 
                key={i} 
                onClick={() => goToPage(i)}
                className={`text-[9px] sm:text-[10px] font-mono transition-colors ${currentPage === i ? 'text-accent' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={prevPage} disabled={currentPage === 0} variant="outline" size="sm" className="bg-transparent border-zinc-700 text-zinc-400 h-8 text-[10px] sm:text-xs">
            PREV
          </Button>
          <Button onClick={nextPage} disabled={currentPage === pages.length - 1} variant="outline" size="sm" className="bg-transparent border-zinc-700 text-zinc-400 h-8 text-[10px] sm:text-xs">
            NEXT
          </Button>
        </div>
      </footer>

      {/* Sidebar Navigation */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-zinc-900 z-[60] border-l border-zinc-800 shadow-2xl p-8"
          >
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-xl font-serif">Quick Access</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsNavOpen(false)}>
                <X className="h-6 w-6" />
              </Button>
            </div>
            <nav className="space-y-6">
              {pages.map((page, i) => (
                <button
                  key={page.id}
                  onClick={() => goToPage(i)}
                  className={`w-full text-left flex items-center gap-4 group ${currentPage === i ? 'text-accent' : 'text-zinc-400'}`}
                >
                  <span className="text-xs font-mono opacity-40 group-hover:opacity-100 transition-opacity">0{page.id}</span>
                  <span className="font-medium text-sm uppercase tracking-widest">{page.type.replace('-', ' ')}</span>
                  {currentPage === i && <motion.div layoutId="activeDot" className="h-1.5 w-1.5 rounded-full bg-accent ml-auto" />}
                </button>
              ))}
            </nav>
            <div className="mt-20 p-6 bg-zinc-800/50 rounded-xl">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-bold">Latest Edition</p>
              <h4 className="text-lg font-serif mb-4">{issue?.title || "Current Issue"}</h4>
              <Button className="w-full bg-accent hover:bg-accent/90" asChild>
                <Link href="/membership">Become a Member</Link>
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- PAGE RENDERER HELPERS ---

function SafeText({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  
  let content = html;
  if (!html.includes('<')) {
    const normalized = html.replace(/\r\n/g, '\n');
    const lines = normalized
      .split(/\n+/g)
      .map((l) => l.trim())
      .filter(Boolean);
    content = lines.map((l) => `<p>${l}</p>`).join('');
  } else if (!html.includes('<p') && !html.includes('<br')) {
    const normalized = html.replace(/\r\n/g, '\n');
    const lines = normalized
      .split(/\n+/g)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      content = lines.map((l) => `<p>${l}</p>`).join('');
    } else {
      content = html.replace(/\n/g, '<br />');
    }
  }
  
  return (
    <div 
      className={[
        '[&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_a]:underline [&_a]:underline-offset-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      dangerouslySetInnerHTML={{ __html: content }} 
    />
  );
}

function getHtmlBlocks(html: string): string[] {
  if (!html) return [];

  const hasTags = html.includes('<');
  const normalizedRaw = html.replace(/\r\n/g, '\n');

  if (hasTags && !html.includes('<p') && normalizedRaw.includes('\n')) {
    const lines = normalizedRaw
      .split(/\n+/g)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length > 1) return lines.map((l) => `<p>${l}</p>`);
  }

  if (typeof window !== 'undefined' && hasTags && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const body = doc.body;

      const paragraphs = Array.from(body.querySelectorAll('p'));
      if (paragraphs.length > 0) {
        return paragraphs.map((p) => p.outerHTML.trim()).filter(Boolean);
      }

      const blockTagNames = new Set([
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'blockquote',
        'pre',
        'figure',
        'hr',
      ]);

      const blockChildren = Array.from(body.children).filter((el) =>
        blockTagNames.has(el.tagName.toLowerCase())
      );
      if (blockChildren.length > 0) {
        return blockChildren.map((el) => el.outerHTML.trim()).filter(Boolean);
      }

      const inner = body.innerHTML.trim();
      if (!inner) return [];

      const parts = inner
        .split(/(?:<br\s*\/?>\s*){2,}/gi)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        return parts.map((p) => `<p>${p}</p>`);
      }

      return [`<p>${inner}</p>`];
    } catch {}
  }

  const normalized = hasTags ? html : html.replace(/\r\n/g, '\n');

  if (!hasTags) {
    const lines = normalized
      .split(/\n+/g)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];
    return lines.map((l) => `<p>${l}</p>`);
  }

  const parts = normalized
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return [html];
  return parts;
}

function addClassToFirstParagraph(html: string, className: string) {
  if (!html) return html;
  return html.replace(/<p(\s[^>]*)?>/i, (full, attrs = '') => {
    const hasClass = /\sclass=/.test(attrs);
    if (!hasClass) return `<p${attrs} class="${className}">`;
    return full.replace(/class=(['"])(.*?)\1/i, (_m, q, existing) => `class=${q}${existing} ${className}${q}`);
  });
}

function splitBlocksByWeight(blocks: string[]) {
  const weights = blocks.map((b) => b.replace(/<[^>]*>/g, '').length);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (blocks.length <= 1) {
    return { leftBlocks: blocks, rightBlocks: [] };
  }

  const ideal = total / 2;

  const prefixSums: number[] = [];
  let running = 0;
  for (let i = 0; i < weights.length; i += 1) {
    running += weights[i];
    prefixSums[i] = running;
  }

  let bestIndex = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 1; i < blocks.length; i += 1) {
    const left = prefixSums[i - 1];
    const right = total - left;
    const diff = Math.abs(left - right);

    const balancePenalty = diff / (ideal || 1);
    const minBlocksPenalty = i === 1 || i === blocks.length - 1 ? 0.25 : 0;

    const score = balancePenalty + minBlocksPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const splitIndex = bestIndex;

  return {
    leftBlocks: blocks.slice(0, splitIndex),
    rightBlocks: blocks.slice(splitIndex),
  };
}

function useScrollReveal(ref: React.RefObject<HTMLElement | null>, options?: IntersectionObserverInit) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('revealed');
        });
      },
      options ?? { threshold: 0.08 }
    );

    root.querySelectorAll('.scroll-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ref, options]);
}

function renderPage(page: any, imageVersion: string) {
  switch (page.type) {
    case 'cover':
      return <PageCover data={page.content} imageVersion={imageVersion} />;
    case 'editorial':
      return <PageEditorial data={page.content} imageVersion={imageVersion} />;
    case 'contents':
      return <PageContents data={page.content} imageVersion={imageVersion} />;
    case 'feature-left':
      return <PageFeatureLeft data={page.content} imageVersion={imageVersion} />;
    case 'feature-right':
      return <PageFeatureRight data={page.content} imageVersion={imageVersion} />;
    case 'column':
      return <PageColumn data={page.content} imageVersion={imageVersion} />;
    case 'lifestyle':
      return <PageLifestyle data={page.content} imageVersion={imageVersion} />;
    case 'spotlight':
      return <PageSpotlight data={page.content} imageVersion={imageVersion} />;
    case 'partner':
      return <PagePartner data={page.content} imageVersion={imageVersion} />;
    case 'back-cover':
      return <PageBackCover data={page.content} imageVersion={imageVersion} />;
    default:
      return <div>Page coming soon...</div>;
  }
}

const PAGE_PAD = 'p-[5%] pb-[15vh]';
const GRID_12 = 'grid grid-cols-12 gap-x-[clamp(1.25rem,3vw,4rem)]';
const GRID_CONTENT = 'w-full max-w-[min(94%,1200px)] mx-auto';

const PageCover = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll('.cover-animate');
    items.forEach((item, i) => {
      (item as HTMLElement).style.animationDelay = `${0.2 + i * 0.15}s`;
      item.classList.add('animate-slide-in-blur');
    });
  }, []);

  const dateIssue = [data.date, data.issue].filter(Boolean).join(' · ');

  return (
    <div ref={ref} className="relative min-h-full overflow-hidden">
      {data.videoUrl ? (
        <video
          src={data.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${fixMagazineImageUrl(data.image, imageVersion)}')` }}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob-primary absolute top-1/4 left-1/4 w-96 h-96 rounded-full" />
        <div className="blob-accent absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full" />
      </div>

      <div className="grain-overlay absolute inset-0 z-10" />

      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 min-h-full flex items-center">
        <div className="max-w-xl">
          <div className="cover-animate opacity-0 mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/20 rounded-full text-xs font-700 uppercase tracking-widest text-white/70 bg-white/5 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
              {dateIssue || 'Digital Edition'}
            </span>
          </div>

          <div className="cover-animate opacity-0 mb-6">
            <h1 className="text-hero-display font-serif font-600 text-white leading-none">
              Yorkshire
              <br />
              <span className="gold-shimmer">Business</span>
              <br />
              Woman
            </h1>
          </div>

          {(data.headline || data.subheadline) && (
            <div className="cover-animate opacity-0 mb-6">
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                <div className="w-1 h-10 bg-accent rounded-full flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-700 uppercase tracking-widest text-accent mb-0.5">
                    {data.badge || 'Special Report'}
                  </p>
                  {data.headline && (
                    <p className="text-white font-600 text-sm leading-tight line-clamp-2">
                      {data.headline}
                    </p>
                  )}
                  {data.subheadline && (
                    <div className="text-white/70 text-xs leading-snug [&_p]:m-0 [&_p]:inline">
                      <SafeText html={data.subheadline} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="cover-animate opacity-0 flex items-center gap-4">
            <Link
              href="/new-edition"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-600 text-sm rounded-full hover:opacity-90 transition-opacity"
            >
              Browse Archive
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/membership"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/30 text-white/80 font-500 text-sm rounded-full hover:bg-white/10 transition-colors"
            >
              Join the Community
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const PageEditorial = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  const allBlocks = getHtmlBlocks(data.text || '');

  const introHtml = data.intro || (!data.intro && allBlocks.length > 1 ? allBlocks[0] : '');
  const bodyHtml = (introHtml ? allBlocks.slice(1) : allBlocks).join('');
  const signature = String(data.author || '').trim().split(/\s+/g).filter(Boolean)[0] || '';
  const introWithDropcap = introHtml ? addClassToFirstParagraph(introHtml, 'editorial-dropcap') : '';

  return (
    <div ref={ref} className="bg-background py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal divider-ornament mb-10 max-w-xs">
          <span className="text-xs font-700 uppercase tracking-widest text-accent whitespace-nowrap">
            Editor&apos;s Note
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4 scroll-reveal scroll-reveal-delay-1">
            <div className="lg:sticky lg:top-32 space-y-5">
              <div className="image-frame rounded-2xl overflow-hidden aspect-[3/4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fixMagazineImageUrl(data.image, imageVersion)}
                  alt={data.author}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-secondary rounded-xl p-5">
                <p className="text-xs font-700 uppercase tracking-widest text-accent mb-1">Editor</p>
                <p className="font-700 text-foreground text-lg">{data.author}</p>
                <p className="text-sm text-muted-foreground">Yorkshire BusinessWoman Magazine</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="scroll-reveal scroll-reveal-delay-2">
              <h2 className="text-feature-xl font-serif font-600 text-foreground mb-2">{data.title}</h2>
            </div>

            {data.quote && (
              <div className="scroll-reveal scroll-reveal-delay-3 pull-quote">
                &ldquo;{data.quote}&rdquo;
              </div>
            )}

            <div className="scroll-reveal scroll-reveal-delay-4 space-y-4 text-foreground/80 leading-relaxed">
              {introWithDropcap && <SafeText html={introWithDropcap} />}
              {bodyHtml && <SafeText html={bodyHtml} />}
            </div>

            {signature && (
              <div className="scroll-reveal pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-px bg-accent" />
                  <p className="font-serif italic text-foreground font-500 text-lg">With warmth and ambition,</p>
                </div>
                <p className="font-700 text-primary mt-3 text-lg">{signature}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PageContents = ({ data }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref, { threshold: 0.1 });

  const items = Array.isArray(data.items) ? data.items : [];
  const news = Array.isArray(data.news) ? data.news : [];

  return (
    <div ref={ref} className="bg-secondary py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="feature-tag mb-2">Contents</p>
            <h2 className="text-section-lg font-serif font-600 text-foreground">In This Issue</h2>
          </div>
          <div className="flex items-center gap-4">
            <Link href="https://www.instagram.com/yorkshire_businesswoman" target="_blank" className="text-muted-foreground hover:text-accent transition-colors text-sm font-500">
              Instagram
            </Link>
            <Link href="https://www.linkedin.com/company/yorkshire-businesswoman" target="_blank" className="text-muted-foreground hover:text-accent transition-colors text-sm font-500">
              LinkedIn
            </Link>
            <Link href="https://x.com/YorksBizWoman" target="_blank" className="text-muted-foreground hover:text-accent transition-colors text-sm font-500">
              X
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {items.map((item: any, i: number) => {
            const pageLabel = String(item?.page ?? '').padStart(3, '0');
            return (
              <div
                key={`${pageLabel}-${item?.title ?? i}`}
                className={`scroll-reveal scroll-reveal-delay-${Math.min(i + 1, 4)} card-hover bg-card rounded-2xl overflow-hidden border border-border cursor-pointer`}
              >
                <div className="p-6 flex flex-col h-full min-h-[140px]">
                  <div className="flex items-start justify-between mb-4">
                    <span className="feature-tag">{item?.category}</span>
                    <span className="text-3xl font-800 text-border/60 font-serif leading-none">{pageLabel}</span>
                  </div>
                  <p className="font-serif font-600 text-foreground text-lg leading-snug flex-1">{item?.title}</p>
                  <div className="mt-4 h-0.5 w-12 rounded-full bg-accent" />
                </div>
              </div>
            );
          })}
        </div>

        {news.length > 0 && (
          <div className="scroll-reveal bg-card rounded-2xl border border-border p-6">
            <p className="feature-tag mb-4">Regional News</p>
            <ul className="space-y-3">
              {news.map((item: any, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                  <span className="text-accent mt-0.5 flex-shrink-0">◆</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const PageFeatureLeft = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const stats = Array.isArray(data.stats) ? data.stats : [];

  return (
    <div ref={ref} className="bg-background py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal divider-ornament mb-10 max-w-xs">
          <span className="text-xs font-700 uppercase tracking-widest text-accent whitespace-nowrap">
            {data.category || 'Feature'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
          <div className="lg:col-span-7 scroll-reveal">
            <div className="image-frame rounded-2xl overflow-hidden aspect-[16/10]">
              {data.videoUrl ? (
                <video
                  src={data.videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={fixMagazineImageUrl(data.image, imageVersion)}
                  alt={data.title || data.name || 'Feature'}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center space-y-5 scroll-reveal scroll-reveal-delay-2">
            <div>
              <p className="feature-tag mb-2">{data.tag || 'Feature'}</p>
              <h2 className="text-section-lg font-serif font-600 text-foreground mb-3">{data.title}</h2>
              {data.name && (
                <p className="text-sm text-muted-foreground font-500 uppercase tracking-wider">{data.name}</p>
              )}
            </div>

            {data.text && <SafeText html={data.text} className="text-foreground/80 leading-relaxed text-sm" />}

            {data.intro && (
              <div className="pull-quote text-base">
                <SafeText html={data.intro} className="[&_p]:m-0" />
              </div>
            )}

            {stats.length > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                {stats.slice(0, 3).map((stat: any) => (
                  <div key={stat?.label} className="bg-secondary rounded-xl p-3 text-center">
                    <p className="font-serif font-700 text-accent text-xl">{stat?.value}</p>
                    <p className="text-xs text-muted-foreground font-500 mt-0.5">{stat?.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PageFeatureRight = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const stats = Array.isArray(data.stats) ? data.stats : [];

  return (
    <div ref={ref} className="bg-secondary py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal divider-ornament mb-10 max-w-xs">
          <span className="text-xs font-700 uppercase tracking-widest text-accent whitespace-nowrap">
            {data.category || 'Feature'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-6 space-y-6 scroll-reveal">
            <div>
              <p className="feature-tag mb-2">{data.name || 'Feature'}</p>
              <h2 className="text-section-lg font-serif font-600 text-foreground">{data.title || data.name}</h2>
            </div>

            {data.quote && (
              <div className="pull-quote">
                &ldquo;{data.quote}&rdquo;
              </div>
            )}

            {data.text && <SafeText html={data.text} className="text-foreground/80 leading-relaxed" />}
          </div>

          <div className="lg:col-span-6 scroll-reveal scroll-reveal-delay-2 space-y-4">
            {data.image && (
              <div className="image-frame rounded-2xl overflow-hidden aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fixMagazineImageUrl(data.image, imageVersion)}
                  alt={data.title || data.name || 'Feature'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {stats.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-6">
                <p className="feature-tag mb-3">Snapshot</p>
                <div className="space-y-3">
                  {stats.map((stat: any, i: number) => (
                    <div key={`${stat?.label ?? 'stat'}-${i}`} className="bg-secondary rounded-xl border border-border p-4 flex items-start gap-4">
                      <span className="font-serif font-700 text-accent text-2xl shrink-0 w-16 text-center">{stat?.value}</span>
                      <p className="text-sm text-foreground/80 leading-relaxed">{stat?.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PageColumn = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const tips = Array.isArray(data.tips) ? data.tips : [];

  return (
    <div ref={ref} className="bg-background py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal divider-ornament mb-10 max-w-xs">
          <span className="text-xs font-700 uppercase tracking-widest text-accent whitespace-nowrap">
            {data.category || 'Column'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {data.image && (
            <div className="lg:col-span-5 scroll-reveal">
              <div className="image-frame rounded-2xl overflow-hidden aspect-[4/5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fixMagazineImageUrl(data.image, imageVersion)}
                  alt={data.title || data.category || 'Column'}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          <div
            className={[
              data.image ? 'lg:col-span-7' : 'lg:col-span-12',
              'space-y-6',
              data.image ? 'scroll-reveal scroll-reveal-delay-2' : 'scroll-reveal',
            ].join(' ')}
          >
            <div>
              <p className="feature-tag mb-2">{data.category || 'Column'}</p>
              <h2 className="text-section-lg font-serif font-600 text-foreground">{data.title}</h2>
              {data.author && <p className="text-sm text-muted-foreground font-500 uppercase tracking-wider mt-1">{data.author}</p>}
            </div>

            {data.text && <SafeText html={data.text} className="text-foreground/80 leading-relaxed" />}

            {tips.length > 0 && (
              <div className="bg-secondary rounded-2xl border border-border p-6">
                <p className="feature-tag mb-3">Key Takeaways</p>
                <ul className="space-y-2">
                  {tips.map((tip: any, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                      <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-700 flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PageLifestyle = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const title = String(data.title || '').trim();
  const highlights = Array.isArray(data.highlights) ? data.highlights : [];
  const extraImages: string[] = Array.isArray(data.images)
    ? data.images.map((x: any) => String(x || '').trim()).filter(Boolean)
    : [];
  const textPreview = String(data.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <div ref={ref} className="bg-background py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal divider-ornament mb-10 max-w-xs">
          <span className="text-xs font-700 uppercase tracking-widest text-accent whitespace-nowrap">Lifestyle</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="md:col-span-2 scroll-reveal">
            <div className="image-frame rounded-2xl overflow-hidden aspect-[16/9] relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fixMagazineImageUrl(data.image, imageVersion)}
                alt={title || 'Lifestyle'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="feature-tag mb-2 text-white/80">Lifestyle</p>
                <h3 className="font-serif font-600 text-white text-2xl">{title}</h3>
              </div>
            </div>
          </div>

          <div className="space-y-4 scroll-reveal scroll-reveal-delay-2">
            <div className="bg-secondary rounded-2xl p-6 border border-border h-full flex flex-col justify-between min-h-[200px]">
              <div>
                <p className="feature-tag mb-3">Highlights</p>
                {highlights.length > 0 ? (
                  <ul className="space-y-2">
                    {highlights.slice(0, 6).map((h: any, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-accent mt-0.5">◆</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Lifestyle highlights appear here.</p>
                )}
              </div>

              {data.logo && (
                <div className="pt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fixMagazineImageUrl(data.logo, imageVersion)}
                    alt="Logo"
                    className="h-10 w-auto object-contain opacity-90"
                  />
                </div>
              )}
            </div>

            {textPreview && (
              <div className="bg-secondary rounded-2xl p-6 border border-border flex flex-col justify-between min-h-[160px]">
                <div>
                  <p className="feature-tag mb-3">Editor&apos;s Pick</p>
                  <p className="font-serif font-600 text-foreground text-xl leading-snug">{title || 'Lifestyle Edit'}</p>
                </div>
                <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{textPreview}</p>
              </div>
            )}
          </div>
        </div>

        {data.text && (
          <div className="scroll-reveal bg-card rounded-2xl border border-border p-6 md:p-10">
            <SafeText html={data.text} className="text-foreground/80 leading-relaxed" />
          </div>
        )}

        {extraImages.length > 0 && (
          <div className="scroll-reveal mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {extraImages.slice(0, 8).map((src: string, i: number) => (
              <div key={`${src}-${i}`} className="image-frame rounded-2xl overflow-hidden aspect-[4/3] bg-card border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fixMagazineImageUrl(src, imageVersion)} alt={`Lifestyle image ${i + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PageSpotlight = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  return (
    <div ref={ref} className="bg-secondary py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 scroll-reveal">
            <div className="relative">
              <div className="image-frame rounded-2xl overflow-hidden aspect-[4/5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fixMagazineImageUrl(data.image, imageVersion)}
                  alt={data.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                <p className="text-xs font-700 uppercase tracking-widest text-accent mb-0.5">Member Spotlight</p>
                <p className="font-700 text-foreground">{data.name}</p>
                {data.role && <p className="text-xs text-muted-foreground">{data.role}</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6 scroll-reveal scroll-reveal-delay-2">
            <div>
              <p className="feature-tag mb-2">Member Spotlight</p>
              <h2 className="text-section-lg font-serif font-600 text-foreground">{data.name}</h2>
            </div>

            {data.message && (
              <div className="pull-quote">
                <SafeText html={data.message} className="[&_p]:m-0" />
              </div>
            )}

            {data.bio && <SafeText html={data.bio} className="text-foreground/80 leading-relaxed text-sm" />}
          </div>
        </div>
      </div>
    </div>
  );
};

const PagePartner = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  return (
    <div ref={ref} className="bg-primary py-16 lg:py-24 relative overflow-hidden min-h-full text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob-accent absolute top-0 right-0 w-96 h-96 rounded-full opacity-20" />
        <div className="blob-primary absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="space-y-6 scroll-reveal">
            <div>
              <p className="text-xs font-700 uppercase tracking-widest text-accent mb-2">Partner Feature</p>
              <h2 className="text-section-lg font-serif font-600 text-white">{data.brand}</h2>
              {data.headline && <p className="text-white/70 font-500 mt-1 text-lg">{data.headline}</p>}
            </div>

            {data.text ? (
              <SafeText html={data.text} className="text-white/80 leading-relaxed" />
            ) : (
              data.offer && <p className="text-white/80 leading-relaxed">{data.offer}</p>
            )}

            {data.offer && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-px bg-accent" />
                <p className="text-white/60 text-sm font-500">{data.offer}</p>
              </div>
            )}
          </div>

          {data.image && (
            <div className="scroll-reveal scroll-reveal-delay-2">
              <div className="image-frame rounded-2xl overflow-hidden aspect-[3/4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fixMagazineImageUrl(data.image, imageVersion)}
                  alt={data.brand}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PageBackCover = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const socials = Array.isArray(data.socials) ? data.socials : [];

  return (
    <div ref={ref} className="bg-background py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal divider-ornament mb-10 max-w-xs">
          <span className="text-xs font-700 uppercase tracking-widest text-accent whitespace-nowrap">Next Edition</span>
        </div>

        <div className="scroll-reveal bg-secondary rounded-3xl border border-border overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <div className="p-10 lg:p-14 flex flex-col justify-center space-y-5">
              <div>
                <p className="feature-tag mb-2">Coming Soon</p>
                <h2 className="text-section-lg font-serif font-600 text-foreground">Next Edition</h2>
                {data.nextIssue && <p className="text-muted-foreground font-500 mt-1 text-lg">{data.nextIssue}</p>}
              </div>

              <p className="text-foreground/80 leading-relaxed">
                Yorkshire BusinessWoman magazine — celebrating the leaders, innovators and changemakers shaping our region.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/membership"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-600 text-sm rounded-full hover:opacity-90 transition-opacity"
                >
                  {data.cta || 'Join the Community'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>

                {socials.length > 0 && (
                  <div className="flex items-center gap-2">
                    {socials.slice(0, 6).map((label: any, i: number) => (
                      <span key={`${label}-${i}`} className="text-muted-foreground text-sm font-500">
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {data.image && (
              <div className="image-frame aspect-[4/3] lg:aspect-auto overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fixMagazineImageUrl(data.image, imageVersion)}
                  alt="Next edition"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
