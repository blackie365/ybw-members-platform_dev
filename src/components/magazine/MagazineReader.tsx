'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X, Menu, Download, Share2, ArrowRight, Maximize2, Minimize2 } from 'lucide-react';


import { Logo } from '@/components/Logo';
import { MagazinePage, MagazineIssue } from '@/lib/magazine-service';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';

interface MagazineReaderProps {
  issue: MagazineIssue;
  pages: MagazinePage[];
  id: string;
}

export default function MagazineReader({ issue, pages }: MagazineReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [imageVersion, setImageVersion] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'Escape') setIsNavOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const anyDoc = document as any;
      setIsFullscreen(Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as any);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as any);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const anyDoc = document as any;
      if (!(document.fullscreenElement || anyDoc.webkitFullscreenElement)) {
        const el = rootRef.current;
        if (!el) return;
        const anyEl = el as any;
        const request =
          (anyEl.requestFullscreen as undefined | (() => Promise<void>)) ??
          (anyEl.webkitRequestFullscreen as undefined | (() => Promise<void>));
        if (!request) return;
        await request.call(el);
      } else {
        const exit =
          (document.exitFullscreen as undefined | (() => Promise<void>)) ??
          (anyDoc.webkitExitFullscreen as undefined | (() => Promise<void>));
        if (!exit) return;
        await exit.call(document);
      }
    } catch {
      return;
    }
  }, []);

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

  const progress = ((currentPage + 1) / pages.length) * 100;

  return (
    <div ref={rootRef} className="magazine-rocket-theme fixed inset-0 h-[100dvh] bg-[#0c0a09] text-zinc-100 flex flex-col z-[100] overflow-hidden perspective-1000 overscroll-none selection:bg-accent/30">

      {/* ── Top Control Bar ── */}
      <header className="h-14 sm:h-16 border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 backdrop-blur-xl z-50 shrink-0 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/new-edition" className="text-zinc-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Link>
          <div className="h-5 w-px bg-white/10 mx-1 sm:mx-2" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-6 sm:h-8 brightness-0 invert opacity-90" />
            <span className="text-white/20 hidden sm:block">|</span>
            <p className="text-[10px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-[#8b1f3f] truncate max-w-[100px] sm:max-w-none">
              {(pages[currentPage]?.content as any)?.date || issue?.title || "Edition"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Page counter pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-zinc-400">
            <span className="text-white font-semibold">{currentPage + 1}</span>
            <span className="text-zinc-600">/</span>
            <span>{pages.length}</span>
          </div>
          <div className="h-5 w-px bg-white/10 mx-1 sm:mx-2" />
          <button className="text-zinc-500 hover:text-white h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors">
            <Share2 className="h-4 w-4 sm:h-4 sm:w-4" />
          </button>
          <button className="text-zinc-500 hover:text-white h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors">
            <Download className="h-4 w-4 sm:h-4 sm:w-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-zinc-500 hover:text-white h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 sm:h-4 sm:w-4" />
            ) : (
              <Maximize2 className="h-4 w-4 sm:h-4 sm:w-4" />
            )}
          </button>
          <button
            className="text-zinc-500 hover:text-white lg:hidden h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Main Reader Stage ── */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden touch-pan-y bg-[#0c0a09]">

        {/* Ambient glow behind the page */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[60vw] h-[60vh] rounded-full bg-[#8b1f3f]/8 blur-[120px]" />
        </div>

        {/* Navigation Arrows (Desktop) */}
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-4 xl:left-8 z-40 h-11 w-11 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center hover:bg-white/[0.12] hover:border-white/20 hover:scale-105 transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-xl backdrop-blur-sm"
        >
          <ChevronLeft className="h-5 w-5 text-zinc-300" />
        </button>

        <button
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
          className="absolute right-4 xl:right-8 z-40 h-11 w-11 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center hover:bg-white/[0.12] hover:border-white/20 hover:scale-105 transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-xl backdrop-blur-sm"
        >
          <ChevronRight className="h-5 w-5 text-zinc-300" />
        </button>

        {/* Page Viewport */}
        <div
          className={[
            'relative w-full h-full mx-auto overflow-hidden bg-white text-zinc-900 self-center shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_32px_80px_rgba(0,0,0,0.7)]',
            'max-w-none aspect-auto',
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

      {/* ── Redesigned Page-Number Footer Row ── */}
      <footer className="h-[4.5rem] sm:h-20 bg-gradient-to-r from-[#0c0a09] via-[#111009] to-[#0c0a09] border-t border-white/[0.06] px-4 sm:px-6 flex items-center gap-4 sm:gap-5 z-50 shrink-0">

        {/* Prev button */}
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="shrink-0 h-8 px-3 rounded-md bg-white/[0.06] border border-white/[0.1] text-[10px] font-semibold tracking-widest uppercase text-zinc-400 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all disabled:opacity-25 disabled:pointer-events-none"
        >
          ‹ Prev
        </button>

        {/* Scrubber + page dots */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {/* Progress bar */}
          <div className="relative h-[3px] bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #8b1f3f 0%, #8b1f3f 100%)',
                boxShadow: '0 0 8px rgba(139,31,63,0.6)',
              }}
            />
          </div>

          {/* Page number dots */}
          <div className="flex items-center justify-between gap-0.5 overflow-hidden">
            {pages.map((_, i) => {
              const isActive = currentPage === i;
              const isNear = Math.abs(currentPage - i) <= 2;
              return (
                <button
                  key={i}
                  onClick={() => goToPage(i)}
                  title={`Page ${i + 1}`}
                  className="group flex flex-col items-center gap-0.5 transition-all duration-200"
                  style={{ minWidth: 0, flex: '1 1 0' }}
                >
                  <span
                    className={[
                      'block rounded-full transition-all duration-300',
                      isActive
                        ? 'w-4 h-1.5 bg-[#8b1f3f] shadow-[0_0_6px_rgba(139,31,63,0.8)]'
                        : isNear
                        ? 'w-1 h-1 bg-zinc-500 group-hover:bg-zinc-300' :'w-0.5 h-0.5 bg-zinc-700 group-hover:bg-zinc-500',
                    ].join(' ')}
                  />
                  {isActive && (
                    <span className="text-[8px] font-mono font-bold text-[#8b1f3f] leading-none">
                      {i + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Next button */}
        <button
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
          className="shrink-0 h-8 px-3 rounded-md bg-white/[0.06] border border-white/[0.1] text-[10px] font-semibold tracking-widest uppercase text-zinc-400 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all disabled:opacity-25 disabled:pointer-events-none"
        >
          Next ›
        </button>
      </footer>

      {/* ── Sidebar Navigation ── */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-[#0f0d0b] z-[60] border-l border-white/[0.08] shadow-2xl p-8"
          >
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-lg font-serif text-white tracking-wide">Quick Access</h3>
              <button
                onClick={() => setIsNavOpen(false)}
                className="text-zinc-500 hover:text-white h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {pages.map((page, i) => {
                const isActive = currentPage === i;
                return (
                  <button
                    key={page.id}
                    onClick={() => goToPage(i)}
                    className={[
                      'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group',
                      isActive
                        ? 'bg-[#8b1f3f]/10 border border-[#8b1f3f]/20'
                        : 'hover:bg-white/[0.04] border border-transparent',
                    ].join(' ')}
                  >
                    <span className={`text-[10px] font-mono w-6 text-right shrink-0 ${isActive ? 'text-[#8b1f3f]' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`font-medium text-xs uppercase tracking-widest ${isActive ? 'text-[#8b1f3f]' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                      {page.type.replace('-', ' ')}
                    </span>
                    {isActive && (
                      <motion.div layoutId="activeDot" className="h-1 w-1 rounded-full bg-[#8b1f3f] ml-auto" />
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="mt-10 p-5 bg-gradient-to-br from-[#8b1f3f]/20 to-[#8b1f3f]/10 rounded-xl border border-[#8b1f3f]/20">
              <p className="text-[10px] text-[#8b1f3f] uppercase tracking-widest mb-1 font-bold">Latest Edition</p>
              <h4 className="text-base font-serif text-white mb-4">{issue?.title || "Current Issue"}</h4>
              <Link
                href="/membership"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#8b1f3f] text-white font-semibold text-xs rounded-lg hover:bg-[#7a1b36] transition-colors"
              >
                Become a Member
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE RENDERER HELPERS
// ─────────────────────────────────────────────

function SafeText({ html, className }: { html: string; className?: string }) {
  if (!html) return null;

  let content = html;
  if (!html.includes('<')) {
    const normalized = html.replace(/\r\n/g, '\n');
    const lines = normalized.split(/\n+/g).map((l) => l.trim()).filter(Boolean);
    content = lines.map((l) => `<p>${l}</p>`).join('');
  } else if (!html.includes('<p') && !html.includes('<br')) {
    const normalized = html.replace(/\r\n/g, '\n');
    const lines = normalized.split(/\n+/g).map((l) => l.trim()).filter(Boolean);
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
      ].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

function renderTitleArt(text: unknown, emphasisClassName?: string): React.ReactNode {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  const re = /\*([^*]+)\*/g;
  if (!re.test(raw)) return raw;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(raw)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(raw.slice(lastIndex, m.index));
    }
    nodes.push(
      <span key={`ta-${key++}`} className={emphasisClassName || 'font-serif italic text-[#8b1f3f]'}>
        {m[1]}
      </span>
    );
    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < raw.length) {
    nodes.push(raw.slice(lastIndex));
  }

  return <>{nodes}</>;
}

function getHtmlBlocks(html: string): string[] {
  if (!html) return [];
  const hasTags = html.includes('<');
  const normalizedRaw = html.replace(/\r\n/g, '\n');

  if (hasTags && !html.includes('<p') && normalizedRaw.includes('\n')) {
    const lines = normalizedRaw.split(/\n+/g).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) return lines.map((l) => `<p>${l}</p>`);
  }

  if (typeof window !== 'undefined' && hasTags && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const body = doc.body;
      const paragraphs = Array.from(body.querySelectorAll('p'));
      if (paragraphs.length > 0) return paragraphs.map((p) => p.outerHTML.trim()).filter(Boolean);

      const blockTagNames = new Set(['h1','h2','h3','h4','h5','h6','ul','ol','blockquote','pre','figure','hr']);
      const blockChildren = Array.from(body.children).filter((el) => blockTagNames.has(el.tagName.toLowerCase()));
      if (blockChildren.length > 0) return blockChildren.map((el) => el.outerHTML.trim()).filter(Boolean);

      const inner = body.innerHTML.trim();
      if (!inner) return [];
      const parts = inner.split(/(?:<br\s*\/?>\s*){2,}/gi).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) return parts.map((p) => `<p>${p}</p>`);
      return [`<p>${inner}</p>`];
    } catch {}
  }

  const normalized = hasTags ? html : html.replace(/\r\n/g, '\n');
  if (!hasTags) {
    const lines = normalized.split(/\n+/g).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    return lines.map((l) => `<p>${l}</p>`);
  }

  const parts = normalized.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
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
  if (blocks.length <= 1) return { leftBlocks: blocks, rightBlocks: [] };

  const ideal = total / 2;
  const prefixSums: number[] = [];
  let running = 0;
  for (let i = 0; i < weights.length; i += 1) { running += weights[i]; prefixSums[i] = running; }

  let bestIndex = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 1; i < blocks.length; i += 1) {
    const left = prefixSums[i - 1];
    const right = total - left;
    const diff = Math.abs(left - right);
    const balancePenalty = diff / (ideal || 1);
    const minBlocksPenalty = i === 1 || i === blocks.length - 1 ? 0.25 : 0;
    const score = balancePenalty + minBlocksPenalty;
    if (score < bestScore) { bestScore = score; bestIndex = i; }
  }

  return { leftBlocks: blocks.slice(0, bestIndex), rightBlocks: blocks.slice(bestIndex) };
}

function useScrollReveal(ref: React.RefObject<HTMLElement | null>, options?: IntersectionObserverInit) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('revealed'); }); },
      options ?? { threshold: 0.08 }
    );
    root.querySelectorAll('.scroll-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ref, options]);
}

function renderPage(page: any, imageVersion: string) {
  switch (page.type) {
    case 'cover':        return <PageCover data={page.content} imageVersion={imageVersion} />;
    case 'editorial':    return <PageEditorial data={page.content} imageVersion={imageVersion} />;
    case 'contents':     return <PageContents data={page.content} imageVersion={imageVersion} />;
    case 'feature-left': return <PageFeatureLeft data={page.content} imageVersion={imageVersion} />;
    case 'feature-right':return <PageFeatureRight data={page.content} imageVersion={imageVersion} />;
    case 'column':       return <PageColumn data={page.content} imageVersion={imageVersion} />;
    case 'lifestyle':    return <PageLifestyle data={page.content} imageVersion={imageVersion} />;
    case 'spotlight':    return <PageSpotlight data={page.content} imageVersion={imageVersion} />;
    case 'partner':      return <PagePartner data={page.content} imageVersion={imageVersion} />;
    case 'back-cover':   return <PageBackCover data={page.content} imageVersion={imageVersion} />;
    default:             return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Page coming soon…</div>;
  }
}

// ─────────────────────────────────────────────
// COVER PAGE
// ─────────────────────────────────────────────
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
    <div ref={ref} className="relative min-h-full overflow-hidden bg-[#0c0a09]">
      {data.videoUrl ? (
        <video src={data.videoUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${fixMagazineImageUrl(data.image, imageVersion)}')` }}
        />
      )}

      {/* Multi-layer gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[28rem] h-[28rem] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(139,31,63,0.25) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(139,31,63,0.18) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      {/* Grain */}
      <div className="grain-overlay absolute inset-0 z-10" />

      {/* Vertical accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-1 z-20"
        style={{ background: 'linear-gradient(to bottom, transparent, #8b1f3f 30%, #8b1f3f 70%, transparent)' }} />

      <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-10 py-12 lg:py-16 min-h-full flex items-center">
        <div className="max-w-xl">
          {/* Issue badge */}
          <div className="cover-animate opacity-0 mb-7">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 border border-white/15 bg-white/[0.06] backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8b1f3f] inline-block animate-pulse" />
              {dateIssue || 'Digital Edition'}
            </span>
          </div>

          {/* Masthead */}
          <div className="cover-animate opacity-0 mb-7">
            <h1 className="text-hero-display font-serif font-600 text-white leading-none">
              Yorkshire
              <br />
              <span className="cover-gold-shimmer">Business</span>
              <br />
              Woman
            </h1>
          </div>

          {/* Feature callout */}
          {(data.headline || data.subheadline) && (
            <div className="cover-animate opacity-0 mb-7">
              <div className="inline-flex items-start gap-3 bg-white/[0.07] backdrop-blur-md border border-white/15 rounded-xl px-4 py-3.5 max-w-sm">
                <div className="w-0.5 h-12 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(to bottom, #8b1f3f, #8b1f3f)' }} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-1">
                    {data.badge || 'Special Report'}
                  </p>
                  {data.headline && (
                    <p className="text-white font-semibold text-sm leading-snug line-clamp-2">{data.headline}</p>
                  )}
                  {data.subheadline && (
                    <div className="text-white/60 text-xs leading-snug mt-1 [&_p]:m-0 [&_p]:inline">
                      <SafeText html={data.subheadline} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="cover-animate opacity-0 flex items-center gap-3 flex-wrap">
            <Link
              href="/new-edition"
              className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-full text-[#0c0a09] hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #8b1f3f 0%, #7a1b36 100%)' }}
            >
              Browse Archive
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/membership"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/25 text-white/80 font-medium text-sm rounded-full hover:bg-white/[0.08] hover:border-white/40 transition-all"
            >
              Join the Community
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// EDITORIAL PAGE
// ─────────────────────────────────────────────
const PageEditorial = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  const allBlocks = getHtmlBlocks(data.text || '');
  const introHtml = data.intro || (!data.intro && allBlocks.length > 1 ? allBlocks[0] : '');
  const bodyHtml = (introHtml ? allBlocks.slice(1) : allBlocks).join('');
  const signature = String(data.author || '').trim().split(/\s+/g).filter(Boolean)[0] || '';
  const introWithDropcap = introHtml ? addClassToFirstParagraph(introHtml, 'editorial-dropcap') : '';

  return (
    <div ref={ref} className="bg-[#faf7f2] py-16 lg:py-24 min-h-full">
      {/* Warm top accent strip */}
      <div className="h-1 w-full mb-0" style={{ background: 'linear-gradient(90deg, #8b1f3f 0%, #8b1f3f 100%)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
        <div className="scroll-reveal mb-10">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#8b1f3f]/40 to-transparent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b1f3f] whitespace-nowrap px-2">
              Editor&apos;s Note
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#8b1f3f]/40 to-transparent" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4 scroll-reveal scroll-reveal-delay-1">
            <div className="lg:sticky lg:top-32 space-y-5">
              <div className="rounded-2xl overflow-hidden aspect-[3/4] shadow-[0_8px_40px_rgba(139,31,63,0.15)] ring-1 ring-[#8b1f3f]/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.author} className="w-full h-full object-cover" />
              </div>
              <div className="rounded-xl p-5 border border-[#e8d5c0] bg-white shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-1">Editor</p>
                <p className="font-bold text-[#1c1410] text-lg">{data.author}</p>
                <p className="text-sm text-[#7a6e65]">Yorkshire BusinessWoman Magazine</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="scroll-reveal scroll-reveal-delay-2">
              <h2 className="text-feature-xl font-serif font-600 text-[#1c1410] mb-2">{renderTitleArt(data.title, 'font-serif italic text-[#8b1f3f]')}</h2>
            </div>

            {data.quote && (
              <div className="scroll-reveal scroll-reveal-delay-3 border-l-[3px] border-[#8b1f3f] pl-5 py-1">
                <p className="font-serif italic text-[clamp(1.2rem,2.5vw,1.65rem)] leading-[1.4] text-[#8b1f3f]">
                  &ldquo;{data.quote}&rdquo;
                </p>
              </div>
            )}

            <div className="scroll-reveal scroll-reveal-delay-4 space-y-4 text-[#3d2b1f]/80 leading-relaxed">
              {introWithDropcap && <SafeText html={introWithDropcap} />}
              {bodyHtml && <SafeText html={bodyHtml} />}
            </div>

            {signature && (
              <div className="scroll-reveal pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-px bg-[#8b1f3f]" />
                  <p className="font-serif italic text-[#3d2b1f] font-medium text-lg">With warmth and ambition,</p>
                </div>
                <p className="font-bold text-[#8b1f3f] mt-3 text-lg">{signature}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// CONTENTS PAGE
// ─────────────────────────────────────────────
const PageContents = ({ data }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref, { threshold: 0.1 });

  const items = Array.isArray(data.items) ? data.items : [];
  const news = Array.isArray(data.news) ? data.news : [];
  const kicker = String(data.kicker || '').trim();
  const newsLabel = String(data.newsLabel || '').trim();

  return (
    <div ref={ref} className="bg-[#1a1210] py-16 lg:py-24 min-h-full text-white">
      {/* Top accent */}
      <div className="h-0.5 w-full mb-0" style={{ background: 'linear-gradient(90deg, transparent, #8b1f3f 30%, #8b1f3f 70%, transparent)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
        <div className="scroll-reveal mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            {kicker && (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b1f3f] mb-2">{kicker}</p>
            )}
            <h2 className="text-section-lg font-serif font-600 text-white">{renderTitleArt(data.title)}</h2>
          </div>
          <div className="flex items-center gap-5">
            {['Instagram','LinkedIn','X'].map((s) => (
              <span key={s} className="text-zinc-500 hover:text-[#8b1f3f] transition-colors text-xs font-medium cursor-pointer">{s}</span>
            ))}
          </div>
        </div>

        {data.text && (
          <div className="scroll-reveal -mt-6 mb-10 max-w-3xl">
            <SafeText html={data.text} className="text-white/70 leading-relaxed" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {items.map((item: any, i: number) => {
            const pageLabel = String(item?.page ?? '').padStart(3, '0');
            return (
              <div
                key={`${pageLabel}-${item?.title ?? i}`}
                className={`scroll-reveal scroll-reveal-delay-${Math.min(i + 1, 4)} group cursor-pointer rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.04] hover:bg-white/[0.07] hover:border-[#8b1f3f]/30 transition-all duration-300`}
              >
                <div className="p-5 flex flex-col h-full min-h-[130px] relative">
                  {/* Accent corner */}
                  <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden">
                    <div className="absolute top-0 right-0 w-0 h-0"
                      style={{ borderLeft: '48px solid transparent', borderTop: '48px solid rgba(139,31,63,0.08)' }} />
                  </div>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f]">{item?.category}</span>
                    <span className="text-3xl font-extrabold text-white/[0.07] font-serif leading-none group-hover:text-white/[0.12] transition-colors">{pageLabel}</span>
                  </div>
                  <p className="font-serif font-semibold text-white/90 text-base leading-snug flex-1">{item?.title}</p>
                  <div className="mt-3 h-0.5 w-8 rounded-full bg-[#8b1f3f] group-hover:w-14 transition-all duration-300" />
                </div>
              </div>
            );
          })}
        </div>

        {news.length > 0 && (
          <div className="scroll-reveal rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
            {newsLabel && (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-4">{newsLabel}</p>
            )}
            <ul className="space-y-2.5">
              {news.map((item: any, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="text-[#8b1f3f] mt-0.5 flex-shrink-0 text-[10px]">◆</span>
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

// ─────────────────────────────────────────────
// FEATURE LEFT
// ─────────────────────────────────────────────
const PageFeatureLeft = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const stats = Array.isArray(data.stats) ? data.stats : [];
  const kicker = String((data.kicker || data.category) ?? '').trim();

  return (
    <div ref={ref} className="relative flex flex-col lg:flex-row h-full min-h-full overflow-hidden" style={{ background: '#e8e0d5' }}>
      {/* Left: Image Panel — full height, half width on desktop */}
      <div className="relative w-full lg:w-1/2 h-56 sm:h-72 lg:h-full flex-shrink-0 overflow-hidden">
        {data.videoUrl ? (
          <video src={data.videoUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fixMagazineImageUrl(data.image, imageVersion)}
            alt={data.title || data.name || kicker}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Subtle right-edge fade into the warm background */}
        <div className="absolute inset-y-0 right-0 w-16 hidden lg:block" style={{ background: 'linear-gradient(to right, transparent, #e8e0d5)' }} />
        {/* Bottom fade for mobile */}
        <div className="absolute inset-x-0 bottom-0 h-16 lg:hidden" style={{ background: 'linear-gradient(to bottom, transparent, #e8e0d5)' }} />
      </div>

      {/* Right: Content Panel */}
      <div className="relative flex flex-col justify-start flex-1 px-6 sm:px-10 lg:px-12 pt-10 pb-12 lg:pt-12 lg:pb-14 overflow-y-auto">
        {/* Brick-red top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 lg:hidden" style={{ background: '#8b1f3f' }} />
        {/* Brick-red left accent bar (desktop) */}
        <div className="absolute top-0 left-0 bottom-0 w-1 hidden lg:block" style={{ background: 'linear-gradient(to bottom, transparent, #8b1f3f 20%, #8b1f3f 80%, transparent)' }} />

        {/* Category label */}
        <div className="scroll-reveal mb-4 flex items-center gap-3">
          <div className="w-6 h-px" style={{ background: '#8b1f3f' }} />
          {kicker && (
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#8b1f3f' }}>
              {kicker}
            </span>
          )}
        </div>

        {/* Name / tag */}
        {data.name && (
          <p className="scroll-reveal text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#7a5c4e' }}>
            {data.name}
          </p>
        )}

        {/* Title */}
        {(data.title || data.name) && (
          <h2 className="scroll-reveal scroll-reveal-delay-1 font-serif font-bold leading-tight mb-5 text-[#1c1410]"
            style={{ fontSize: 'calc(clamp(1.6rem, 3.5vw, 2.8rem) + 20px)' }}>
            {renderTitleArt(data.title || data.name, 'font-serif italic text-[#8b1f3f]')}
          </h2>
        )}

        {/* Pull quote */}
        {data.quote && (
          <div className="scroll-reveal scroll-reveal-delay-2 mb-5 pl-4 py-1 border-l-[3px]" style={{ borderColor: '#8b1f3f' }}>
            <p className="font-serif italic leading-snug" style={{ color: '#8b1f3f', fontSize: 'clamp(1rem, 2vw, 1.3rem)' }}>
              &ldquo;{data.quote}&rdquo;
            </p>
          </div>
        )}

        {/* Intro / body text */}
        {data.intro && (
          <div className="scroll-reveal scroll-reveal-delay-2 mb-4">
            <SafeText html={data.intro} className="text-sm leading-relaxed text-[#3d2b1f]/80 font-medium [&_p]:mb-2" />
          </div>
        )}

        {data.text && (
          <div className="scroll-reveal scroll-reveal-delay-3 mb-4">
            <SafeText html={data.text} className="text-sm leading-relaxed text-[#3d2b1f]/75 [&_p]:mb-3" />
          </div>
        )}

        {/* Stats row */}
        {stats.length > 0 && (
          <div className="scroll-reveal scroll-reveal-delay-4 grid grid-cols-3 gap-2 mt-2 mb-4">
            {stats.slice(0, 3).map((stat: any, i: number) => (
              <div key={`${stat?.label ?? 'stat'}-${i}`} className="rounded-xl p-3 text-center border" style={{ background: 'rgba(255,255,255,0.55)', borderColor: 'rgba(139,31,63,0.18)' }}>
                <p className="font-serif font-bold text-xl" style={{ color: '#8b1f3f' }}>{stat?.value}</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: '#7a5c4e' }}>{stat?.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Decorative bottom rule */}
        <div className="scroll-reveal mt-8 pt-6 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, #8b1f3f, transparent)' }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#8b1f3f' }}>YBW</span>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// FEATURE RIGHT
// ─────────────────────────────────────────────
const PageFeatureRight = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const stats = Array.isArray(data.stats) ? data.stats : [];
  const kicker = String((data.kicker || data.category) ?? '').trim();
  const nameLabel = String(data.name || '').trim();
  const snapshotLabel = String(data.snapshotLabel || '').trim();

  return (
    <div ref={ref} className="bg-[#f5f0e8] py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal mb-10">
          <div className="flex items-center gap-4 max-w-xs">
            <div className="h-px flex-1 bg-gradient-to-r from-[#8b1f3f]/60 to-transparent" />
            {kicker && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b1f3f] whitespace-nowrap">
                {kicker}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-6 space-y-6 scroll-reveal">
            <div>
              {nameLabel && (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-2">{nameLabel}</p>
              )}
              <h2 className="text-section-lg font-serif font-600 text-[#1c1410]">{renderTitleArt(data.title || data.name, 'font-serif italic text-[#8b1f3f]')}</h2>
            </div>

            {data.quote && (
              <div className="border-l-[3px] border-[#8b1f3f] pl-5 py-1">
                <p className="font-serif italic text-[clamp(1.15rem,2.2vw,1.55rem)] leading-[1.45] text-[#8b1f3f]">
                  &ldquo;{data.quote}&rdquo;
                </p>
              </div>
            )}

            {data.text && <SafeText html={data.text} className="text-[#3d2b1f]/75 leading-relaxed" />}
          </div>

          <div className="lg:col-span-6 scroll-reveal scroll-reveal-delay-2 space-y-4">
            {data.image && (
              <div className="rounded-2xl overflow-hidden aspect-[4/3] shadow-[0_12px_50px_rgba(139,31,63,0.12)] ring-1 ring-[#8b1f3f]/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.title || data.name || 'Feature'} className="w-full h-full object-cover" />
              </div>
            )}

            {stats.length > 0 && (
              <div className="rounded-2xl border border-[#e8d5c0] bg-white shadow-sm p-6">
                {snapshotLabel && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-3">{snapshotLabel}</p>
                )}
                <div className="space-y-2.5">
                  {stats.map((stat: any, i: number) => (
                    <div key={`${stat?.label ?? 'stat'}-${i}`} className="rounded-xl border border-[#f0e8da] bg-[#faf7f2] p-4 flex items-start gap-4">
                      <span className="font-serif font-bold text-[#8b1f3f] text-2xl shrink-0 w-16 text-center">{stat?.value}</span>
                      <p className="text-sm text-[#3d2b1f]/75 leading-relaxed">{stat?.label}</p>
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

// ─────────────────────────────────────────────
// COLUMN PAGE
// ─────────────────────────────────────────────
const PageColumn = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const tips = Array.isArray(data.tips) ? data.tips : [];
  const kicker = String((data.kicker || data.category) ?? '').trim();
  const tipsLabel = String(data.tipsLabel || data.tipsTitle || '').trim();

  return (
    <div ref={ref} className="bg-[#faf7f2] py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal mb-10">
          <div className="flex items-center gap-4 max-w-xs">
            <div className="h-px flex-1 bg-gradient-to-r from-[#8b1f3f]/60 to-transparent" />
            {kicker && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b1f3f] whitespace-nowrap">
                {kicker}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {data.image && (
            <div className="lg:col-span-5 scroll-reveal">
              <div className="rounded-2xl overflow-hidden aspect-[4/5] shadow-[0_12px_50px_rgba(139,31,63,0.12)] ring-1 ring-[#8b1f3f]/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.title || data.category || 'Column'} className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <div className={[data.image ? 'lg:col-span-7' : 'lg:col-span-12', 'space-y-6', data.image ? 'scroll-reveal scroll-reveal-delay-2' : 'scroll-reveal'].join(' ')}>
            <div>
              {kicker && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-2">{kicker}</p>}
              <h2 className="text-section-lg font-serif font-600 text-[#1c1410]">{renderTitleArt(data.title, 'font-serif italic text-[#8b1f3f]')}</h2>
              {data.author && <p className="text-sm text-[#7a6e65] font-medium uppercase tracking-wider mt-1">{data.author}</p>}
            </div>

            {data.text && <SafeText html={data.text} className="text-[#3d2b1f]/75 leading-relaxed" />}

            {tips.length > 0 && (
              <div className="rounded-2xl border border-[#e8d5c0] bg-white shadow-sm p-6">
                {tipsLabel && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-4">{tipsLabel}</p>
                )}
                <ul className="space-y-2.5">
                  {tips.map((tip: any, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#3d2b1f]/75">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 text-white"
                        style={{ background: 'linear-gradient(135deg, #8b1f3f, #8b1f3f)' }}>
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

// ─────────────────────────────────────────────
// LIFESTYLE PAGE
// ─────────────────────────────────────────────
const PageLifestyle = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const title = String(data.title || '').trim();
  const kicker = String(data.kicker || '').trim();
  const highlightsLabel = String(data.highlightsLabel || '').trim();
  const editorsPickLabel = String(data.editorsPickLabel || '').trim();
  const highlights = Array.isArray(data.highlights) ? data.highlights : [];
  const extraImages: string[] = Array.isArray(data.images)
    ? data.images.map((x: any) => String(x || '').trim()).filter(Boolean)
    : [];
  const textPreview = String(data.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <div ref={ref} className="bg-[#faf7f2] py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal mb-10">
          <div className="flex items-center gap-4 max-w-xs">
            <div className="h-px flex-1 bg-gradient-to-r from-[#8b1f3f]/60 to-transparent" />
            {kicker && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b1f3f] whitespace-nowrap">{kicker}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          <div className="md:col-span-2 scroll-reveal">
            <div className="rounded-2xl overflow-hidden aspect-[16/9] relative shadow-[0_12px_50px_rgba(139,31,63,0.12)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={title || kicker} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                {kicker && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-1.5">{kicker}</p>}
                <h3 className="font-serif font-semibold text-white text-2xl">{renderTitleArt(title)}</h3>
              </div>
            </div>
          </div>

          <div className="space-y-4 scroll-reveal scroll-reveal-delay-2">
            <div className="rounded-2xl p-5 border border-[#e8d5c0] bg-white shadow-sm h-full flex flex-col justify-between min-h-[200px]">
              <div>
                {highlightsLabel && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-3">{highlightsLabel}</p>
                )}
                {highlights.length > 0 ? (
                  <ul className="space-y-2">
                    {highlights.slice(0, 6).map((h: any, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#3d2b1f]/75">
                        <span className="text-[#8b1f3f] mt-0.5 text-[10px]">◆</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#7a6e65]">Lifestyle highlights appear here.</p>
                )}
              </div>
              {data.logo && (
                <div className="pt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fixMagazineImageUrl(data.logo, imageVersion)} alt="Logo" className="h-10 w-auto object-contain opacity-80" />
                </div>
              )}
            </div>

            {textPreview && (
              <div className="rounded-2xl p-5 border border-[#e8d5c0] bg-white shadow-sm flex flex-col justify-between min-h-[160px]">
                <div>
                  {editorsPickLabel && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-2">{editorsPickLabel}</p>
                  )}
                  <p className="font-serif font-semibold text-[#1c1410] text-xl leading-snug">{renderTitleArt(title, 'font-serif italic text-[#8b1f3f]')}</p>
                </div>
                <p className="text-sm text-[#7a6e65] mt-3 line-clamp-3">{textPreview}</p>
              </div>
            )}
          </div>
        </div>

        {data.text && (
          <div className="scroll-reveal rounded-2xl border border-[#e8d5c0] bg-white shadow-sm p-6 md:p-10">
            <SafeText html={data.text} className="text-[#3d2b1f]/75 leading-relaxed" />
          </div>
        )}

        {extraImages.length > 0 && (
          <div className="scroll-reveal mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {extraImages.slice(0, 8).map((src: string, i: number) => (
              <div key={`${src}-${i}`} className="rounded-xl overflow-hidden aspect-[4/3] bg-[#f0ebe3] border border-[#e8d5c0] shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fixMagazineImageUrl(src, imageVersion)} alt={`Lifestyle image ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SPOTLIGHT PAGE
// ─────────────────────────────────────────────
const PageSpotlight = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const sectionLabel = String(data.title || '').trim();

  return (
    <div ref={ref} className="bg-[#f5f0e8] py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 scroll-reveal">
            <div className="relative">
              <div className="rounded-2xl overflow-hidden aspect-[4/5] shadow-[0_16px_60px_rgba(139,31,63,0.18)] ring-1 ring-[#8b1f3f]/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.name} className="w-full h-full object-cover" />
              </div>
              {/* Name card overlay */}
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-[#e8d5c0]">
                {sectionLabel && (
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8b1f3f] mb-0.5">{renderTitleArt(sectionLabel, 'font-serif italic text-[#8b1f3f]')}</p>
                )}
                <p className="font-bold text-[#1c1410]">{data.name}</p>
                {data.role && <p className="text-xs text-[#7a6e65]">{data.role}</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6 scroll-reveal scroll-reveal-delay-2">
            <div>
              {sectionLabel && (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-2">{renderTitleArt(sectionLabel, 'font-serif italic text-[#8b1f3f]')}</p>
              )}
              <h2 className="text-section-lg font-serif font-600 text-[#1c1410]">{data.name}</h2>
            </div>

            {data.message && (
              <div className="border-l-[3px] border-[#8b1f3f] pl-5 py-1">
                <SafeText html={data.message} className="font-serif italic text-[clamp(1.15rem,2.2vw,1.55rem)] leading-[1.45] text-[#8b1f3f] [&_p]:m-0" />
              </div>
            )}

            {data.bio && <SafeText html={data.bio} className="text-[#3d2b1f]/75 leading-relaxed text-sm" />}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// PARTNER PAGE
// ─────────────────────────────────────────────
const PagePartner = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);
  const kicker = String(data.kicker || '').trim();

  return (
    <div ref={ref} className="relative py-16 lg:py-24 min-h-full overflow-hidden text-white"
      style={{ background: 'linear-gradient(135deg, #0f0a0d 0%, #1a0d14 40%, #0f0a0d 100%)' }}>

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, #8b1f3f 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(ellipse, #8b1f3f 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      {/* Grain */}
      <div className="grain-overlay absolute inset-0 z-0" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="space-y-6 scroll-reveal">
            <div>
              {kicker && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b1f3f] mb-2">{kicker}</p>}
              <h2 className="text-section-lg font-serif font-600 text-white">{renderTitleArt(data.title || data.brand)}</h2>
              {data.headline && <p className="text-white/65 font-medium mt-1 text-lg">{data.headline}</p>}
            </div>

            {data.text ? (
              <SafeText html={data.text} className="text-white/75 leading-relaxed" />
            ) : (
              data.offer && <p className="text-white/75 leading-relaxed">{data.offer}</p>
            )}

            {data.offer && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-px bg-[#8b1f3f]" />
                <p className="text-white/55 text-sm font-medium">{data.offer}</p>
              </div>
            )}
          </div>

          {data.image && (
            <div className="scroll-reveal scroll-reveal-delay-2">
              <div className="rounded-2xl overflow-hidden aspect-[3/4] shadow-[0_20px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.brand} className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// BACK COVER
// ─────────────────────────────────────────────
const PageBackCover = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const socials = Array.isArray(data.socials) ? data.socials : [];
  const kicker = String(data.kicker || '').trim();
  const comingSoonLabel = String(data.comingSoonLabel || '').trim();

  return (
    <div ref={ref} className="bg-[#faf7f2] py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal mb-10">
          <div className="flex items-center gap-4 max-w-xs">
            <div className="h-px flex-1 bg-gradient-to-r from-[#8b1f3f]/60 to-transparent" />
            {kicker && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b1f3f] whitespace-nowrap">{kicker}</span>
            )}
          </div>
        </div>

        <div className="scroll-reveal rounded-3xl overflow-hidden border border-[#e8d5c0] shadow-[0_16px_60px_rgba(139,31,63,0.1)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <div className="p-10 lg:p-14 flex flex-col justify-center space-y-5 bg-white">
              <div>
                {comingSoonLabel && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b1f3f] mb-2">{comingSoonLabel}</p>
                )}
                <h2 className="text-section-lg font-serif font-600 text-[#1c1410]">{renderTitleArt(data.title, 'font-serif italic text-[#8b1f3f]')}</h2>
                {data.nextIssue && <p className="text-[#7a6e65] font-medium mt-1 text-lg">{data.nextIssue}</p>}
              </div>

              {data.text && <SafeText html={data.text} className="text-[#3d2b1f]/70 leading-relaxed" />}

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/membership"
                  className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-full text-white hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #8b1f3f 0%, #7a1b36 100%)' }}
                >
                  {data.cta}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>

                {socials.length > 0 && (
                  <div className="flex items-center gap-2">
                    {socials.slice(0, 6).map((label: any, i: number) => (
                      <span key={`${label}-${i}`} className="text-[#7a6e65] text-sm font-medium">{label}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {data.image && (
              <div className="overflow-hidden aspect-[4/3] lg:aspect-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fixMagazineImageUrl(data.image, imageVersion)} alt={data.title || data.nextIssue || kicker} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
