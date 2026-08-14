'use client';

import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/badge';
import type { MagazineIssue, MagazinePage } from '@/lib/magazine-service';
import { normalizeImageUrl, fixMagazineImageUrl } from '@/lib/magazine-utils';
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

function contentOf(page: MagazinePage): Record<string, unknown> {
  return page?.content && typeof page.content === 'object' ? (page.content as Record<string, unknown>) : {};
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

function normalizeImageFields(content: Record<string, unknown>): Record<string, unknown> {
  const pickImage = (): string => {
    const candidates = [
      'featureImage', 'heroImage', 'mainImage', 'primaryImage',
      'image', 'cover', 'coverImage', 'photo', 'headshot', 'portrait',
      'bannerImage', 'ogImage', 'socialImage',
    ] as const;
    for (const key of candidates) {
      const v = content[key];
      const cleaned = fixMagazineImageUrl(normalizeImageUrl(v));
      if (cleaned) return cleaned;
    }
    const arrKeys = ['media', 'gallery', 'additionalMedia', 'images', 'photos'] as const;
    for (const arrKey of arrKeys) {
      const arr = content[arrKey];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      for (const entry of arr) {
        if (typeof entry === 'string') {
          const cleaned = fixMagazineImageUrl(normalizeImageUrl(entry));
          if (cleaned) return cleaned;
        }
        if (entry && typeof entry === 'object') {
          const url = (entry as any).url || (entry as any).src || (entry as any).image;
          const cleaned = fixMagazineImageUrl(normalizeImageUrl(url));
          if (cleaned) return cleaned;
        }
      }
    }
    return '';
  };
  const chosen = pickImage();
  const cleanField = (key: string, fallback = chosen): string => {
    const v = fixMagazineImageUrl(normalizeImageUrl(content[key]));
    return v || fallback;
  };
  const cleanArr = (key: string): string[] => {
    const arr = content[key];
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of arr) {
      const cleanedRaw = typeof entry === 'string'
        ? normalizeImageUrl(entry)
        : normalizeImageUrl((entry && typeof entry === 'object') ? ((entry as any).url || (entry as any).src || (entry as any).image) : entry);
      const cleaned = fixMagazineImageUrl(cleanedRaw);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        out.push(cleaned);
      }
    }
    return out;
  };
  return {
    ...content,
    featureImage: cleanField('featureImage'),
    image: cleanField('image'),
    heroImage: cleanField('heroImage'),
    mainImage: cleanField('mainImage'),
    coverImage: cleanField('coverImage'),
    photo: cleanField('photo'),
    imageUrl: cleanField('imageUrl'),
    bannerImage: cleanField('bannerImage'),
    primaryImage: cleanField('primaryImage'),
    headshot: cleanField('headshot'),
    portrait: cleanField('portrait'),
    images: cleanArr('images'),
    gallery: cleanArr('gallery'),
    additionalImages: cleanArr('additionalImages'),
    media: cleanArr('media'),
  };
}

function normalizePageData(page: MagazinePage, issue: MagazineIssue) {
  const content = page?.content && typeof page.content === 'object' ? page.content as Record<string, unknown> : {};
  const normalizedImages = normalizeImageFields(content);

  if (page.type === 'cover') {
    const coverImage = fixMagazineImageUrl(
      normalizeImageUrl(
        issue.coverImage ||
        (issue as any).heroImage ||
        (issue as any).featureImage ||
        normalizedImages.featureImage ||
        normalizedImages.image ||
        '',
      ),
    );
    // CRITICAL SPREAD ORDER: content first, then normalizedImages, then explicit
    // keys last. Prior bug spread ...content last which silently reversed all
    // image normalization + explicit title/date overrides.
    const out: Record<string, unknown> = {
      ...content,
      ...normalizedImages,
      title: issue.title,
      image: coverImage,
      featureImage: coverImage,
      heroImage: coverImage,
      mainImage: coverImage,
      coverImage,
      date: issue.publishDate,
    };
    // Belt-and-braces: Cover renderer doesn't need Contents items array; drop.
    delete out.items;
    return out;
  }

  if (page.type === 'contents') {
    // For Contents, keep items[] (already validated downstream) but ensure
    // normalization overrides any dirty image URLs in content spread.
    return {
      ...content,
      ...normalizedImages,
      title: content.title ? String(content.title).trim() : 'Contents',
    };
  }

  if (page.type === 'editorial') {
    const pageText = typeof content.text === 'string' ? content.text : '';
    const fallbackText = String((issue as any).editorNote || (issue as any).editorsMessage || (issue as any).editorLetter || '');
    // Prefer the page-level text extracted from the Story Library / IDML parse.
    // The legacy issue.editorNote fallback is only used if the page record has
    // no text. Prior code did the opposite (fallback first) causing "Editor
    // Page content missing" on pages with correct per-page extracted text.
    const finalText = pageText.trim().length > 0 ? pageText : fallbackText;
    const author = String(content.author || (issue as any).editor || (issue as any).editorName || 'Gill Laidler').trim();
    const quote = String(content.quote || (issue as any).editorQuote || '');
    const featureImage = fixMagazineImageUrl(
      normalizeImageUrl(
        normalizedImages.featureImage ||
        (issue as any).editorImage ||
        (issue as any).editorPhoto ||
        (issue as any).editorHeadshot ||
        normalizedImages.image ||
        '',
      ),
    );
    const image = fixMagazineImageUrl(
      normalizeImageUrl(
        normalizedImages.image || (issue as any).editorImage || normalizedImages.featureImage || '',
      ),
    );
    const out: Record<string, unknown> = {
      ...content,
      ...normalizedImages,
      title: "Editor's Note",
      author,
      quote,
      text: finalText,
      featureImage,
      image,
    };
    // HARD GUARD: Never let a Contents items[] array leak onto an editorial
    // page via a legacy merge bug or a corrupted Firestore write.
    delete out.items;
    return out;
  }

  return normalizedImages;
}

function getPageTitle(page: MagazinePage, issue: MagazineIssue) {
  const content = normalizePageData(page, issue) as Record<string, unknown>;
  const title = String(content.title || content.name || content.headline || '').trim();
  if (title) return title;
  return `${page.type.replace(/-/g, ' ')} ${String(page.id).padStart(2, '0')}`;
}

const DEFAULT_EDITOR_HEADSHOT =
  "https://img.rocket.new/generatedImages/rocket_gen_img_124e295b7-1776339534000.png";

function buildFallbackEditorialPage(existingPages: MagazinePage[], issue: MagazineIssue): MagazinePage | null {
  const hasEditorial = existingPages.some((p) => String(p.type || '').trim().toLowerCase() === 'editorial');
  if (hasEditorial) return null;
  const editorialText = [
    (issue as any).editorsNote,
    (issue as any).editorNote,
    (issue as any).editorsLetter,
    (issue as any).editorLetter,
  ].find((v) => typeof v === 'string' && v.trim().length > 40);
  const author = String(
    (issue as any).editor || (issue as any).editorName || (issue as any).editorInChief || 'Gill Laidler',
  ).trim();
  const issueTitle = String(issue.title || '').trim();
  const issueDate = String(issue.publishDate || '').trim();
  const derivedTitle = String(
    (issue as any).editorsNoteTitle ||
    (issue as any).editorNoteTitle ||
    (issueTitle ? `Welcome to the ${issueTitle}` : "Editor's Note"),
  ).trim();
  const maxId = existingPages.reduce((m, p) => (typeof p.id === 'number' ? Math.max(m, p.id) : m), 0);
  const coverPage = existingPages.find((p) => String(p.type || '').toLowerCase() === 'cover');
  const coverId = coverPage && typeof coverPage.id === 'number' ? coverPage.id : 0;
  // Prefer id = coverId + 1 (typically 2) — even if another page already has that numeric id
  // (e.g. Contents itself is id=2). Because our findIndex click handler uses findIndex which
  // returns the FIRST occurrence matching page.id, and we splice our synthetic editorial into
  // array position coverId + 1 (index) so it wins the click delegation jump for that numeric id.
  // This means the Contents grid's "Editor's Note" card data-page="2" / page=2 correctly lands
  // on the synthetic Editor's Note page, not on the Contents page that may share the numeric id.
  let newId = coverId + 1 || 2;
  if (typeof newId !== 'number' || !Number.isFinite(newId) || newId < 1) {
    newId = Math.max(0, maxId) + 9999;
  }
  const quote = String(
    (issue as any).editorQuote ||
    'True leadership is about creating a space where others can flourish.',
  ).trim();
  const textSource = typeof editorialText === 'string' ? editorialText : '';
  const image = String(
    (issue as any).editorImage ||
    (issue as any).editorPhoto ||
    (issue as any).editorHeadshot ||
    (issue as any).editorPortrait ||
    DEFAULT_EDITOR_HEADSHOT,
  ).trim();
  const issueMonths = issueTitle || (issueDate ? new Date(issueDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'this edition');
  const fallbackIntro = `Welcome to ${issueMonths} of Yorkshire BusinessWoman magazine — a celebration of resilience, creativity, and the outstanding women shaping our region.`;
  const fallbackBody = `Across these pages you will meet founders, leaders, and changemakers who turn setbacks into momentum and inspire the next generation. As always, none of this would be possible without our sponsors, partners, committee, and the wider YBW community. Thank you for reading, for contributing, and for leading with courage. Enjoy the issue.`;
  const intro = String(
    (issue as any).editorIntro || (typeof editorialText === 'string' ? '' : fallbackIntro),
  ).trim();
  const text = textSource || `<p>${intro}</p><p>${fallbackBody}</p>`;
  const content: Record<string, unknown> = {
    title: derivedTitle,
    author,
    role: String((issue as any).editorRole || 'Editor-in-Chief').trim(),
    image,
    featureImage: image,
    heroImage: image,
    mainImage: image,
    photo: image,
    headshot: image,
    portrait: image,
    quote,
    text,
    intro,
    issueDate,
    synthetic: true,
  };
  return {
    id: newId,
    type: 'editorial',
    content,
  };
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
    // Determine structural page roles so we can order them in the canonical
    // reader order (Cover → Contents → Editor's Note → Articles → Back
    // Cover) regardless of how legacy Firestore numeric page.id values were
    // assigned. The user reported that the "Editor's Note" page at
    // sourceRef `pages-5-5` (storyId ...library-idml-editorial-5) was
    // rendering the Contents grid "rik-rak of cards"; this happens when
    // BOTH the Contents page and the Editorial page are assigned the same
    // numeric `page.id` (e.g. from `syncStoryLibrarySpreads` reassigning
    // sequential nextPageNumber values on re-runs). Because the old click
    // handler used `findIndex(entry.page.id === pageNum)` which returns
    // the FIRST match, clicking "Editor's Note, Page 5" could land on the
    // Contents page with that numeric id.
    const STRUCTURAL_ORDER = new Map([
      ['cover', 0],
      ['contents', 1],
      ['editorial', 2],
      ['editor-note', 2],
      ['feature-left', 10],
      ['feature-right', 11],
      ['column', 12],
      ['lifestyle', 13],
      ['spotlight', 14],
      ['partner', 15],
      ['ad', 20],
      ['full-page-ad', 20],
      ['back-cover', 99],
    ] as const);
    const roleOf = (type: unknown): number => {
      const k = String(type || '').trim().toLowerCase();
      if (STRUCTURAL_ORDER.has(k as (typeof STRUCTURAL_ORDER extends Map<infer K, number> ? K : never))) {
        return Number(STRUCTURAL_ORDER.get(k as (typeof STRUCTURAL_ORDER extends Map<infer K2, number> ? K2 : never)));
      }
      return 100;
    };

    const sortedPages = [...pages].sort((left, right) => {
      const lRole = roleOf(left.type);
      const rRole = roleOf(right.type);
      if (lRole !== rRole) return lRole - rRole;
      const lid = typeof left.id === 'number' ? left.id : 9999;
      const rid = typeof right.id === 'number' ? right.id : 9999;
      return lid - rid;
    });

    const fallbackEditorial = buildFallbackEditorialPage(sortedPages, issue);
    const orderedPages = [...sortedPages];
    if (fallbackEditorial) {
      // Place synthetic editorial immediately after cover (canonical order).
      const coverIndex = orderedPages.findIndex((p) => String(p.type || '').toLowerCase() === 'cover');
      const insertAt = coverIndex !== -1 ? coverIndex + 1 : 1;
      orderedPages.splice(insertAt, 0, fallbackEditorial);
    }
    return orderedPages.map((page, pageIndex) => {
      const type = String(page.type || '').trim().toLowerCase();
      // HARD SAFETY GUARD: If `type === 'editorial'` but the underlying
      // page is mis-typed (e.g. write-side bug let Contents items[] leak
      // onto it, or a structural-template collision in simple-reader
      // merged the template to `contents`), force the renderer we need.
      // Conversely, if `type === 'contents'` but the content contains
      // "Editor's Note" / "From the Editor" AND has no items[], flip it
      // to editorial so the wrong renderer never runs.
      const textHaystack = `${String(contentOf(page).title || '')} ${String(contentOf(page).text || '')} ${String(contentOf(page).intro || '')}`.trim().toLowerCase();
      const looksLikeEditorial = /\b(editor('?s)? note|from the editor|editorial)\b/.test(textHaystack);
      const hasItems = Array.isArray(contentOf(page).items) && (contentOf(page).items as unknown[]).length > 0;
      let effectiveType = type;
      if (effectiveType === 'editorial') effectiveType = 'editorial';
      else if (looksLikeEditorial && !hasItems) effectiveType = 'editorial';
      else if (type === 'contents' && looksLikeEditorial) effectiveType = 'editorial';
      else if (type === 'editorial' && hasItems) {
        // Legacy collision: editorial page accidentally has contents items.
        // normalizePageData already deletes items from editorial case; but
        // still force renderer = editorial here so we never show the grid.
        effectiveType = 'editorial';
      }
      const Renderer = PAGE_RENDERERS[effectiveType] ?? PAGE_RENDERERS[type] ?? PageFeatureLeft;
      return {
        page,
        pageIndex,
        effectiveType,
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

  // Helper: when user clicks a Contents card that says "Editor's Note page
  // N" or "Contents page N" and there are MULTIPLE pages sharing that
  // numeric page.id (due to syncStoryLibrarySpreads re-sequencing IDs over
  // time), pick the RIGHT type instead of blindly taking the first match.
  const findPageIndexById = useCallback(
    (pageNum: number, hint?: 'prefer-editorial' | 'prefer-contents') => {
      const allMatches = renderedPages
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => Number(entry.page.id) === pageNum);
      if (allMatches.length === 0) return -1;
      if (allMatches.length === 1) return allMatches[0].index;
      if (hint === 'prefer-editorial') {
        const best = allMatches.find(
          ({ entry }) => String(entry.page.type || '').toLowerCase() === 'editorial' || entry.effectiveType === 'editorial',
        );
        if (best) return best.index;
      }
      if (hint === 'prefer-contents') {
        const best = allMatches.find(
          ({ entry }) => String(entry.page.type || '').toLowerCase() === 'contents',
        );
        if (best) return best.index;
      }
      // Default: prefer structural (lowest role order) first, else earliest.
      return allMatches[0].index;
    },
    [renderedPages],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') nextPage();
      if (event.key === 'ArrowLeft') prevPage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage]);

  useEffect(() => {
    const root = document.getElementById('firebase-magazine-reader-root');
    if (!root) return;

    const resolveHintFromAnchor = (anchor: Element): 'prefer-editorial' | 'prefer-contents' | undefined => {
      const dataHint = anchor.getAttribute('data-page-hint');
      if (dataHint === 'editorial' || dataHint === 'editor-note') return 'prefer-editorial';
      if (dataHint === 'contents') return 'prefer-contents';
      // Fallback: inspect click target text. If it says "Editor's Note" /
      // "Editorial", prioritize editorial even when IDs collide — this is
      // exactly the case reported for pages-5-5 (Editor's Note).
      const txt = (anchor.textContent || '').trim().toLowerCase();
      if (/\b(editor('?s)? note|editorial|from the editor)\b/.test(txt)) return 'prefer-editorial';
      if (/\b(contents|in this issue|table of contents)\b/.test(txt)) return 'prefer-contents';
      return undefined;
    };

    const handleContentsClick = (event: Event) => {
      const target = event.target as Node | null;
      if (!target || !(target instanceof Element)) return;

      const anchorByDataPage = target.closest('a[data-page]') as HTMLAnchorElement | null;

      if (anchorByDataPage) {
        const raw = anchorByDataPage.getAttribute('data-page');
        if (!raw) return;
        const pageNum = Number.parseInt(raw.trim(), 10);
        if (!Number.isFinite(pageNum) || pageNum <= 0) return;

        const hint = resolveHintFromAnchor(anchorByDataPage);
        const index = findPageIndexById(pageNum, hint);
        if (index === -1) return;

        event.preventDefault();
        goToPage(index);
        return;
      }

      const anchorByHref = target.closest('a[href*="?page="]') as HTMLAnchorElement | null;
      if (anchorByHref) {
        try {
          const url = new URL(anchorByHref.href, window.location.origin);
          if (url.origin !== window.location.origin) return;
          const pageFromQ = url.searchParams.get('page');
          if (!pageFromQ) return;
          const pageNum = Number.parseInt(pageFromQ.trim(), 10);
          if (!Number.isFinite(pageNum) || pageNum <= 0) return;
          const hint = resolveHintFromAnchor(anchorByHref);
          const index = findPageIndexById(pageNum, hint);
          if (index === -1) return;
          event.preventDefault();
          goToPage(index);
        } catch {
          /* no-op on malformed href */
        }
      }
    };

    root.addEventListener('click', handleContentsClick, true);
    return () => {
      root.removeEventListener('click', handleContentsClick, true);
    };
  }, [findPageIndexById, goToPage, renderedPages]);

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
          id={`page-${current.page.id}-${currentPage}`}
          data-page-id={String(current.page.id)}
          data-page-position={String(currentPage + 1)}
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
                aria-label={`Go to page ${index + 1}${entry.label ? `: ${entry.label}` : ''}`}
                title={entry.label ? entry.label : undefined}
              />
            );
          })}
        </div>
      </footer>
    </div>
  );
}
