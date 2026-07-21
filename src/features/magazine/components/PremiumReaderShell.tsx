'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Maximize2, Menu, Minimize2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTemplateRegistryEntry } from '@/features/magazine/domain/template-registry';
import type { Edition, FlatplanPage, MagazineAsset, Slot, Story } from '@/features/magazine/domain/types';

type PremiumReaderPage = FlatplanPage & {
  slots: Slot[];
};

interface PremiumReaderShellProps {
  edition: Edition;
  pages: PremiumReaderPage[];
  stories: Story[];
  assets: MagazineAsset[];
  latestPreview?: {
    href: string;
    title: string;
  } | null;
}

function humanizeIntent(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatSpreadLabel(page: FlatplanPage) {
  if (!page.spreadPagePositions || page.spreadPagePositions.length <= 1) {
    return `Page ${String(page.position).padStart(2, '0')}`;
  }

  const [first, last] = page.spreadPagePositions;
  return `Spread ${String(first).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export default function PremiumReaderShell({ edition, pages, stories, assets, latestPreview }: PremiumReaderShellProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const renderedPages = useMemo(
    () =>
      pages.map((page) => {
        const entry = getTemplateRegistryEntry(page.templateFamily, page.templateVariant);
        const viewModel = entry
          ? entry.buildViewModel({
              edition,
              page,
              slots: page.slots,
              stories,
              assets,
            })
          : null;
        const label =
          (typeof viewModel?.title === 'string' && viewModel.title) ||
          (typeof viewModel?.closingTitle === 'string' && viewModel.closingTitle) ||
          (typeof viewModel?.highlightTitle === 'string' && viewModel.highlightTitle) ||
          humanizeIntent(page.intent);

        return {
          page,
          entry,
          viewModel,
          label,
        };
      }),
    [assets, edition, pages, stories],
  );

  const nextPage = useCallback(() => {
    setCurrentPage((previous) => {
      if (previous >= renderedPages.length - 1) return previous;
      setDirection(1);
      return previous + 1;
    });
  }, [renderedPages.length]);

  const previousPage = useCallback(() => {
    setCurrentPage((previous) => {
      if (previous <= 0) return previous;
      setDirection(-1);
      return previous - 1;
    });
  }, []);

  const goToPage = useCallback(
    (index: number) => {
      setDirection(index > currentPage ? 1 : -1);
      setCurrentPage(index);
      setIsNavOpen(false);
    },
    [currentPage],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') nextPage();
      if (event.key === 'ArrowLeft') previousPage();
      if (event.key === 'Escape') setIsNavOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, previousPage]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const anyDoc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const root = document.getElementById('premium-reader-shell');
    const anyDoc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element | null;
    };
    const anyRoot = root as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };

    try {
      if (!(document.fullscreenElement || anyDoc.webkitFullscreenElement)) {
        if (root?.requestFullscreen) {
          await root.requestFullscreen();
          return;
        }
        if (anyRoot?.webkitRequestFullscreen) {
          await anyRoot.webkitRequestFullscreen();
        }
        return;
      }

      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return;
      }

      if (anyDoc.webkitExitFullscreen) {
        await anyDoc.webkitExitFullscreen();
      }
    } catch {
      return;
    }
  }, []);

  const current = renderedPages[currentPage];
  const progress = renderedPages.length > 0 ? ((currentPage + 1) / renderedPages.length) * 100 : 0;
  const currentSpreadLabel = current ? formatSpreadLabel(current.page) : 'Page';

  return (
    <div
      id="premium-reader-shell"
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-[#0c0a09] text-zinc-100 selection:bg-accent/30"
    >
      <header className="z-50 border-b border-white/[0.06] bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/new-edition" className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white">
              <X className="h-5 w-5" />
            </Link>
            <div className="hidden h-6 w-px bg-white/10 md:block" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Premium Digital Reader</p>
              <h1 className="font-serif text-lg text-white sm:text-xl">{edition.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {edition.issuu.shareUrl ? (
              <Button
                asChild
                variant="outline"
                className="hidden rounded-none border-white/15 bg-transparent text-white hover:bg-white hover:text-[#050505] sm:inline-flex"
              >
                <a href={edition.issuu.shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Issuu
                </a>
              </Button>
            ) : null}
            <Badge className="border-none bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
              {edition.isLive ? 'Live In Premium Reader' : 'Preview'}
            </Badge>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsNavOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {latestPreview ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Latest Available Preview</p>
              <p className="mt-1 text-sm text-white/70">
                The newest assembled reader is currently <span className="font-medium text-white">{latestPreview.title}</span>.
              </p>
            </div>
            <Button asChild className="rounded-none bg-white text-[#050505] hover:bg-accent hover:text-white">
              <Link href={latestPreview.href}>
                Open Latest Preview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0c0a09]">
        <div className="grain-overlay absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[60vh] w-[60vw] rounded-full bg-[#a3413a]/10 blur-[120px]" />
        </div>
        <div className="pointer-events-none absolute inset-y-12 left-6 hidden w-px bg-gradient-to-b from-transparent via-[#a3413a] to-transparent xl:block" />
        <div className="pointer-events-none absolute inset-y-12 right-6 hidden w-px bg-gradient-to-b from-transparent via-[#c9956a] to-transparent xl:block" />

        <button
          type="button"
          onClick={previousPage}
          disabled={currentPage === 0}
          className="absolute left-4 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] shadow-xl backdrop-blur-sm transition-all hover:scale-105 hover:border-white/20 hover:bg-white/[0.12] disabled:pointer-events-none disabled:opacity-0 lg:flex"
        >
          <ChevronLeft className="h-5 w-5 text-zinc-300" />
        </button>

        <button
          type="button"
          onClick={nextPage}
          disabled={currentPage >= renderedPages.length - 1}
          className="absolute right-4 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] shadow-xl backdrop-blur-sm transition-all hover:scale-105 hover:border-white/20 hover:bg-white/[0.12] disabled:pointer-events-none disabled:opacity-0 lg:flex"
        >
          <ChevronRight className="h-5 w-5 text-zinc-300" />
        </button>

        <div className="relative mx-auto h-full w-full overflow-hidden bg-white text-zinc-900 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_32px_80px_rgba(0,0,0,0.7)] lg:h-[calc(100%-2.5rem)] lg:w-[calc(100%-3rem)] lg:rounded-[1.75rem] lg:border lg:border-white/[0.08]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={current?.page.id ?? 'empty'}
              custom={direction}
              initial={{ x: direction > 0 ? '100%' : '-100%', opacity: 0, scale: 0.96 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: direction < 0 ? '100%' : '-100%', opacity: 0, scale: 1.02 }}
              transition={{
                x: { type: 'spring', stiffness: 260, damping: 28 },
                opacity: { duration: 0.2 },
              }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.45}
              onDragEnd={(_, info) => {
                const swipe = info.offset.x;
                const swipeY = info.offset.y;
                const velocity = info.velocity.x;
                if (Math.abs(swipeY) > Math.abs(swipe) * 1.5) return;
                if (swipe > 100 || velocity > 500) previousPage();
                if (swipe < -100 || velocity < -500) nextPage();
              }}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y"
            >
              {current?.entry && current.viewModel ? (
                <current.entry.render edition={edition} page={current.page} viewModel={current.viewModel} />
              ) : current ? (
                <section className="mx-auto max-w-6xl px-6 py-16">
                  <div className="rounded-3xl border border-dashed border-white/15 bg-[#050505] p-8 text-center text-white">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Missing Template</p>
                    <h2 className="mt-4 font-serif text-3xl">Page {current.page.position}</h2>
                    <p className="mt-4 text-white/60">
                      `{current.page.templateFamily}/{current.page.templateVariant}` does not have a public renderer yet.
                    </p>
                  </div>
                </section>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="z-50 border-t border-white/[0.06] bg-gradient-to-r from-[#0c0a09] via-[#111009] to-[#0c0a09] px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={previousPage}
            disabled={currentPage === 0}
            className="inline-flex h-10 items-center gap-2 border border-white/10 px-4 text-xs uppercase tracking-[0.22em] text-white/80 transition hover:border-white/25 hover:bg-white/5 disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.24em] text-white/45">
              <span>{current?.label ?? 'Page'}</span>
              <span>
                {currentSpreadLabel} · {currentPage + 1} / {renderedPages.length}
              </span>
            </div>
            <div className="mt-2 h-[2px] overflow-hidden bg-white/10">
              <div className="h-full bg-[#C9956A] transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <button
            type="button"
            onClick={nextPage}
            disabled={currentPage >= renderedPages.length - 1}
            className="inline-flex h-10 items-center gap-2 border border-white/10 px-4 text-xs uppercase tracking-[0.22em] text-white/80 transition hover:border-white/25 hover:bg-white/5 disabled:pointer-events-none disabled:opacity-35"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {isNavOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNavOpen(false)}
              className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              className="absolute right-0 top-0 z-[80] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#11100e]/95 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">Page Navigator</p>
                  <h2 className="mt-2 font-serif text-2xl text-white">{edition.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNavOpen(false)}
                  className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 flex-1 overflow-y-auto">
                <div className="space-y-2">
                  {renderedPages.map((item, index) => (
                    <button
                      key={item.page.id}
                      type="button"
                      onClick={() => goToPage(index)}
                      className={`w-full border px-4 py-4 text-left transition ${
                        index === currentPage
                          ? 'border-[#C9956A]/60 bg-[#C9956A]/10 text-white'
                          : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[#C9956A]">
                            {formatSpreadLabel(item.page)} · {humanizeIntent(item.page.intent)}
                          </p>
                          <p className="mt-2 truncate font-serif text-lg">{item.label}</p>
                        </div>
                        {index === currentPage ? <ArrowRight className="h-4 w-4 shrink-0" /> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4 text-xs uppercase tracking-[0.22em] text-white/40">
                Swipe, scroll, or use the keyboard arrows to move through the edition.
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
