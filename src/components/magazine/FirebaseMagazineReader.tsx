'use client';

import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/badge';
import type { MagazineIssue, MagazinePage } from '@/lib/magazine-service';
import {
  PageBackCover,
  PageContents,
  PageCover,
  PageEditorial,
  PageFeatureLeft,
  PageFeatureRight,
  PageFullPageAd,
  PagePartner,
  PageSpotlight,
} from '@/features/magazine/templates/shared';

interface FirebaseMagazineReaderProps {
  issue: MagazineIssue;
  pages: MagazinePage[];
}

type LegacyPageRendererProps = {
  data: Record<string, unknown>;
  imageVersion: string;
};

const PAGE_RENDERERS: Record<string, ComponentType<LegacyPageRendererProps>> = {
  cover: PageCover,
  editorial: PageEditorial,
  contents: PageContents,
  'feature-left': PageFeatureLeft,
  'feature-right': PageFeatureRight,
  column: PageFeatureRight,
  lifestyle: PageFeatureLeft,
  spotlight: PageSpotlight,
  partner: PagePartner,
  'full-page-ad': PageFullPageAd,
  'back-cover': PageBackCover,
};

function normalizePageData(page: MagazinePage, issue: MagazineIssue) {
  const content = page?.content && typeof page.content === 'object' ? page.content as Record<string, unknown> : {};

  if (page.type === 'cover') {
    return {
      title: issue.title,
      image: issue.coverImage,
      featureImage: issue.coverImage,
      date: issue.publishDate,
      ...content,
    };
  }

  if (page.type === 'contents') {
    return {
      title: 'Contents',
      ...content,
    };
  }

  if (page.type === 'editorial') {
    return {
      title: "Editor's Note",
      ...content,
    };
  }

  return content;
}

function getPageTitle(page: MagazinePage, issue: MagazineIssue) {
  const content = normalizePageData(page, issue);
  const title = String(content.title || content.name || content.headline || '').trim();
  if (title) return title;
  return `${page.type.replace(/-/g, ' ')} ${String(page.id).padStart(2, '0')}`;
}

export default function FirebaseMagazineReader({ issue, pages }: FirebaseMagazineReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageVersion, setImageVersion] = useState('');

  useEffect(() => {
    setImageVersion(Date.now().toString());
  }, []);

  // #region debug-point live-magazine-layout
  useEffect(() => {
    const report = () => {
      try {
        const root = document.getElementById('firebase-magazine-reader-root');
        const header = root?.querySelector('header');
        const main = root?.querySelector('main');
        const footer = root?.querySelector('footer');
        const stage = root?.querySelector('[data-debug-reader-stage="true"]');
        const article = stage?.firstElementChild;
        const payload = {
          point: 'live-magazine-layout',
          issueId: issue.id,
          pageIndex: currentPage,
          pageId: current?.page.id ?? null,
          viewportHeight: window.innerHeight,
          rootHeight: root?.clientHeight ?? null,
          headerHeight: header instanceof HTMLElement ? header.offsetHeight : null,
          mainHeight: main instanceof HTMLElement ? main.clientHeight : null,
          footerHeight: footer instanceof HTMLElement ? footer.offsetHeight : null,
          stageClientHeight: stage instanceof HTMLElement ? stage.clientHeight : null,
          stageScrollHeight: stage instanceof HTMLElement ? stage.scrollHeight : null,
          articleClientHeight: article instanceof HTMLElement ? article.clientHeight : null,
          articleScrollHeight: article instanceof HTMLElement ? article.scrollHeight : null,
          overflowDetected: Boolean(
            (stage instanceof HTMLElement && stage.scrollHeight > stage.clientHeight) ||
            (article instanceof HTMLElement && article.scrollHeight > article.clientHeight)
          ),
        };
        void fetch('http://127.0.0.1:3897/log', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => undefined);
      } catch {
        return;
      }
    };

    const timeout = window.setTimeout(report, 250);
    window.addEventListener('resize', report);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('resize', report);
    };
  }, [currentPage, issue.id, pages]);
  // #endregion

  const renderedPages = useMemo(() => {
    return [...pages]
      .sort((left, right) => left.id - right.id)
      .map((page) => {
        const Renderer = PAGE_RENDERERS[page.type] ?? PageFeatureLeft;
        return {
          page,
          Renderer,
          data: normalizePageData(page, issue),
          label: getPageTitle(page, issue),
        };
      });
  }, [issue, pages]);

  const current = renderedPages[currentPage];

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, renderedPages.length - 1));
  }, [renderedPages.length]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToPage = useCallback((index: number) => {
    setCurrentPage(index);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') nextPage();
      if (event.key === 'ArrowLeft') prevPage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage]);

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
    const root = document.getElementById('firebase-magazine-reader-root');
    const anyDoc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const anyRoot = root as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

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

  if (!current) return null;

  return (
    <div
      id="firebase-magazine-reader-root"
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-[#0c0a09] text-zinc-100"
    >
      <header className="h-14 shrink-0 border-b border-white/[0.06] bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 px-4 backdrop-blur-xl sm:h-16 sm:px-6">
        <div className="flex h-full items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/new-edition" className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white">
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </Link>
            <div className="mx-1 h-5 w-px bg-white/10 sm:mx-2" />
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo className="h-6 brightness-0 invert opacity-90 sm:h-8" />
              <span className="hidden text-white/20 sm:block">|</span>
              <p className="max-w-[120px] truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a3413a] sm:max-w-none sm:text-xs">
                {issue.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1 text-[10px] font-mono text-zinc-400 sm:flex">
              <span className="font-semibold text-white">{currentPage + 1}</span>
              <span className="text-zinc-600">/</span>
              <span>{renderedPages.length}</span>
            </div>
            {issue.flipbookUrl || issue.pdfUrl ? (
              <a
                href={issue.flipbookUrl || issue.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-white sm:flex"
                title="Open source edition"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            <Badge className="hidden border-none bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white sm:flex">
              Live
            </Badge>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0c0a09]">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[60vh] w-[60vw] rounded-full bg-[#a3413a]/8 blur-[120px]" />
        </div>

        <button
          type="button"
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-3 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur transition disabled:cursor-not-allowed disabled:opacity-30 lg:flex"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div
          data-debug-reader-stage="true"
          className="relative h-full w-full max-h-full self-center overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          <current.Renderer data={current.data} imageVersion={imageVersion} />
        </div>

        <button
          type="button"
          onClick={nextPage}
          disabled={currentPage === renderedPages.length - 1}
          className="absolute right-3 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur transition disabled:cursor-not-allowed disabled:opacity-30 lg:flex"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </main>

      <footer className="shrink-0 border-t border-white/[0.06] bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 px-3 py-3 backdrop-blur-xl sm:px-6">
        <div className="mb-3 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-[#a3413a] transition-all duration-300"
            style={{ width: `${((currentPage + 1) / renderedPages.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={prevPage}
            disabled={currentPage === 0}
            className="inline-flex min-w-[96px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a3413a]">
              {current.label}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Page {String(current.page.id).padStart(2, '0')}
            </p>
          </div>

          <button
            type="button"
            onClick={nextPage}
            disabled={currentPage === renderedPages.length - 1}
            className="inline-flex min-w-[96px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 hidden items-center justify-center gap-2 overflow-x-auto sm:flex">
          {renderedPages.map((entry, index) => {
            const isActive = index === currentPage;
            return (
              <button
                key={`${entry.page.id}-${index}`}
                type="button"
                onClick={() => goToPage(index)}
                className={`h-2 rounded-full transition-all ${
                  isActive ? 'w-8 bg-[#a3413a]' : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to page ${entry.page.id}`}
              />
            );
          })}
        </div>
      </footer>
    </div>
  );
}
