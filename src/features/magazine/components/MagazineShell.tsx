"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import type { ReaderEdition, ReaderPage } from "@/features/magazine/domain/types";
import {
  getTemplateEntry,
  getTemplateViewModel,
  loadTemplateRenderers,
} from "@/features/magazine/domain/template-registry";

interface MagazineShellProps {
  edition: ReaderEdition;
  editionSlug?: string;
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

function extractPrintPageNumber(page: ReaderPage | null | undefined): number | null {
  if (!page) return null;
  if (typeof (page as any).pageNumber === 'number' && Number.isFinite((page as any).pageNumber)) {
    return (page as any).pageNumber;
  }
  if (typeof page.position === 'number' && Number.isFinite(page.position) && page.position > 0) {
    return page.position;
  }
  const idStr = String(page.id || '');
  const m = idStr.match(/^page[-_](\d+)[-_]/);
  if (m) return Number(m[1]);
  return null;
}

function findRenderedIndexByPrintPageNumber(
  entries: Array<{ page: ReaderPage }>,
  pageNum: number,
): number {
  const byNumber = entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        Number(entry.page.position) === pageNum ||
        Number((entry.page as any).pageNumber) === pageNum,
    );
  if (byNumber.length > 0) return byNumber[0].index;
  const fallback = pageNum - 1;
  if (fallback >= 0 && fallback < entries.length) return fallback;
  return -1;
}

export default function MagazineShell({ edition, editionSlug }: MagazineShellProps) {
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState(0);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageVersion, setImageVersion] = useState("");
  const [renderersLoaded, setRenderersLoaded] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const ignoreNextSearchParamsTick = useRef(false);

  useEffect(() => {
    loadTemplateRenderers();
    setRenderersLoaded(true);
    setImageVersion(Date.now().toString());
  }, []);

  const pages = useMemo(() => {
    const raw = Array.isArray(edition.pages) ? [...edition.pages] : [];
    const hasCoverPage = raw.some((page) => page.template === "cover");

    if (!hasCoverPage) {
      raw.unshift({
        id: `cover-${edition.slug}`,
        position: 1,
        template: "cover",
        content: {
          title: edition.title,
          body: edition.description || "",
          standfirst: edition.description || "",
          imageUrl: edition.coverImage || "",
          imageUrls: edition.coverImage ? [edition.coverImage] : [],
          kicker: "Digital Edition",
        },
      });
    }

    return raw.sort((left, right) => {
      const lPos = typeof left.position === "number" ? left.position : 0;
      const rPos = typeof right.position === "number" ? right.position : 0;
      return lPos - rPos;
    });
  }, [edition]);
  const editionDate = formatEditionDate(edition.publishDate);

  const renderedPages = useMemo(() => {
    return pages.map((page) => {
      const template = String(page.template || "").trim().toLowerCase();
      const title = String(page.content?.title || "").trim().toLowerCase();
      const body = String(page.content?.body || page.content?.text || "").trim().toLowerCase();
      const hasItems = Array.isArray(page.content?.items) && (page.content.items as unknown[]).length > 0;
      const looksLikeEditorial =
        /\b(editor('?s)? note|from the editor|editorial)\b/.test(`${title} ${body.slice(0, 320)}`);
      const looksLikeAd =
        /\b(advertisement|advert|ad page|ad\b|sponsor|sponsored by)\b/.test(`${title} ${body.slice(0, 200)}`) &&
        !hasItems;
      let effectiveTemplate: ReaderPage["template"] = page.template;
      if (template === "editor-note" || looksLikeEditorial) {
        effectiveTemplate = "editor-note";
      } else if (template === "contents" && looksLikeEditorial && !hasItems) {
        effectiveTemplate = "editor-note";
      } else if (template === "editor-note" && hasItems) {
        effectiveTemplate = "editor-note";
      } else if (template === "ad" || template === "full-page-ad" || looksLikeAd) {
        effectiveTemplate = "ad";
      }
      const entry = getTemplateEntry(effectiveTemplate);
      const viewModel = getTemplateViewModel(
        { ...page, template: effectiveTemplate },
        {
          title: edition.title,
          publishDate: edition.publishDate,
          coverImage: edition.coverImage,
          description: edition.description,
        },
      );
      const label =
        String(viewModel.title || "") || humanizeTemplate(effectiveTemplate);
      return { page, entry, viewModel, label, effectiveTemplate };
    });
  }, [pages, edition]);

  useEffect(() => {
    if (ignoreNextSearchParamsTick.current) {
      ignoreNextSearchParamsTick.current = false;
      return;
    }
    const raw = String(searchParams?.get('page') || searchParams?.get('p') || '').trim();
    if (!raw) return;
    const pageNum = Number(raw);
    if (!Number.isFinite(pageNum)) return;
    const idx = findRenderedIndexByPrintPageNumber(renderedPages, pageNum);
    if (idx >= 0 && idx < renderedPages.length) {
      setCurrentPage(idx);
    }
  }, [pages, searchParams, renderedPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev >= renderedPages.length - 1) return prev;
      return prev + 1;
    });
  }, [renderedPages.length]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev <= 0) return prev;
      return prev - 1;
    });
  }, []);

  const goToPage = useCallback((index: number) => {
    setCurrentPage(index);
    setIsNavOpen(false);
  }, []);

  // Collision-safe page lookup: if legacy writes caused multiple rendered
  // pages to share the same `data-page=N` (e.g. position or pageNumber
  // collisions on contents + editor-note), pick the entry whose TEMPLATE
  // matches the clicked anchor's text content. Example: clicking
  // "Editor's Note Page 5" should always land on the editor-note renderer,
  // even if a Contents renderer also has a numeric collision that would
  // win in a naive pageNum-1 lookup.
  const findPageIndexByClickHint = useCallback(
    (
      pageNum: number,
      anchor: Element,
    ): number => {
      const dataHint = anchor.getAttribute("data-page-hint");
      const text = (anchor.textContent || "").trim().toLowerCase();
      let prefer: "editor-note" | "contents" | undefined = undefined;
      if (dataHint === "editorial" || dataHint === "editor-note") prefer = "editor-note";
      if (dataHint === "contents") prefer = "contents";
      if (!prefer) {
        if (/\b(editor('?s)? note|editorial|from the editor)\b/.test(text)) prefer = "editor-note";
        else if (/\b(contents|in this issue|table of contents)\b/.test(text)) prefer = "contents";
      }
      // Fallback path: the legacy Contents page used `data-page` to mean
      // "displayed page number = position in rendered array + 1". If we
      // have no matches for `page.position === pageNum`, fall back to that
      // assumption (this matches what buildContentsPageFromTemplate writes).
      const byPosition = renderedPages
        .map((entry, index) => ({ entry, index }))
        .filter(
          ({ entry }) =>
            Number(entry.page.position) === pageNum ||
            Number((entry.page as any).pageNumber) === pageNum,
        );
      if (byPosition.length === 0) {
        const fallbackIdx = pageNum - 1;
        if (fallbackIdx >= 0 && fallbackIdx < renderedPages.length) return fallbackIdx;
        return -1;
      }
      if (byPosition.length === 1) return byPosition[0].index;
      if (prefer) {
        const best = byPosition.find(
          ({ entry }) => entry.effectiveTemplate === prefer || entry.page.template === prefer,
        );
        if (best) return best.index;
      }
      return byPosition[0].index;
    },
    [renderedPages],
  );

  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchorByData = target.closest("a[data-page]") as HTMLAnchorElement | null;
      const anchorByQ = target.closest("a[href*='?page=']") as HTMLAnchorElement | null;
      let anchor = anchorByData;
      // For the href*='?page=' branch, only intercept SAME-ORIGIN or path-absolute links.
      // External URLs that happen to contain a ?page= query (UTMs, partner deep-links,
      // advertiser microsite pagination) must pass through as native navigation.
      if (!anchor && anchorByQ) {
        try {
          const u = new URL(anchorByQ.href, window.location.href);
          if (u.origin === window.location.origin) {
            anchor = anchorByQ;
          }
        } catch {
          anchor = null;
        }
      }
      if (!anchor) return;
      e.preventDefault();
      e.stopPropagation();
      const raw =
        anchor.getAttribute("data-page") ??
        (() => {
          try {
            const u = new URL(anchor.getAttribute("href") || "", window.location.href);
            return u.searchParams.get("page");
          } catch {
            return null;
          }
        })();
      const pageNum = Number.parseInt(String(raw ?? "").trim(), 10);
      if (Number.isFinite(pageNum) && pageNum >= 1) {
        const idx = findPageIndexByClickHint(pageNum, anchor);
        if (idx >= 0 && idx < renderedPages.length) {
          goToPage(idx);
        }
      }
    };
    root.addEventListener("click", handleClick, true);
    return () => root.removeEventListener("click", handleClick, true);
  }, [renderedPages, goToPage, findPageIndexByClickHint]);

  useEffect(() => {
    if (renderedPages.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const pageParam = Number.parseInt(params.get("page") ?? "", 10);
      if (Number.isFinite(pageParam) && pageParam >= 1) {
        const idx = findRenderedIndexByPrintPageNumber(renderedPages, pageParam);
        if (idx >= 0) setCurrentPage(idx);
      }
    } catch {}
    // Intentionally run only once after renderedPages first settles — user
    // manual navigation via goToPage / prev / next updates currentPage live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderedPages.length > 0]);

  useEffect(() => {
    if (stageRef.current) {
      stageRef.current.scrollTop = 0;
    }
    const current = renderedPages[currentPage];
    const printPage = extractPrintPageNumber(current?.page);
    const pageParam = Number.isFinite(printPage) && printPage! > 0
      ? String(printPage)
      : String(currentPage + 1);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("page", pageParam);
      ignoreNextSearchParamsTick.current = true;
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [currentPage, renderedPages]);

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
          <div
            ref={stageRef}
            data-debug-reader-stage="true"
            className="absolute inset-0 h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth touch-pan-y"
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
                editionSlug={editionSlug}
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
          </div>
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
