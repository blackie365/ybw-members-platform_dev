"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Menu,
  Minimize2,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import type { ReaderEdition } from "@/features/magazine/domain/types";
import {
  getTemplateEntry,
  getTemplateViewModel,
  loadTemplateRenderers,
} from "@/features/magazine/domain/template-registry";

interface MagazineShellProps {
  edition: ReaderEdition;
}

function humanizeTemplate(template: string): string {
  return template
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatEditionDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export default function MagazineShell({ edition }: MagazineShellProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageVersion, setImageVersion] = useState("");
  const [renderersLoaded, setRenderersLoaded] = useState(false);

  useEffect(() => {
    loadTemplateRenderers();
    setRenderersLoaded(true);
    setImageVersion(Date.now().toString());
  }, []);

  const pages = edition.pages;
  const editionDate = formatEditionDate(edition.publishDate);

  const renderedPages = useMemo(() => {
    return pages.map((page) => {
      const entry = getTemplateEntry(page.template);
      const viewModel = getTemplateViewModel(page, {
        title: edition.title,
        publishDate: edition.publishDate,
        coverImage: edition.coverImage,
        description: edition.description,
      });
      const label =
        String(viewModel.title || "") || humanizeTemplate(page.template);
      return { page, entry, viewModel, label };
    });
  }, [pages, edition]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextPage();
      if (e.key === "ArrowLeft") prevPage();
      if (e.key === "Escape") setIsNavOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPage, prevPage]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const anyDoc = document as any;
      setIsFullscreen(
        Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement),
      );
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener(
      "webkitfullscreenchange",
      handleFullscreenChange as any,
    );
    handleFullscreenChange();
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange as any,
      );
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const root = document.getElementById("magazine-shell-root");
    const anyDoc = document as any;
    const anyRoot = root as any;
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
  const progress =
    renderedPages.length > 0
      ? ((currentPage + 1) / renderedPages.length) * 100
      : 0;

  const variants: any = {
    enter: (dir: number) => ({
      x: dir > 0 ? 36 : -36,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 240, damping: 30 },
        opacity: { duration: 0.28 },
      },
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 36 : -36,
      opacity: 0,
      transition: {
        x: { duration: 0.22, ease: "easeOut" },
        opacity: { duration: 0.18 },
      },
    }),
  };

  if (!renderersLoaded) return null;

  return (
    <div
      id="magazine-shell-root"
      className="magazine-rocket-theme fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-[#0c0a09] text-zinc-100 overscroll-none selection:bg-accent/30"
    >
      <header className="z-50 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 px-4 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:h-16 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/new-edition"
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Link>
          <div className="mx-1 h-5 w-px bg-white/10 sm:mx-2" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-6 sm:h-8 brightness-0 invert opacity-90" />
            <span className="text-white/20 hidden sm:block">|</span>
            <div className="min-w-0">
              <p className="max-w-[150px] truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a3413a] sm:max-w-[340px] sm:text-xs">
                {edition.title}
              </p>
              <p className="hidden text-[11px] text-zinc-500 sm:block">
                {editionDate}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1 text-[10px] font-mono text-zinc-400 sm:flex">
            <span className="text-white font-semibold">{currentPage + 1}</span>
            <span className="text-zinc-600">/</span>
            <span>{renderedPages.length}</span>
          </div>
          <div className="mx-1 h-5 w-px bg-white/10 sm:mx-2" />

          <Badge className="hidden sm:flex border-none bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
            Digital Edition
          </Badge>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-white sm:h-9 sm:w-9"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          <button
            className="text-zinc-500 hover:text-white h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0c0a09] px-2 py-2 sm:px-3 sm:py-3 lg:px-5 lg:py-5">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[60vw] h-[60vh] rounded-full bg-[#a3413a]/8 blur-[120px]" />
        </div>

        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-4 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 shadow-xl backdrop-blur transition hover:bg-black/50 disabled:pointer-events-none disabled:opacity-25 lg:flex xl:left-8"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5 text-zinc-300" />
        </button>

        <button
          onClick={nextPage}
          disabled={currentPage === renderedPages.length - 1}
          className="absolute right-4 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 shadow-xl backdrop-blur transition hover:bg-black/50 disabled:pointer-events-none disabled:opacity-25 lg:flex xl:right-8"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5 text-zinc-300" />
        </button>

        <div className="relative mx-auto flex h-full w-full max-w-[1720px] overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#120f0d] text-zinc-900 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_40px_120px_rgba(0,0,0,0.55)]">
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
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                const swipe = info.offset.x;
                const swipeY = info.offset.y;
                const velocity = info.velocity.x;
                if (Math.abs(swipeY) > Math.abs(swipe) * 1.5) return;
                if (swipe > 120 || velocity > 650) prevPage();
                else if (swipe < -120 || velocity < -650) nextPage();
              }}
              className="absolute inset-0 h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth touch-pan-y will-change-transform"
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
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#a3413a]">
                      Page {current.page.position}
                    </p>
                    <h2 className="mt-4 font-serif text-3xl">
                      {current.label}
                    </h2>
                  </div>
                </section>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="z-50 shrink-0 border-t border-white/[0.06] bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 px-3 py-3 backdrop-blur-xl sm:px-6">
        <div className="mb-3 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-[#a3413a] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className="inline-flex min-w-[92px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/[0.07] disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a3413a]">
              {current?.label || edition.title}
            </p>
            <p className="mt-1 truncate text-[11px] text-zinc-500">
              {editionDate}
            </p>
          </div>

          <button
            onClick={nextPage}
            disabled={currentPage === renderedPages.length - 1}
            className="inline-flex min-w-[92px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/[0.07] disabled:pointer-events-none disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 hidden items-center justify-center gap-2 overflow-x-auto sm:flex">
          {renderedPages.map((item, i) => {
            const isActive = currentPage === i;
            return (
              <button
                key={item.page.id}
                onClick={() => goToPage(i)}
                className={[
                  "rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors whitespace-nowrap",
                  isActive
                    ? "border-[#a3413a]/40 bg-[#a3413a]/12 text-[#d98f87]"
                    : "border-white/10 bg-white/[0.03] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200",
                ].join(" ")}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </footer>

      <AnimatePresence>
        {isNavOpen && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 right-0 top-0 z-[60] w-full overflow-y-auto border-l border-white/[0.08] bg-[#0f0d0b] p-8 shadow-2xl sm:w-[26rem]"
          >
            <div className="mb-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#a3413a]">
                  Page Navigator
                </p>
                <h3 className="mt-2 text-lg font-serif text-white tracking-wide">
                  {edition.title}
                </h3>
                <p className="mt-2 text-xs text-zinc-500">{editionDate}</p>
              </div>
              <button
                onClick={() => setIsNavOpen(false)}
                className="text-zinc-500 hover:text-white h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1.5">
              {renderedPages.map((item, i) => {
                const isActive = currentPage === i;
                return (
                  <button
                    key={item.page.id}
                    onClick={() => goToPage(i)}
                    className={[
                      "group flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all",
                      isActive
                        ? "bg-[#a3413a]/10 border border-[#a3413a]/20"
                        : "hover:bg-white/[0.04] border border-transparent",
                    ].join(" ")}
                  >
                    <span
                      className={`w-6 shrink-0 text-right font-mono text-[10px] ${isActive ? "text-[#a3413a]" : "text-zinc-600 group-hover:text-zinc-400"}`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-xs font-medium uppercase tracking-widest ${isActive ? "text-[#a3413a]" : "text-zinc-300 group-hover:text-zinc-100"}`}
                      >
                        {item.label}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                        {humanizeTemplate(item.page.template)}
                      </p>
                    </div>
                    {isActive ? (
                      <motion.div
                        layoutId="activeDot"
                        className="ml-auto mt-1 h-1.5 w-1.5 rounded-full bg-[#a3413a]"
                      />
                    ) : null}
                  </button>
                );
              })}
            </nav>

            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] text-[#a3413a] uppercase tracking-widest mb-1 font-bold">
                Digital Edition
              </p>
              <h4 className="text-base font-serif text-white mb-4">
                {edition.title}
              </h4>
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                A screen-native reading experience styled for the web, with the
                page-turning version available separately where needed.
              </p>
              <Link
                href="/new-edition"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#a3413a] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#a3413a]/90"
              >
                Back To Editions
              </Link>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-xs text-center uppercase tracking-[0.22em] text-white/30">
              Use swipe or ← → keys to move through the edition
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
