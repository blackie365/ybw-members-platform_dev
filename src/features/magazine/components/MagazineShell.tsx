'use client';

/**
 * MagazineShell — the Gen 1 navigation chrome lifted into the V2 reader.
 *
 * Provides: full-screen dark container · Framer Motion slide/rotateY page
 * transitions · swipe/drag on mobile · keyboard arrow nav · footer progress
 * scrubber + dot nav · fullscreen API · sidebar quick-access nav.
 *
 * Each page is rendered by its TemplateRegistryEntry, which delegates to the
 * Gen 1 page components in shared.tsx for maximum visual quality.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Maximize2, Menu, Minimize2, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTemplateRegistryEntry } from '@/features/magazine/domain/template-registry';
import type { Edition, FlatplanPage, MagazineAsset, Slot, Story } from '@/features/magazine/domain/types';

type PremiumReaderPage = FlatplanPage & { slots: Slot[] };

interface MagazineShellProps {
  edition: Edition;
  pages: PremiumReaderPage[];
  stories: Story[];
  assets: MagazineAsset[];
  latestPreview?: { href: string; title: string } | null;
}

function humanizeIntent(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatSpreadLabel(page: FlatplanPage) {
  if (!page.spreadPagePositions || page.spreadPagePositions.length <= 1) {
    return `Page ${String(page.position).padStart(2, '0')}`;
  }
  const [first, last] = page.spreadPagePositions;
  return `Spread ${String(first).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export default function MagazineShell({ edition, pages, stories, assets, latestPreview }: MagazineShellProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageVersion, setImageVersion] = useState('');

  // Generate image cache-buster once on mount (same pattern as Gen 1 MagazineReader)
  useEffect(() => {
    setImageVersion(Date.now().toString());
  }, []);

  // Build view models for all pages via the template registry
  const renderedPages = useMemo(
    () =>
      pages.map((page) => {
        const entry = getTemplateRegistryEntry(page.templateFamily, page.templateVariant);
        const viewModel = entry
          ? entry.buildViewModel({ edition, page, slots: page.slots, stories, assets })
          : {};
        const label =
          (typeof viewModel?.title === 'string' && viewModel.title) ||
          (typeof viewModel?.headline === 'string' && viewModel.headline) ||
          humanizeIntent(page.intent);

        return { page, entry, viewModel, label };
      }),
    [assets, edition, pages, stories],
  );

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev >= renderedPages.length - 1) return prev;
      setDirection(1);
      return prev + 1;
    });
  }, [renderedPages.length]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev <= 0) return prev;
      setDirection(-1);
      return prev - 1;
    });
  }, []);

  const goToPage = useCallback((index: number) => {
    setCurrentPage((prev) => {
      setDirection(index > prev ? 1 : -1);
      return index;
    });
    setIsNavOpen(false);
  }, []);

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

  // Fullscreen state sync
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
    const root = document.getElementById('magazine-shell-root');
    const anyDoc = document as any;
    const anyRoot = root as any;
    try {
      if (!(document.fullscreenElement || anyDoc.webkitFullscreenElement)) {
        if (root?.requestFullscreen) { await root.requestFullscreen(); return; }
        if (anyRoot?.webkitRequestFullscreen) { await anyRoot.webkitRequestFullscreen(); }
        return;
      }
      if (document.exitFullscreen) { await document.exitFullscreen(); return; }
      if (anyDoc.webkitExitFullscreen) { await anyDoc.webkitExitFullscreen(); }
    } catch { return; }
  }, []);

  const current = renderedPages[currentPage];
  const progress = renderedPages.length > 0 ? ((currentPage + 1) / renderedPages.length) * 100 : 0;
  const currentSpreadLabel = current ? formatSpreadLabel(current.page) : 'Page';

  // Gen 1 page-flip variants (dark to match the brand)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variants: any = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.9,
      rotateY: dir > 0 ? 45 : -45,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        x: { type: 'spring', stiffness: 200, damping: 30 },
        opacity: { duration: 0.4 },
        rotateY: { duration: 0.6, ease: 'easeOut' },
      },
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1.1,
      rotateY: dir < 0 ? 45 : -45,
      transition: {
        x: { type: 'spring', stiffness: 200, damping: 30 },
        opacity: { duration: 0.4 },
        rotateY: { duration: 0.6, ease: 'easeIn' },
      },
    }),
  };

  return (
    <div
      id="magazine-shell-root"
      className="magazine-rocket-theme fixed inset-0 h-[100dvh] bg-[#0c0a09] text-zinc-100 flex flex-col z-[100] overflow-hidden perspective-1000 overscroll-none selection:bg-accent/30"
    >
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
            <p className="text-[10px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-[#a3413a] truncate max-w-[100px] sm:max-w-none">
              {edition.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Page counter pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-zinc-400">
            <span className="text-white font-semibold">{currentPage + 1}</span>
            <span className="text-zinc-600">/</span>
            <span>{renderedPages.length}</span>
          </div>
          <div className="h-5 w-px bg-white/10 mx-1 sm:mx-2" />

          {/* Issuu link if available */}
          {edition.issuu?.shareUrl ? (
            <a
              href={edition.issuu.shareUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex text-zinc-500 hover:text-white h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md hover:bg-white/5 transition-colors"
              title="Open on Issuu"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}

          {/* Live / Preview badge */}
          <Badge className="hidden sm:flex border-none bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
            {edition.isLive ? 'Live' : 'Preview'}
          </Badge>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-zinc-500 hover:text-white h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button
            className="text-zinc-500 hover:text-white h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Latest preview banner */}
      {latestPreview ? (
        <div className="flex flex-col gap-3 border-b border-white/10 bg-[#0c0a09] px-4 py-3 lg:flex-row lg:items-center lg:justify-between sm:px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Latest Available Preview</p>
            <p className="mt-1 text-sm text-white/70">
              The newest assembled reader is <span className="font-medium text-white">{latestPreview.title}</span>.
            </p>
          </div>
          <Button asChild className="rounded-none bg-white text-[#050505] hover:bg-accent hover:text-white shrink-0">
            <Link href={latestPreview.href}>
              Open Latest Preview
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      {/* ── Main Reader Stage ── */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden touch-pan-y bg-[#0c0a09]">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[60vw] h-[60vh] rounded-full bg-[#a3413a]/8 blur-[120px]" />
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
          disabled={currentPage === renderedPages.length - 1}
          className="absolute right-4 xl:right-8 z-40 h-11 w-11 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center hover:bg-white/[0.12] hover:border-white/20 hover:scale-105 transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-xl backdrop-blur-sm"
        >
          <ChevronRight className="h-5 w-5 text-zinc-300" />
        </button>

        {/* Page Viewport */}
        <div className="relative w-full h-full mx-auto overflow-hidden bg-white text-zinc-900 self-center shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_32px_80px_rgba(0,0,0,0.7)]">
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
              className="absolute inset-0 w-full h-full will-change-transform touch-pan-y overflow-y-auto overflow-x-hidden scroll-smooth overscroll-contain"
            >
              {current?.entry && current.viewModel ? (
                <current.entry.render
                  edition={edition}
                  page={current.page}
                  viewModel={current.viewModel}
                  imageVersion={imageVersion}
                />
              ) : current ? (
                <section className="mx-auto max-w-6xl px-6 py-16">
                  <div className="rounded-3xl border border-dashed border-white/15 bg-[#050505] p-8 text-center text-white">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Missing Template</p>
                    <h2 className="mt-4 font-serif text-3xl">Page {current.page.position}</h2>
                    <p className="mt-4 text-white/60">
                      `{current.page.templateFamily}/{current.page.templateVariant}` has no renderer yet.
                    </p>
                  </div>
                </section>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Footer Progress Bar + Dot Nav ── */}
      <footer className="h-[4.5rem] sm:h-20 bg-gradient-to-r from-[#0c0a09] via-[#111009] to-[#0c0a09] border-t border-white/[0.06] px-4 sm:px-6 flex items-center gap-4 sm:gap-5 z-50 shrink-0">

        {/* Prev button */}
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="shrink-0 h-8 px-3 rounded-md bg-white/[0.06] border border-white/[0.1] text-[10px] font-semibold tracking-widest uppercase text-zinc-400 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all disabled:opacity-25 disabled:pointer-events-none"
        >
          ‹ Prev
        </button>

        {/* Scrubber + dots */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {/* Progress bar */}
          <div className="relative h-[3px] bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #a3413a 0%, #a3413a 100%)',
                boxShadow: '0 0 8px rgba(163,65,58,0.6)',
              }}
            />
          </div>

          {/* Page dots */}
          <div className="flex items-center justify-between gap-0.5 overflow-hidden">
            {renderedPages.map((_, i) => {
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
                        ? 'w-4 h-1.5 bg-[#a3413a] shadow-[0_0_6px_rgba(163,65,58,0.8)]'
                        : isNear
                        ? 'w-1 h-1 bg-zinc-500 group-hover:bg-zinc-300'
                        : 'w-0.5 h-0.5 bg-zinc-700 group-hover:bg-zinc-500',
                    ].join(' ')}
                  />
                  {isActive && (
                    <span className="text-[8px] font-mono font-bold text-[#a3413a] leading-none">
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
          disabled={currentPage === renderedPages.length - 1}
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
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-[#0f0d0b] z-[60] border-l border-white/[0.08] shadow-2xl p-8 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#a3413a]">Page Navigator</p>
                <h3 className="mt-2 text-lg font-serif text-white tracking-wide">{edition.title}</h3>
              </div>
              <button
                onClick={() => setIsNavOpen(false)}
                className="text-zinc-500 hover:text-white h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1">
              {renderedPages.map((item, i) => {
                const isActive = currentPage === i;
                return (
                  <button
                    key={item.page.id}
                    onClick={() => goToPage(i)}
                    className={[
                      'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group',
                      isActive
                        ? 'bg-[#a3413a]/10 border border-[#a3413a]/20'
                        : 'hover:bg-white/[0.04] border border-transparent',
                    ].join(' ')}
                  >
                    <span className={`text-[10px] font-mono w-6 text-right shrink-0 ${isActive ? 'text-[#a3413a]' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`font-medium text-xs uppercase tracking-widest min-w-0 flex-1 truncate ${isActive ? 'text-[#a3413a]' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div layoutId="activeDot" className="h-1 w-1 rounded-full bg-[#a3413a] ml-auto" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-10 p-5 bg-gradient-to-br from-[#a3413a]/20 to-[#a3413a]/10 rounded-xl border border-[#a3413a]/20">
              <p className="text-[10px] text-[#a3413a] uppercase tracking-widest mb-1 font-bold">
                {edition.isLive ? 'Current Edition' : 'Preview Copy'}
              </p>
              <h4 className="text-base font-serif text-white mb-4">{edition.title}</h4>
              <Link
                href="/membership"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#a3413a] text-white font-semibold text-xs rounded-lg hover:bg-[#a3413a]/90 transition-colors"
              >
                Become a Member
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-xs text-center uppercase tracking-[0.22em] text-white/30">
              Swipe or use ← → keys to navigate
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
