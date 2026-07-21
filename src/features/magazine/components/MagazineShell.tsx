'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Maximize2, Menu, Minimize2, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ReaderEdition, ReaderPage } from '@/features/magazine/domain/types';
import { getTemplateEntry, getTemplateViewModel, loadTemplateRenderers, type TemplateRenderProps } from '@/features/magazine/domain/template-registry';

interface MagazineShellProps {
  edition: ReaderEdition;
}

function humanizeTemplate(template: string): string {
  return template.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function MagazineShell({ edition }: MagazineShellProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageVersion, setImageVersion] = useState('');
  const [renderersLoaded, setRenderersLoaded] = useState(false);

  useEffect(() => {
    loadTemplateRenderers();
    setRenderersLoaded(true);
    setImageVersion(Date.now().toString());
  }, []);

  const pages = edition.pages;

  const renderedPages = useMemo(() => {
    return pages.map((page) => {
      const entry = getTemplateEntry(page.template);
      const viewModel = getTemplateViewModel(page, {
        title: edition.title,
        publishDate: edition.publishDate,
        coverImage: edition.coverImage,
        description: edition.description,
      });
      const label = String(viewModel.title || '') || humanizeTemplate(page.template);
      return { page, entry, viewModel, label };
    });
  }, [pages, edition]);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => {
      if (prev >= renderedPages.length - 1) return prev;
      setDirection(1);
      return prev + 1;
    });
  }, [renderedPages.length]);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => {
      if (prev <= 0) return prev;
      setDirection(-1);
      return prev - 1;
    });
  }, []);

  const goToPage = useCallback((index: number) => {
    setCurrentPage(prev => {
      setDirection(index > prev ? 1 : -1);
      return index;
    });
    setIsNavOpen(false);
  }, []);

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

  if (!renderersLoaded) return null;

  return (
    <div
      id="magazine-shell-root"
      className="magazine-rocket-theme fixed inset-0 h-[100dvh] bg-[#0c0a09] text-zinc-100 flex flex-col z-[100] overflow-hidden perspective-1000 overscroll-none selection:bg-accent/30"
    >
      {/* Top Control Bar */}
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
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-zinc-400">
            <span className="text-white font-semibold">{currentPage + 1}</span>
            <span className="text-zinc-600">/</span>
            <span>{renderedPages.length}</span>
          </div>
          <div className="h-5 w-px bg-white/10 mx-1 sm:mx-2" />

          <Badge className="hidden sm:flex border-none bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
            Digital Edition
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

      {/* Main Reader Stage */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden touch-pan-y bg-[#0c0a09]">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[60vw] h-[60vh] rounded-full bg-[#a3413a]/8 blur-[120px]" />
        </div>

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
              {current?.entry && current.entry.render ? (
                <current.entry.render
                  edition={{
                    title: edition.title,
                    publishDate: edition.publishDate,
                    coverImage: edition.coverImage,
                    description: edition.description,
                  }}
                  page={current.page}
                  viewModel={current.viewModel}
                  imageVersion={imageVersion}
                />
              ) : current ? (
                <section className="mx-auto max-w-6xl px-6 py-16">
                  <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#a3413a]">Page {current.page.position}</p>
                    <h2 className="mt-4 font-serif text-3xl">{current.label}</h2>
                  </div>
                </section>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Progress Bar + Dot Nav */}
      <footer className="h-[4.5rem] sm:h-20 bg-gradient-to-r from-[#0c0a09] via-[#111009] to-[#0c0a09] border-t border-white/[0.06] px-4 sm:px-6 flex items-center gap-4 sm:gap-5 z-50 shrink-0">
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="shrink-0 h-8 px-3 rounded-md bg-white/[0.06] border border-white/[0.1] text-[10px] font-semibold tracking-widest uppercase text-zinc-400 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all disabled:opacity-25 disabled:pointer-events-none"
        >
          ‹ Prev
        </button>

        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
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

        <button
          onClick={nextPage}
          disabled={currentPage === renderedPages.length - 1}
          className="shrink-0 h-8 px-3 rounded-md bg-white/[0.06] border border-white/[0.1] text-[10px] font-semibold tracking-widest uppercase text-zinc-400 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all disabled:opacity-25 disabled:pointer-events-none"
        >
          Next ›
        </button>
      </footer>

      {/* Sidebar Navigation */}
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
                    <span className={`text-xs min-w-0 flex-1 truncate font-medium uppercase tracking-widest ${isActive ? 'text-[#a3413a]' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
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
              <p className="text-[10px] text-[#a3413a] uppercase tracking-widest mb-1 font-bold">Digital Edition</p>
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
