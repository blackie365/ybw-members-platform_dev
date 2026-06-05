'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Menu, 
  Download, 
  Share2, 
  Quote, 
  Star,
  Award,
  Users,
  ArrowRight
} from 'lucide-react';
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
    <div className="fixed inset-0 h-[100dvh] bg-[#050505] text-zinc-100 flex flex-col z-[100] overflow-hidden perspective-1000 overscroll-none selection:bg-accent/30">
      
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
        <div className="relative w-full h-full max-w-[min(94vw,1200px)] aspect-[3/4] lg:aspect-auto lg:h-[min(90vh,850px)] xl:h-[min(80vh,950px)] mx-auto overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.4)] bg-white text-zinc-900 self-center">
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
  
  // If it's plain text (no tags), convert newlines to <br />
  // If it has tags but no <p> or <br>, it might still need newline conversion
  let content = html;
  if (!html.includes('<')) {
    content = html.replace(/\n/g, '<br />');
  } else if (!html.includes('<p') && !html.includes('<br')) {
    content = html.replace(/\n/g, '<br />');
  }
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: content }} 
    />
  );
}

function getHtmlBlocks(html: string): string[] {
  if (!html) return [];

  const hasTags = html.includes('<');

  if (typeof window !== 'undefined' && hasTags && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nodes = Array.from(doc.body.childNodes);

      const blocks = nodes
        .map((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent || '').trim();
            if (!text) return '';
            return `<p>${text}</p>`;
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const outer = el.outerHTML?.trim() || '';
            return outer;
          }
          return '';
        })
        .filter(Boolean);

      if (blocks.length > 0) return blocks;
    } catch {}
  }

  const normalized = hasTags ? html : html.replace(/\r\n/g, '\n');
  const parts = normalized
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return hasTags ? [html] : [`<p>${normalized}</p>`];
  return hasTags ? parts : parts.map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`);
}

function splitBlocksByWeight(blocks: string[]) {
  const weights = blocks.map((b) => b.replace(/<[^>]*>/g, '').length);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const target = total / 2;

  let running = 0;
  let splitIndex = blocks.length;
  for (let i = 0; i < blocks.length; i += 1) {
    running += weights[i];
    if (running >= target) {
      splitIndex = i + 1;
      break;
    }
  }

  return {
    leftBlocks: blocks.slice(0, splitIndex),
    rightBlocks: blocks.slice(splitIndex),
  };
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

const PageCover = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-zinc-900">
    {data.videoUrl ? (
      <video 
        src={data.videoUrl} 
        autoPlay 
        muted 
        loop 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover opacity-95 brightness-[0.9]"
      />
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={fixMagazineImageUrl(data.image, imageVersion)} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-95 brightness-[0.9]" />
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />
    
    {/* Brand Overlay */}
    <div className="absolute top-[8%] left-1/2 -translate-x-1/2 text-center w-full px-8">
      <p className="text-white/70 text-[clamp(10px,1.2vh,13px)] tracking-[0.4em] uppercase mb-[2%] font-semibold drop-shadow-md">{data.date} · {data.issue}</p>
      <h2 className="text-white font-serif text-[clamp(2.2rem,8vh,6rem)] font-medium tracking-tighter leading-[0.9] mb-[2%] drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
        Yorkshire <br />
        <span className="italic">BusinessWoman</span>
      </h2>
      <div className="h-0.5 w-[clamp(3rem,8vw,6rem)] bg-accent mx-auto shadow-lg" />
    </div>

    {/* Main Headline */}
    <div className="absolute bottom-[10%] left-[8%] right-[8%] max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <Badge className="bg-accent text-white border-none rounded-none mb-[3%] px-[3%] py-[0.5%] tracking-widest uppercase text-[clamp(10px,1.2vh,13px)] shadow-xl">Special Report</Badge>
        <h1 className="text-white text-[clamp(1.5rem,5vh,4rem)] font-serif font-medium leading-[1.1] mb-[3%] drop-shadow-lg">
          {data.headline}
        </h1>
        <p className="text-white/90 text-[clamp(0.85rem,1.8vh,1.3rem)] font-light max-w-2xl border-l-4 border-accent pl-[4%] line-clamp-3 sm:line-clamp-none leading-relaxed drop-shadow-md">
          {data.subheadline}
        </p>
      </motion.div>
    </div>
  </div>
);

const PageEditorial = ({ data, imageVersion }: any) => {
  const allBlocks = getHtmlBlocks(data.text || '');

  const standfirstHtml = !data.intro && allBlocks.length > 1 ? allBlocks[0] : '';
  const bodyBlocks = standfirstHtml ? allBlocks.slice(1) : allBlocks;

  const { leftBlocks, rightBlocks } = splitBlocksByWeight(bodyBlocks);
  const leftHtml = leftBlocks.join('');
  const rightHtml = rightBlocks.join('');

  const bodyRichTextClass =
    'text-zinc-700 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_a]:underline [&_a]:underline-offset-2';

  return (
    <div className="min-h-full w-full p-[5%] pb-[15vh] flex flex-col lg:flex-row gap-[5%] bg-[#FAF9F6] overflow-visible">
      <div className="lg:w-[25%] xl:w-[20%] shrink-0">
        <div className="relative aspect-[3/4] rounded-sm overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] grayscale hover:grayscale-0 transition-all duration-1000 w-full max-w-[300px] mx-auto lg:mx-0 ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.author} className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <div className="mt-[10%] flex flex-col items-center lg:items-start text-center lg:text-left gap-4">
          <div className="flex items-center gap-4 group">
            <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-accent/20 group-hover:border-accent transition-colors shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.gravatar.com/avatar/29532578500282030f2f3d53f2c5e533?s=200&d=mp"
                alt="Editor Avatar"
                className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
              />
            </div>
            <div>
              <p className="font-serif text-[clamp(0.9rem,2.2vh,1.5rem)] italic text-zinc-900 leading-tight">{data.author}</p>
              {data.role && (
                <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-medium">{data.role}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:w-[75%] xl:w-[80%] flex flex-col justify-start">
        <div className="max-w-[1000px] w-full">
          <Badge variant="outline" className="mb-[3%] w-fit border-accent text-accent tracking-[0.3em] uppercase text-[clamp(9px,1vh,11px)] px-[3%] py-[1%]">
            Editor&apos;s Note
          </Badge>

          <h2 className="text-[clamp(1.8rem,6vh,4rem)] font-serif mb-[3%] tracking-tight text-zinc-900 leading-[0.92]">{data.title}</h2>

          {(data.intro || standfirstHtml) && (
            <div className="text-[clamp(1.1rem,2.5vh,1.6rem)] font-bold text-zinc-900 leading-snug mb-[4%] max-w-[92%] font-serif italic border-b border-accent/10 pb-6">
              <SafeText html={data.intro || standfirstHtml} className="[&_p]:mb-0 [&_strong]:font-extrabold" />
            </div>
          )}

          <div className="text-[clamp(0.9rem,2vh,1.3rem)] text-zinc-800 leading-[1.4] font-light relative">
            <div className="lg:hidden">
              <div className="first-letter:text-[clamp(3.5rem,8.5vh,5.2rem)] first-letter:font-serif first-letter:text-accent first-letter:float-left first-letter:mr-[4%] first-letter:leading-[0.85] first-letter:mt-[1%]">
                <SafeText html={bodyBlocks.join('')} className={bodyRichTextClass} />
              </div>
              {data.quote && (
                <blockquote className="mt-8 border-l-[6px] border-accent/30 pl-[5%] py-[3%] italic text-zinc-600 font-serif text-[clamp(1.1rem,2.5vh,1.8rem)] leading-[1.4] bg-accent/5 pr-[5%] shadow-sm">
                  &quot;{data.quote}&quot;
                </blockquote>
              )}
            </div>

            {data.quote ? (
              <div className="hidden lg:grid grid-cols-[1fr_1fr_260px] gap-12 items-start">
                <div className="min-w-0">
                  <div className="first-letter:text-[clamp(3.5rem,8.5vh,5.2rem)] first-letter:font-serif first-letter:text-accent first-letter:float-left first-letter:mr-[4%] first-letter:leading-[0.85] first-letter:mt-[1%]">
                    <SafeText html={leftHtml} className={bodyRichTextClass} />
                  </div>
                </div>
                <div className="min-w-0">
                  <SafeText html={rightHtml} className={bodyRichTextClass} />
                </div>
                <aside className="min-w-0 lg:sticky lg:top-24">
                  <div className="relative">
                    <Quote className="absolute -left-8 -top-10 h-16 w-16 text-accent/10" />
                    <blockquote className="border-l-[6px] border-accent/30 pl-6 py-6 italic text-zinc-700 font-serif text-[clamp(1.05rem,2.2vh,1.55rem)] leading-[1.35] bg-white/40 pr-5 shadow-sm ring-1 ring-black/5">
                      &quot;{data.quote}&quot;
                    </blockquote>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="hidden lg:block lg:columns-2 gap-12">
                <div className="first-letter:text-[clamp(3.5rem,8.5vh,5.2rem)] first-letter:font-serif first-letter:text-accent first-letter:float-left first-letter:mr-[4%] first-letter:leading-[0.85] first-letter:mt-[1%]">
                  <SafeText html={bodyBlocks.join('')} className={bodyRichTextClass} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PageContents = ({ data }: any) => (
  <div className="min-h-full w-full p-[5%] pb-[15vh] grid lg:grid-cols-2 gap-[8%] bg-white pt-[10%] lg:pt-[5%]">
    <div className="flex flex-col justify-center max-w-[500px] mx-auto lg:mx-0 w-full">
      <h2 className="text-[clamp(2.2rem,7vh,5rem)] font-serif mb-[8%] tracking-tighter text-zinc-900 leading-none">In This <span className="italic text-accent">Issue</span></h2>
      <div className="space-y-[4%]">
        {data.items?.map((item: any, i: number) => (
          <div key={i} className="group cursor-pointer flex items-end gap-[5%] border-b border-zinc-100 pb-[4%] hover:border-accent/60 transition-all duration-500">
            <span className="text-accent font-mono text-[clamp(1.1rem,2.5vh,2rem)] opacity-30 group-hover:opacity-100 transition-all duration-500 transform group-hover:scale-110">0{item.page}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[clamp(9px,0.9vh,11px)] uppercase tracking-[0.3em] text-accent/60 mb-[1%] font-bold">{item.category}</p>
              <p className="text-[clamp(1rem,2.2vh,1.6rem)] font-serif group-hover:text-accent transition-colors truncate text-zinc-900">{item.title}</p>
            </div>
            <ArrowRight className="h-[clamp(0.9rem,2.2vh,1.6rem)] w-[clamp(0.9rem,2.2vh,1.6rem)] text-zinc-200 group-hover:text-accent group-hover:translate-x-[20%] transition-all duration-500 shrink-0" />
          </div>
        ))}
      </div>
    </div>
    <div className="bg-zinc-50 p-[8%] rounded-[2rem] flex flex-col justify-center shadow-inner border border-zinc-100 h-fit lg:h-full max-w-[500px] mx-auto lg:mx-0 w-full">
      <Badge className="bg-accent text-white mb-[8%] w-fit tracking-[0.3em] uppercase text-[clamp(9px,1.1vh,12px)] px-[5%] py-[1.5%] shadow-lg">Regional News</Badge>
      <div className="space-y-[6%]">
        {data.news?.map((n: any, i: number) => (
          <div key={i} className="flex gap-[5%] items-start group">
            <div className="h-[clamp(5px,0.7vh,8px)] w-[clamp(5px,0.7vh,8px)] rounded-full bg-accent mt-[1.2vh] shrink-0 shadow-[0_0_10px_rgba(163,65,58,0.5)] group-hover:scale-150 transition-transform duration-500" />
            <p className="text-[clamp(0.9rem,2.2vh,1.4rem)] font-light text-zinc-800 leading-tight group-hover:text-zinc-900 transition-colors">{n}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-[8%] border-t-2 border-zinc-200/50">
        <p className="text-[clamp(9px,1vh,11px)] uppercase tracking-[0.5em] font-black text-zinc-400 mb-[5%]">Stay Connected</p>
        <div className="flex gap-[10%]">
          <Star className="h-[clamp(1.2rem,3.5vh,2.5rem)] w-[clamp(1.2rem,3.5vh,2.5rem)] text-accent fill-current drop-shadow-md hover:scale-110 transition-transform" />
          <Award className="h-[clamp(1.2rem,3.5vh,2.5rem)] w-[clamp(1.2rem,3.5vh,2.5rem)] text-accent drop-shadow-md hover:scale-110 transition-transform" />
          <Users className="h-[clamp(1.2rem,3.5vh,2.5rem)] w-[clamp(1.2rem,3.5vh,2.5rem)] text-accent drop-shadow-md hover:scale-110 transition-transform" />
        </div>
      </div>
    </div>
  </div>
);

const PageFeatureLeft = ({ data, imageVersion }: any) => (
  <div className="min-h-full w-full relative flex flex-col lg:grid lg:grid-cols-2 bg-[#FAF9F6] pb-[15vh]">
    <div className="relative h-[40vh] lg:h-full overflow-hidden group shrink-0 shadow-2xl">
      {data.videoUrl ? (
        <video 
          src={data.videoUrl} 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] brightness-100"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110 brightness-100" />
      )}
      <div className="absolute inset-0 bg-accent/5 mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent" />
    </div>
    <div className="p-[8%] flex flex-col justify-center bg-[#FAF9F6]">
      <div className="max-w-[min(100%,700px)]">
        <Badge variant="outline" className="mb-[6%] w-fit border-accent text-accent tracking-[0.4em] uppercase text-[clamp(9px,1.1vh,12px)] px-[4%] py-[1%] border-2">Feature</Badge>
        <h2 className="text-[clamp(2.2rem,8vh,4.5rem)] font-serif font-medium mb-[4%] leading-[0.9] tracking-tighter text-zinc-900">{data.title}</h2>
        <div className="flex items-center gap-[4%] mb-[10%] mt-[2%]">
          <div className="h-[1px] w-[clamp(1.5rem,4vw,3rem)] bg-accent/30" />
          <h3 className="text-[clamp(0.8rem,1.8vh,1.3rem)] uppercase tracking-[0.3em] text-zinc-500 font-medium leading-none">{data.name}</h3>
        </div>
        <div className="relative">
          <Quote className="absolute -left-[8%] -top-[15%] h-[clamp(2.5rem,8vh,5rem)] w-[clamp(2.5rem,8vh,5rem)] text-accent/5 hidden sm:block" />
          <SafeText html={data.intro} className="text-[clamp(1rem,2.5vh,1.8rem)] text-zinc-800 font-light leading-relaxed border-l-[6px] border-accent pl-[8%] italic relative z-10 bg-white/40 py-[5%] pr-[5%] shadow-sm" />
        </div>
      </div>
    </div>
  </div>
);

const PageFeatureRight = ({ data, imageVersion }: any) => (
  <div className="min-h-full w-full relative p-[5%] pb-[15vh] flex flex-col justify-start bg-white pt-[10%] lg:pt-[5%] overflow-visible">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fixMagazineImageUrl(data.image, imageVersion)} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-10 sm:opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
      </div>
    )}
    <div className="relative z-10 max-w-[min(94%,1000px)] mx-auto w-full min-h-0">
      <div className="flex items-center gap-[2%] mb-[4%]">
        <Quote className="h-[clamp(1.5rem,5vh,3rem)] w-[clamp(1.5rem,5vh,3rem)] text-accent/10" />
        {data.name && <p className="text-[clamp(8px,0.9vh,10px)] uppercase tracking-[0.3em] text-accent/50 font-medium">{data.name}</p>}
      </div>
      <div className="pr-[4%]">
        <h2 className="text-[clamp(1.3rem,4vh,3rem)] font-serif italic text-black leading-tight mb-[6%] max-w-[800px]">
          &quot;{data.quote}&quot;
        </h2>
        <div className="grid lg:grid-cols-2 gap-[8%] items-start">
          <SafeText html={data.text} className="space-y-[4%] text-[clamp(0.9rem,2vh,1.2rem)] text-zinc-600 leading-relaxed font-light" />
          <div className="bg-zinc-50 p-[8%] rounded-[2rem] shadow-sm border border-zinc-100 mt-[5%] lg:mt-0">
            <p className="text-[clamp(9px,1vh,11px)] uppercase tracking-[0.3em] font-bold text-accent mb-[8%]">Snapshot</p>
            <div className="space-y-[6%]">
              {data.stats?.map((stat: any, i: number) => (
                <div key={i} className="flex justify-between items-end border-b border-zinc-200 pb-[3%]">
                  <span className="text-zinc-400 uppercase tracking-widest text-[clamp(8px,0.9vh,10px)] font-medium">{stat.label}</span>
                  <span className="text-[clamp(1.2rem,3.5vh,2.5rem)] font-serif text-accent leading-none">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PageColumn = ({ data, imageVersion }: any) => (
  <div className="min-h-full w-full relative bg-zinc-900 text-white flex flex-col justify-start pb-[15vh] pt-[10%] lg:pt-[8%] overflow-visible">
    {data.image && (
      <div className="absolute inset-0 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.title} className="absolute inset-0 w-full h-full object-cover opacity-25 sm:opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-transparent" />
      </div>
    )}
    <div className="relative z-10 p-[8%] max-w-[min(90%,1200px)] w-full mx-auto lg:mx-0 min-h-0">
      <Badge className="bg-accent text-white rounded-none mb-[5%] tracking-widest uppercase px-[4%] py-[1%] text-[clamp(9px,1.1vh,12px)] shadow-lg">
        {data.category}
      </Badge>
      <h2 className="text-[clamp(1.8rem,7vh,4.5rem)] font-serif mb-[6%] tracking-tight leading-[0.9] text-white">
        {data.title}
      </h2>
      <div className="pr-[4%]">
        <div className="flex flex-col lg:flex-row gap-[8%] items-start">
          <div className="lg:w-[65%] space-y-[4%] text-[clamp(0.9rem,2vh,1.3rem)] text-zinc-300 leading-relaxed font-light">
            <SafeText html={data.text} />
            <div className="h-[2px] w-[clamp(3rem,6vw,8rem)] bg-accent mt-[12%]" />
            <p className="font-serif italic text-[clamp(1rem,3vh,1.7rem)] text-white mt-[3%]">{data.author}</p>
          </div>
          {data.tips && data.tips.length > 0 && (
            <div className="lg:w-[35%] bg-white/5 p-[6%] rounded-xl backdrop-blur-md border border-white/10 w-full shadow-2xl mt-[8%] lg:mt-0">
              <p className="text-[clamp(9px,1vh,12px)] uppercase tracking-[0.3em] text-accent mb-[6%] font-bold">Key Takeaways</p>
              <ul className="space-y-[4%]">
                {data.tips?.map((tip: any, i: number) => (
                  <li key={i} className="flex gap-[5%] items-start">
                    <div className="h-[clamp(4px,0.7vh,7px)] w-[clamp(4px,0.7vh,7px)] rounded-full bg-accent mt-[1.2vh] shrink-0" />
                    <p className="text-[clamp(0.8rem,1.7vh,1rem)] font-light text-zinc-400 leading-tight">{tip}</p>
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

const PageLifestyle = ({ data, imageVersion }: any) => (
  <div className="min-h-full w-full relative bg-[#FAF9F6] flex flex-col lg:block pb-[15vh] overflow-visible">
    <div className="relative lg:absolute top-0 right-0 w-full lg:w-[55%] h-[40vh] lg:h-full shrink-0 shadow-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-[#FAF9F6] to-transparent lg:from-30%" />
    </div>
    <div className="relative h-full w-full p-[8%] flex flex-col justify-start lg:justify-center z-10 min-h-0 pt-[12%] lg:pt-[8%]">
      <div className="max-w-[min(100%,500px)] lg:max-w-[42%] pr-[4%]">
        <Badge variant="outline" className="mb-[5%] border-zinc-300 text-zinc-500 tracking-widest uppercase text-[clamp(9px,1vh,11px)] px-[4%] py-[1%]">Lifestyle</Badge>
        <h2 className="text-[clamp(2rem,8vh,4.5rem)] font-serif mb-[4%] tracking-tighter leading-[0.85]">The <span className="italic text-accent">Art</span> of <br />Balance</h2>
        <SafeText html={data.text} className="text-[clamp(0.9rem,2vh,1.3rem)] text-zinc-600 leading-relaxed font-light mb-[8%] max-w-lg" />
        <div className="space-y-[3%]">
          {data.highlights?.map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-[5%] group cursor-pointer">
              <div className="h-px w-[clamp(1.5rem,4vw,3rem)] bg-zinc-300 group-hover:w-[clamp(2.5rem,6vw,4.5rem)] group-hover:bg-accent transition-all duration-500" />
              <p className="text-[clamp(9px,1.1vh,12px)] uppercase tracking-[0.3em] font-medium group-hover:text-accent transition-colors">{h}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const PageSpotlight = ({ data, imageVersion }: any) => (
  <div className="min-h-full w-full p-[5%] pb-[15vh] bg-white flex flex-col justify-start pt-[10%] lg:pt-[5%] overflow-visible">
    <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center gap-[8%] lg:gap-[10%] w-full min-h-0">
      <div className="relative h-[30vh] lg:h-[60vh] aspect-[3/4] shrink-0">
        <div className="absolute -inset-[3%] border-2 border-accent/20 rounded-2xl -rotate-3" />
        <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl rotate-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </div>
      <div className="text-center lg:text-left py-[4%] flex-1 pr-[4%]">
        <Badge className="bg-accent text-white mb-[6%] tracking-widest uppercase text-[clamp(9px,1.1vh,12px)] px-[5%] py-[1.5%] shadow-lg">Member Spotlight</Badge>
        <h2 className="text-[clamp(1.8rem,6vh,4rem)] font-serif mb-[1%] tracking-tight text-zinc-900 leading-none">{data.name}</h2>
        <p className="text-[clamp(1rem,2.2vh,1.5rem)] text-accent font-medium mb-[8%] tracking-wide">{data.role}</p>
        <div className="relative mb-[6%]">
           <Quote className="absolute -left-[5%] -top-[10%] h-[clamp(1.5rem,5vh,3rem)] w-[clamp(1.5rem,5vh,3rem)] text-accent/5 hidden lg:block" />
          <p className="text-[clamp(1rem,2.5vh,1.8rem)] text-zinc-600 leading-relaxed font-light italic border-l-4 border-accent/20 pl-[5%] relative z-10">
            &quot;{data.message}&quot;
          </p>
        </div>
        <SafeText html={data.bio} className="text-[clamp(0.85rem,1.8vh,1.1rem)] text-zinc-500 leading-relaxed max-w-xl mx-auto lg:mx-0" />
        <Button className="mt-[8%] rounded-none px-[8%] py-[3%] h-auto bg-black text-white hover:bg-accent transition-all duration-300 tracking-widest uppercase text-[clamp(9px,1vh,11px)] shadow-xl border-none">Read Full Profile</Button>
      </div>
    </div>
  </div>
);

const PagePartner = ({ data, imageVersion }: any) => (
  <div className="min-h-full w-full relative bg-black pb-[15vh]">
    {data.videoUrl ? (
      <video 
        src={data.videoUrl} 
        autoPlay 
        muted 
        loop 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover opacity-80 brightness-[0.85]"
      />
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.brand} className="absolute inset-0 w-full h-full object-cover opacity-80 brightness-[0.85]" />
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
    
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-[8%]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5 }}
        className="max-w-[min(90%,1000px)]"
      >
        <p className="text-accent text-[clamp(9px,1.1vh,12px)] tracking-[0.6em] uppercase mb-[4%] font-bold drop-shadow-md">Partner Feature</p>
        <h2 className="text-white font-serif text-[clamp(2.2rem,8vh,6rem)] mb-[2%] tracking-tight leading-none drop-shadow-2xl">{data.brand}</h2>
        <p className="text-white/70 text-[clamp(1rem,2.5vh,2.2rem)] font-light mb-[8%] tracking-wide leading-tight drop-shadow-lg">{data.headline}</p>
        <div className="bg-accent text-white px-[8%] py-[3%] text-[clamp(1rem,3vh,2.5rem)] font-serif italic shadow-[0_20px_50px_rgba(163,65,58,0.4)] inline-block">
          {data.offer}
        </div>
      </motion.div>
    </div>
  </div>
);

const PageBackCover = ({ data, imageVersion }: any) => (
  <div className="min-h-full w-full relative bg-[#050505] flex flex-col items-center justify-start text-center p-[8%] pt-[15vh] pb-[15vh]">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fixMagazineImageUrl(data.image, imageVersion)} alt="Back Cover" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60" />
      </div>
    )}
    <div className="relative z-10 max-w-[min(90%,800px)] w-full flex flex-col items-center">
      <h2 className="text-white font-serif text-[clamp(2.2rem,8vh,6rem)] mb-[6%] tracking-tighter leading-[0.85] drop-shadow-2xl">
        Yorkshire <br />
        <span className="italic text-accent">BusinessWoman</span>
      </h2>
      <div className="h-0.5 w-[clamp(3rem,8vw,10rem)] bg-white/20 mx-auto mb-[12%]" />
      
      <div className="space-y-[2vh] mb-[10%]">
        <p className="text-white/60 text-[clamp(9px,1vh,12px)] tracking-[0.4em] uppercase font-bold">Next Edition</p>
        <h3 className="text-white text-[clamp(1.3rem,3.5vh,3rem)] font-serif leading-tight drop-shadow-lg">{data.nextIssue}</h3>
      </div>
      
      <Button className="rounded-full px-[8%] py-[3%] h-auto text-[clamp(0.9rem,2vh,1.3rem)] bg-accent hover:bg-white hover:text-accent transition-all duration-500 mb-[10%] shadow-2xl border-none" asChild>
        <Link href="/membership">{data.cta}</Link>
      </Button>

      <div className="flex justify-center gap-[8%] pt-[10%] border-t border-white/10 w-full">
        {data.socials?.map((s: any, i: number) => (
          <span key={i} className="text-white/40 text-[clamp(8px,0.9vh,10px)] tracking-widest uppercase hover:text-white transition-colors cursor-pointer">{s}</span>
        ))}
      </div>
    </div>
  </div>
);
