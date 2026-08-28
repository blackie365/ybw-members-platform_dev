'use client';

import { useState, useEffect, use, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Loader2,
  ExternalLink,
  Sparkles,
  Upload,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getMagazinePagesAction,
  getMagazineIssuesAction,
  getMagazineStoryLibraryAction,
  updateMagazineIssueAction,
  saveMagazineStoryLibraryAction,
  createMagazineIssueAction,
  addMagazinePageAction,
  updateMagazinePageAction,
  deleteMagazinePageAction,
  bulkUpdateMagazinePagesAction,
  bulkDeleteMagazinePagesAction,
  getGhostPostsAction,
  importIdmlToStoryLibraryAction,
  getReaderEditionByIssueIdAction,
  runSyncLegacyFromReaderEditionAction,
  syncBuilderToReaderEditionAction,
} from '@/app/actions/magazineActions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { normalizeImageUrl, normalizeStoryLibraryImageFields } from '@/lib/magazine-utils';

// Modular Components - Type Only Imports
import { MagazineIssue, MagazinePage } from '@/components/admin/magazine-builder/types';
import { extractPrintPageNumberFromBuilderPage, mergeDisplayedPages } from '@/features/magazine/domain/builder-to-reader';
import type { GhostImporterProps } from '@/components/admin/magazine-builder/GhostImporter';
import type { ManualImporterProps } from '@/components/admin/magazine-builder/ManualImporter';
import type { StoryLibraryPanelProps } from '@/components/admin/magazine-builder/StoryLibraryPanel';
import {
  emitMagazineMutation,
  type MagazineMutationType,
} from '@/features/magazine/domain/magazine-events';

// Lazy Load Heavy Admin Components
// This prevents regular users from downloading builder code and speeds up initial admin load
const IssueMetadata = dynamic(() => import('@/components/admin/magazine-builder/IssueMetadata').then(m => m.IssueMetadata), {
  loading: () => <div className="h-40 flex items-center justify-center border-2 border-dashed rounded-xl"><Loader2 className="h-6 w-6 animate-spin text-accent/20" /></div>
});

const PageList = dynamic(() => import('@/components/admin/magazine-builder/PageList').then(m => m.PageList), {
  loading: () => <div className="h-60 bg-muted/20 animate-pulse rounded-lg" />
});

const PageEditor = dynamic(() => import('@/components/admin/magazine-builder/PageEditor').then(m => m.PageEditor), {
  loading: () => <div className="h-full flex items-center justify-center bg-muted/5 animate-pulse rounded-xl" />
});

const PageTypeSelector = dynamic(() => import('@/components/admin/magazine-builder/PageTypeSelector').then(m => m.PageTypeSelector));

const GhostImporter = dynamic<GhostImporterProps>(() => import('@/components/admin/magazine-builder/GhostImporter').then(m => m.GhostImporter), {
  loading: () => <div className="h-60 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-accent/20" /><p className="text-xs text-muted-foreground italic">Initializing Ghost Importer...</p></div>
});

const ManualImporter = dynamic<ManualImporterProps>(() => import('@/components/admin/magazine-builder/ManualImporter').then(m => m.ManualImporter), {
  loading: () => <div className="h-60 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-accent/20" /><p className="text-xs text-muted-foreground italic">Initializing Manual Importer...</p></div>
});

const StoryLibraryPanel = dynamic<StoryLibraryPanelProps>(() => import('@/components/admin/magazine-builder/StoryLibraryPanel').then(m => m.StoryLibraryPanel), {
  loading: () => <div className="h-60 bg-muted/20 animate-pulse rounded-lg" />
});

const CONTENTS_CATEGORY_BY_TYPE: Record<string, string> = {
  editorial: 'EDITORIAL',
  'feature-full': 'FEATURE',
  'feature-left': 'FEATURE',
  'feature-right': 'FEATURE',
  column: 'EXPERT',
  lifestyle: 'LIFESTYLE',
  spotlight: 'SPOTLIGHT',
  partner: 'PARTNER',
};

function sortByPrintOrder<T extends any>(pages: T[]): T[] {
  return [...pages].sort((a, b) => {
    const la = extractPrintPageNumberFromBuilderPage(a) ?? (Number((a as any).id || 0) || 0);
    const lb = extractPrintPageNumberFromBuilderPage(b) ?? (Number((b as any).id || 0) || 0);
    if (la !== lb) return la - lb;
    return (Number((a as any).id || 0) || 0) - (Number((b as any).id || 0) || 0);
  });
}

function normalizeBuilderIdentity(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getContentsTitleForPage(page: MagazinePage): string {
  return String(
    page.content?.title ||
      page.content?.headline ||
      page.content?.name ||
      page.content?.brand ||
      '',
  ).trim();
}

function buildContentsItemsFromPages(pages: MagazinePage[]) {
  const sortedPages = [...pages].sort((a, b) => {
    const la = extractPrintPageNumberFromBuilderPage(a) ?? (a.id || 0);
    const lb = extractPrintPageNumberFromBuilderPage(b) ?? (b.id || 0);
    return la - lb;
  });
  const seenArticleKeys = new Set<string>();
  const seenRows = new Set<string>();

  return sortedPages.flatMap((page) => {
    if (page.type === 'cover' || page.type === 'contents' || page.type === 'full-page-ad' || page.type === 'back-cover') {
      return [];
    }

    const title = getContentsTitleForPage(page);
    if (!title) return [];
    const category = CONTENTS_CATEGORY_BY_TYPE[page.type];
    if (!category) return [];
    const pageNumber = extractPrintPageNumberFromBuilderPage(page) ?? Number(page.id || 0);
    if (!Number.isFinite(pageNumber) || pageNumber <= 0) return [];

    // De-duplicate by article title (case insensitive, whitespace collapsed)
    // so every story appears exactly once in the Contents — pointing at its
    // FIRST spread (lowest page number) even if the article spans
    // feature-full + feature-right or feature-left + feature-right.
    const articleKey = `${category.toLowerCase()}:${normalizeBuilderIdentity(title)}`;
    if (seenArticleKeys.has(articleKey)) return [];
    seenArticleKeys.add(articleKey);

    const rowKey = `${pageNumber}:${category}:${title.toLowerCase()}`;
    if (seenRows.has(rowKey)) return [];
    seenRows.add(rowKey);

    return [{
      page: pageNumber,
      category,
      title,
    }];
  });
}

function getPageIdentityKeys(page: MagazinePage): string[] {
  const keys = new Set<string>();
  const storyId = String(page.storyId || page.content?.storyId || '').trim();
  const sourceRef = String(page.sourceRef || page.content?.sourceRef || '').trim();
  const title = normalizeBuilderIdentity(getContentsTitleForPage(page));

  if (storyId) keys.add(`story:${storyId}`);
  if (sourceRef) keys.add(`source:${normalizeBuilderIdentity(sourceRef)}`);
  if (title) keys.add(`title:${title}`);

  return [...keys];
}

function getStoryIdentityKeys(story: any): string[] {
  const keys = new Set<string>();
  const storyId = String(story?.id || '').trim();
  const sourceRef = String(story?.sourceRef || '').trim();
  const title = normalizeBuilderIdentity(story?.title);

  if (storyId) keys.add(`story:${storyId}`);
  if (sourceRef) keys.add(`source:${normalizeBuilderIdentity(sourceRef)}`);
  if (title) keys.add(`title:${title}`);

  return [...keys];
}

function inferBuilderPageTypeFromStory(story: any): string {
  const contentType = String(story?.premiumReaderContentType || '').trim().toLowerCase();

  if (contentType === 'editorial') return 'editorial';
  if (contentType === 'profile' || contentType === 'spotlight') return 'spotlight';
  if (contentType === 'column' || contentType === 'opinion') return 'column';
  if (contentType === 'lifestyle') return 'lifestyle';
  if (contentType === 'partner') return 'partner';
  if (contentType === 'ad' || contentType === 'advert' || contentType === 'advertisement') return 'full-page-ad';

  return 'feature-left';
}

export default function MagazineBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('metadata');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const [issue, setIssue] = useState<MagazineIssue>({
    id: id === 'new' ? '' : id,
    title: '',
    description: '',
    publishDate: '',
    coverImage: '',
    pdfUrl: '',
    downloadUrl: '',
    isLatest: false,
    tags: [],
    autoSyncCover: true,
    readerType: 'custom',
    flipbookUrl: '',
    featureInFlipbook: false,
    storyLibrary: []
  });

  const [pages, setPages] = useState<MagazinePage[]>([]);
  const [readerEditionPages, setReaderEditionPages] = useState<MagazinePage[]>([]);
  const [readerEditionId, setReaderEditionId] = useState<string | null>(null);

  const convertReaderPagesToShadow = useCallback((readerPages: any[], editionId: string): MagazinePage[] => {
    const now = new Date().toISOString();
    const startId = 10_000;
    const arr = Array.isArray(readerPages) ? readerPages : [];
    return arr.map((rp: any, i: number) => {
      const printNum = extractPrintPageNumberFromBuilderPage(rp);
      const slotPos = typeof rp.position === 'number' ? rp.position : i + 1;
      const pos = Number.isFinite(printNum) && printNum! > 0 ? printNum! : slotPos;
      const typeFallback = String(rp.template || 'feature-left').trim().toLowerCase()
        .replace(/^editorial$/i, 'editorial');
      const type = typeFallback === 'ad' ? 'full-page-ad' : typeFallback;
      const content = { ...(rp.content || {}) };
      const title = content.title || rp.title || '';
      const body = content.body || content.text || '';
      return {
        docId: `reader:${editionId}:page:${i}:${pos}`,
        id: startId + pos,
        pageNumber: pos,
        position: pos,
        type,
        readOnly: true,
        generatedFromStoryLibrary: true,
        sourceReaderEditionId: editionId,
        sourceRef: String(rp.id || ''),
        storyId: String(rp.storyId || content.storyId || ''),
        content: {
          ...content,
          title,
          name: title,
          body,
          text: body,
          position: pos,
          pageNumber: pos,
          template: rp.template,
        },
        createdAt: rp.createdAt || now,
        updatedAt: rp.updatedAt || now,
      } satisfies MagazinePage;
    });
  }, []);

  const mergedDisplayedPages = useMemo<MagazinePage[]>(() => {
    return mergeDisplayedPages(readerEditionPages, pages, 'builder');
  }, [readerEditionPages, pages]);

  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isIdmlImporting, setIsIdmlImporting] = useState(false);
  const [isSyncingReaderToBuilder, setIsSyncingReaderToBuilder] = useState(false);
  const [idmlFileName, setIdmlFileName] = useState<string>('');
  const idmlFileInputRef = useRef<HTMLInputElement | null>(null);

  const syncLockRef = useRef<Promise<MagazinePage[]> | null>(null);
  const syncFnRef = useRef<typeof syncStoryLibrarySpreads | null>(null);
  const pagesRef = useRef<MagazinePage[]>([]);
  const issueRef = useRef<any>(issue);
  const loadingRef = useRef<boolean>(false);
  // Set to true for exactly one IDML import cycle: when an admin just did
  // "Import IDML" (Story Library was saved from an IDML parse) we want
  // Spread Builder tab to auto-create spreads ONCE. Manual page deletions
  // do NOT set this flag, so tab-switching post-delete never recreates them.
  const pendingIdmlSyncOnTabSwitchRef = useRef<boolean>(false);

  const runSingleFlightSync = useCallback(async (
    storyLibrary: any[],
    currentPages: MagazinePage[],
    options?: { suppressToast?: boolean },
  ): Promise<MagazinePage[]> => {
    if (syncLockRef.current) {
      return syncLockRef.current;
    }
    syncFnRef.current = syncStoryLibrarySpreads;
    syncLockRef.current = (async () => {
      try {
        const fn = syncFnRef.current || syncStoryLibrarySpreads;
        return await fn(storyLibrary, currentPages, options);
      } finally {
        syncLockRef.current = null;
      }
    })();
    return syncLockRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitAndSync = useCallback(async (
    mutationType: MagazineMutationType,
    pageDocId: string | null = null,
    opts: { forceSync?: boolean } = {},
  ): Promise<void> => {
    const { forceSync = false } = opts;
    const readerEditionId = String(issue?.readerEditionId || '').trim() || null;
    const slug = String((issue as any)?.slug || issue?.readerEditionSlug || '').trim() || null;
    try {
      emitMagazineMutation({
        issueId: id,
        editionId: readerEditionId,
        mutationType,
        pageDocId,
        slug,
      });
    } catch {
      /* emit failure is non-fatal */
    }
    if (forceSync) {
      try {
        await syncBuilderToReaderEditionAction(id);
      } catch (err) {
        console.warn('[builder] emitAndSync forceSync non-fatal:', err);
      }
    }
  }, [id, issue?.readerEditionId, issue?.readerEditionSlug, (issue as any)?.slug]);

  const handleIdmlFileForSpreads = async (file: File) => {
    if (isNew) {
      toast.error('Please create the edition first');
      return;
    }
    if (isIdmlImporting) {
      toast.info('Still processing previous IDML import…');
      return;
    }
    setIsIdmlImporting(true);
    pendingIdmlSyncOnTabSwitchRef.current = true;
    const toastId = 'idml-spread-import';
    const safetyTimer = setTimeout(() => {
      setIsIdmlImporting((prev) => {
        if (prev) {
          console.warn('[handleIdmlFileForSpreads] forced isIdmlImporting reset after 5 min safety timer');
          toast.error('IDML import timed out. Try again or refresh.', { id: toastId });
        }
        return false;
      });
    }, 5 * 60 * 1000);
    try {
      if (!file || file.size <= 0) throw new Error('Please select a valid .idml file');

      const MAX_INLINE_BASE64_BYTES = 1.5 * 1024 * 1024; // 1.5 MB — under Next/Vercel server action 4MB body limit
      const useStorageUpload = storage && file.size > MAX_INLINE_BASE64_BYTES;

      let res: any;
      if (useStorageUpload) {
        // LARGE FILE: upload to Firebase Storage first, import via storagePath.
        // Identical to the working "old stored-IDML route" (ManualImporter handleImportFromStoredPath):
        // admin SDK bucket.file().download() with service-account creds bypasses security rules
        // and there is no huge server action request body to hit the Next size limit (which was
        // the actual cause of "Unexpected response was received" → Sync failed toast).
        toast.info('Uploading IDML to Storage for processing… (large file)', { id: toastId });
        const filePath = `magazine-import/${file.name}`;
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, file);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              toast.info(`Uploading: ${pct}%`, { id: toastId });
            },
            (error) => reject(error),
            () => resolve(),
          );
        });

        toast.info('Extracting stories from Storage IDML… (this can take 30–60s for a full issue)', { id: toastId });

        // Derive gs:// URL from getDownloadURL so we use the exact working stored-IDML transport.
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        const match = downloadUrl.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
        const bucketName = match?.[1] || (storage.app?.options?.storageBucket as string) || '';
        const objectPathEncoded = match?.[2] || encodeURIComponent(filePath);
        const objectPath = decodeURIComponent(objectPathEncoded).replace(/\+/g, ' ');
        if (!bucketName || !objectPath) {
          throw new Error('Failed to derive storage path for uploaded IDML');
        }
        const storagePath = `gs://${bucketName}/${objectPath}`;

        // Call the working storage-path API route (same as the old ManualImporter stored-path route).
        const apiRes = await fetch('/api/admin/magazine/story-library/import-idml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueId: String(id),
            storagePath,
            fileName: file.name,
          }),
        });
        res = await apiRes.json();
      } else {
        // SMALL FILE: inline base64 via server action (legacy path, still fine for <1.5MB).
        toast.info('Extracting stories from IDML…', { id: toastId });
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read IDML file'));
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        const idmlBase64 = (dataUrl || '').replace(/^data:[^;]+;base64,/, '');
        if (!idmlBase64) throw new Error('Empty IDML file');
        res = await importIdmlToStoryLibraryAction(String(id), idmlBase64, file.name);
      }

      if (!res || !res.success) {
        const errMsg = res && 'error' in res ? String((res as any).error || '') : '';
        throw new Error(errMsg || 'IDML import failed');
      }
      const savedLibrary: any[] = Array.isArray((res as any).data?.storyLibrary) ? (res as any).data.storyLibrary : [];
      toast.success(`Imported ${savedLibrary.length} stories into the Story Library`, { id: toastId });

      setIssue((prev) => ({ ...prev, storyLibrary: savedLibrary }));
      toast.info('Creating spreads from Story Library…', { id: toastId });
      // Do NOT rely on loadData(true) — if initial page load's loadData() is still in-flight
      // (common when user clicks import immediately), we'd get stale story library.
      // Instead: fetch pages directly and sync against the just-written savedLibrary.
      const pagesRes = await getMagazinePagesAction(id);
      const currentPages: MagazinePage[] =
        pagesRes?.success && Array.isArray(pagesRes.data)
          ? sortByPrintOrder(pagesRes.data as MagazinePage[])
          : [];
      const nextPages = await runSingleFlightSync(savedLibrary, currentPages, {
        suppressToast: true,
      });
      pendingIdmlSyncOnTabSwitchRef.current = false;
      setPages(nextPages);
      toast.success('Issue spreads ready — Cover, Contents, Articles, and Back cover created', { id: toastId });
      await emitAndSync('reader-edition-synced', null, { forceSync: true });
      setActiveTab('builder');
    } catch (err: any) {
      // Keep pendingIdmlSyncOnTabSwitchRef = true on early error / partial write.
      // If story library WAS saved but spread creation failed, admin can just
      // click the Spread Builder tab and it will sync there.
      console.error('[handleIdmlFileForSpreads] error:', err);
      const rawMsg = err?.message || err?.toString?.() || 'Failed to import IDML into Issue Spreads';
      const msg = typeof rawMsg === 'string' ? rawMsg : String(rawMsg);
      if (msg.toLowerCase().includes('unexpected response was received')) {
        toast.error(
          'Import request was too large for the inline path. The Storage-upload fallback should now handle it — please try the upload again, or refresh the page.',
          { id: toastId },
        );
      } else {
        toast.error(msg, { id: toastId });
      }
    } finally {
      clearTimeout(safetyTimer);
      setIsIdmlImporting(false);
    }
  };

  const handleSyncReaderEditionToBuilder = useCallback(async () => {
    if (isNew) {
      toast.error('Please create the edition first');
      return;
    }
    if (isSyncingReaderToBuilder || isIdmlImporting || isBatchSyncing) {
      toast.info('Still processing previous sync/import…');
      return;
    }
    if (!readerEditionId) {
      toast.error('No published ReaderEdition linked to this issue yet. Publish via the ManualImporter → Auto-Import IDML tab first.');
      return;
    }

    setIsSyncingReaderToBuilder(true);
    const toastId = 'reader-to-builder-sync';
    try {
      toast.info('Syncing published ReaderEdition into Story Library + Spread Builder (editable pages)…', { id: toastId });
      const res = await runSyncLegacyFromReaderEditionAction(String(id));
      if (!res?.success) throw new Error(res?.error || 'Sync failed');
      const sl = Number(res?.data?.storyLibraryCount || 0);
      const lp = Number(res?.data?.legacyPageCount || 0);
      toast.success(`Synced ${sl} Story Library items + ${lp} editable spreads (Cover → Back Cover). Contents page links regenerated.`, { id: toastId });

      // Reload legacy pages and story library + reader pages from server so UI shows post-sync state without manual refresh.
      const [newPagesRes, newStoryRes, newReaderRes] = await Promise.all([
        getMagazinePagesAction(id),
        getMagazineStoryLibraryAction(id),
        getReaderEditionByIssueIdAction(id),
      ]);
      if (newPagesRes?.success && Array.isArray(newPagesRes.data)) setPages(newPagesRes.data as MagazinePage[]);
      if (newStoryRes?.success && Array.isArray((newStoryRes as any).data?.storyLibrary)) {
        setIssue((prev) => ({ ...prev, storyLibrary: (newStoryRes as any).data.storyLibrary }));
      }
      if (newReaderRes?.success && newReaderRes.data) {
        setReaderEditionId(String(newReaderRes.data.id || ''));
        setReaderEditionPages([]);
      }
      toast.success('Spread Builder synced!', { id: toastId });
      await emitAndSync('reader-edition-synced', null, { forceSync: true });
      setActiveTab('builder');
    } catch (err: any) {
      console.error('[handleSyncReaderEditionToBuilder]', err);
      toast.error(err?.message || err?.toString?.() || 'Sync failed', { id: toastId });
    } finally {
      setIsSyncingReaderToBuilder(false);
    }
  }, [id, isNew, readerEditionId, isSyncingReaderToBuilder, isIdmlImporting, isBatchSyncing, convertReaderPagesToShadow, emitAndSync]);

  const applyContentsPageItems = useCallback((nextPages: MagazinePage[]) => {
    const contentsPage = nextPages.find((page) => page.type === 'contents');
    if (!contentsPage) return nextPages;

    const nextItems = buildContentsItemsFromPages(nextPages);
    const currentItems = Array.isArray(contentsPage.content?.items)
      ? contentsPage.content.items
      : [];

    if (JSON.stringify(currentItems) === JSON.stringify(nextItems)) {
      return nextPages;
    }

    return nextPages.map((page) =>
      page.docId === contentsPage.docId
        ? {
            ...page,
            content: {
              ...(page.content || {}),
              items: nextItems,
            },
          }
        : page,
    );
  }, []);

  const syncContentsPage = useCallback(async (nextPages: MagazinePage[]) => {
    const pagesWithContents = applyContentsPageItems(nextPages);
    const contentsPage = pagesWithContents.find((page) => page.type === 'contents');
    if (!contentsPage) return;

    const nextItems = Array.isArray(contentsPage.content?.items) ? contentsPage.content.items : [];
    const currentPage = nextPages.find((page) => page.docId === contentsPage.docId);
    const currentItems = Array.isArray(currentPage?.content?.items) ? currentPage.content.items : [];

    if (JSON.stringify(currentItems) === JSON.stringify(nextItems)) {
      return;
    }

    await updateMagazinePageAction(id, contentsPage.docId, {
      content: {
        ...(contentsPage.content || {}),
        items: nextItems,
      },
    });
  }, [applyContentsPageItems, id]);

  const persistPageOrder = useCallback(async (orderedPages: MagazinePage[]) => {
    await emitAndSync('page-reordered', null, { forceSync: false });
    const previousPages = pages;
    const nextSlotPosition = (index: number): number => index + 1;
    const renumberedPages = orderedPages.map((page, index) => {
      const slot = nextSlotPosition(index);
      const prevContent = page.content || {};
      const nextContent = {
        ...prevContent,
        position: slot,
        pageNumber: slot,
      };
      return {
        ...page,
        position: slot,
        pageNumber: slot,
        content: nextContent,
      };
    });
    const nextPages = applyContentsPageItems(renumberedPages);
    const previousPageByDocId = new Map(previousPages.map((page) => [page.docId, page]));
    const changedPages = nextPages.filter((page) => {
      const previousPage = previousPageByDocId.get(page.docId);
      if (!previousPage) return false;
      const positionChanged =
        previousPage.position !== page.position ||
        previousPage.pageNumber !== page.pageNumber ||
        (previousPage.content?.position ?? null) !== (page.content?.position ?? null) ||
        (previousPage.content?.pageNumber ?? null) !== (page.content?.pageNumber ?? null) ||
        (previousPage.id !== page.id && Number.isFinite(Number(previousPage.id)) && Number.isFinite(Number(page.id)));
      const contentChanged =
        page.type === 'contents' &&
        JSON.stringify(previousPage.content?.items || []) !==
          JSON.stringify(page.content?.items || []);
      return positionChanged || contentChanged;
    });

    setPages(nextPages);
    setSaving(true);
    try {
      const entries: Array<{
        pageId: string;
        data: Record<string, unknown>;
        skipExistingFetch: true;
        existingDoc: MagazinePage | undefined;
      }> = [];

      for (const page of changedPages) {
        const previousPage = previousPageByDocId.get(page.docId);
        const payload: Record<string, unknown> = {};

        const positionFieldsChanged =
          previousPage?.position !== page.position ||
          previousPage?.pageNumber !== page.pageNumber ||
          (previousPage?.content?.position ?? null) !== (page.content?.position ?? null) ||
          (previousPage?.content?.pageNumber ?? null) !== (page.content?.pageNumber ?? null);

        if (positionFieldsChanged) {
          payload.pageNumber = page.pageNumber;
          payload.position = page.position;
          payload.content = page.content;
        } else if (
          page.type === 'contents' &&
          JSON.stringify(previousPage?.content?.items || []) !==
            JSON.stringify(page.content?.items || [])
        ) {
          payload.content = page.content;
        }

        if (Object.keys(payload).length === 0) continue;
        entries.push({
          pageId: page.docId,
          data: payload,
          skipExistingFetch: true,
          existingDoc: previousPage,
        });
      }

      if (entries.length > 0) {
        const bulkRes = await bulkUpdateMagazinePagesAction(id, entries, { skipSync: true });
        if (!bulkRes.success) {
          throw new Error(bulkRes.error || 'Failed to reorder pages');
        }
      }
    } catch (err) {
      setPages(previousPages);
      toast.error('Failed to reorder pages');
    } finally {
      setSaving(false);
      syncBuilderToReaderEditionAction(id, { revalidatePublicRoutesOnly: true }).catch((syncErr: any) => {
        console.warn('[persistPageOrder] post-fire syncBuilderToReaderEdition non-fatal:', syncErr?.message || syncErr);
      });
    }
  }, [applyContentsPageItems, emitAndSync, id, pages]);

  const handleBatchSync = async () => {
    if (!issue.ghostSyncTag) {
      toast.error('Please set a Ghost Sync Tag in Issue Settings first');
      setActiveTab('metadata');
      return;
    }

    if (!confirm(`This will find all Ghost articles tagged "${issue.ghostSyncTag}" and add them as new spreads. Continue?`)) {
      return;
    }

    setIsBatchSyncing(true);
    try {
      // 1. Fetch articles by tag
      const res = await getGhostPostsAction({ filter: `tag:${issue.ghostSyncTag}` });
      
      if (!res.success || !res.data || res.data.length === 0) {
        toast.error(`No articles found with tag "${issue.ghostSyncTag}"`);
        return;
      }

      toast.info(`Found ${res.data.length} articles. Starting extraction...`);

      // 2. Loop and Import
      let count = 0;
      for (const post of res.data) {
        // Smart map to template
        const { mapGhostToTemplate } = await import('@/lib/magazine-theme');
        const type = mapGhostToTemplate(post);
        
        // Use our existing import logic
        await handleImportContent(post, type);
        count++;
      }

      toast.success(`Successfully extracted ${count} articles into spreads!`);
      await loadData(true);
      await emitAndSync('page-reordered', null, { forceSync: true });
      setActiveTab('builder');
    } catch (err) {
      toast.error('Batch extraction failed');
    } finally {
      setIsBatchSyncing(false);
    }
  };

  // Load Initial Data
  const loadData = useCallback(async (silent = false) => {
    // IMPORTANT: loadData no longer runs the Story Library → Pages auto-sync
    // unconditionally. Previously, if the admin deleted all pages then any
    // code path that called loadData (save metadata, save story library,
    // post-CMS-import, Next.js cache race) would immediately recreate the
    // three structural spreads (cover / contents / back-cover) because the
    // tail of this function called runSingleFlightSync whenever `!isNew`.
    //
    // Auto-sync from Story Library → Pages now ONLY runs on EXPLICIT admin
    // actions:
    //   • Import IDML (handleIdmlFileForSpreads)
    //   • Click "Smart Batch Fill" (handleBatchSync, via handleImportContent)
    //   • Select a story in the library and press "Add as spread" (if any)
    //
    // This guarantees: if the admin explicitly deletes all spreads, they
    // STAY deleted. They can always be restored by clicking Smart Batch Fill
    // or re-importing IDML.
    if (!silent) setLoading(true);
    try {
        let loadedStoryLibrary: any[] = [];
        let loadedPages: MagazinePage[] = [];

        // Load Issue
        const issuesRes = await getMagazineIssuesAction();
        if (issuesRes?.success && issuesRes.data) {
          const currentIssue = issuesRes.data.find((i: any) => i.id === id);
          if (currentIssue) {
            const castIssue = currentIssue as any;
            // Format date for <input type="date">
            let formattedDate = castIssue.publishDate || '';
            if (formattedDate && typeof formattedDate !== 'string') {
              try {
                if (formattedDate.seconds) {
                  formattedDate = new Date(formattedDate.seconds * 1000).toISOString().split('T')[0];
                } else if (formattedDate instanceof Date) {
                  formattedDate = formattedDate.toISOString().split('T')[0];
                }
              } catch (e) {
                formattedDate = new Date().toISOString().split('T')[0];
              }
            } else if (typeof formattedDate === 'string' && formattedDate.includes('T')) {
              formattedDate = formattedDate.split('T')[0];
            }
            
            setIssue({ 
              id: castIssue.id || id,
              title: castIssue.title || '',
              description: castIssue.description || '',
              publishDate: formattedDate,
              coverImage: castIssue.coverImage || '',
              pdfUrl: castIssue.pdfUrl || '',
              downloadUrl: castIssue.downloadUrl || '',
              isLatest: castIssue.isLatest || false,
              tags: castIssue.tags || [],
              autoSyncCover: castIssue.autoSyncCover !== undefined ? castIssue.autoSyncCover : true,
              readerType: castIssue.readerType || 'custom',
              ghostSyncTag: castIssue.ghostSyncTag || '',
              flipbookUrl: castIssue.flipbookUrl || '',
              featureInFlipbook: castIssue.featureInFlipbook || false,
              slug: castIssue.slug || castIssue.readerEditionSlug || '',
              readerEditionSlug: castIssue.readerEditionSlug || '',
              storyLibrary: Array.isArray(castIssue.storyLibrary) ? castIssue.storyLibrary : []
            });
          }
        }

        if (!isNew) {
          const storyLibraryRes = await getMagazineStoryLibraryAction(id);
          if (storyLibraryRes?.success && Array.isArray(storyLibraryRes.data)) {
            loadedStoryLibrary = storyLibraryRes.data;
            setIssue((prev) => ({
              ...prev,
              storyLibrary: storyLibraryRes.data,
            }));
          }
        }

        // Load Pages
        const pagesRes = await getMagazinePagesAction(id);
        if (pagesRes?.success && pagesRes.data) {
          loadedPages = sortByPrintOrder(pagesRes.data as any[]);
        }

        // Load linked ReaderEdition (IDML publish path) — convert to shadow
        // read-only spreads so the "Issue Spreads" column shows all 61 pages
        // from the IDML publish, not just the 6 legacy hand-created pages.
        //
        // HOWEVER: if the legacy firestore pages already include fresh
        // editable copies FROM THIS SAME ReaderEdition (a prior successful
        // "Sync ReaderEdition → Builder" run, stamped with matching
        // sourceReaderEditionId), then the editable legacy pages are the
        // user's working copy. Hiding shadow rows means merge logic is
        // skipped entirely — page list = simple editable sort, no badges,
        // no readOnly rows, no two-layer model in effect. Survives page
        // reload (derived from firestore data, not in-memory state).
        let loadedReaderPages: MagazinePage[] = [];
        let loadedReaderId: string | null = null;
        try {
          const reRes = await getReaderEditionByIssueIdAction(id);
          if (reRes?.success && reRes?.data) {
            const re = reRes.data as any;
            const reId = String(re.id || '');
            const rp = Array.isArray(re.pages) ? re.pages : [];
            if (reId && rp.length > 0) {
              const legacySyncedWithSameEdition = (loadedPages || []).some((p: any) =>
                typeof (p as any).sourceReaderEditionId === 'string' &&
                (p as any).sourceReaderEditionId === reId,
              );
              loadedReaderId = reId;
              if (!legacySyncedWithSameEdition) {
                // AUTO-PROMOTE (totally editable, no manual step required):
                // there is no more "read-only IDML shadow" state an admin has
                // to know about. The moment the builder opens an issue with
                // published-but-unsynced IDML content, silently run the same
                // conversion previously exposed only as the manual
                // "Sync Published IDML → Builder" button, turning every
                // ReaderEdition page into a normal editable spread before the
                // page list ever renders.
                try {
                  const syncRes = await runSyncLegacyFromReaderEditionAction(id);
                  if (syncRes?.success) {
                    const refreshedPagesRes = await getMagazinePagesAction(id);
                    if (refreshedPagesRes?.success && Array.isArray(refreshedPagesRes.data)) {
                      loadedPages = [...(refreshedPagesRes.data as any[])].sort((a, b) => (a.id || 0) - (b.id || 0));
                    }
                    loadedReaderPages = [];
                  } else {
                    // Auto-sync failed — fall back to showing the shadow pages
                    // (read-only) rather than silently hiding content.
                    console.warn('Auto-sync ReaderEdition → editable builder pages failed:', syncRes?.error);
                    loadedReaderPages = convertReaderPagesToShadow(rp, reId);
                  }
                } catch (autoSyncErr) {
                  console.warn('Auto-sync ReaderEdition → editable builder pages threw (non-fatal):', autoSyncErr);
                  loadedReaderPages = convertReaderPagesToShadow(rp, reId);
                }
              } else {
                // Already synced = legacy pages are authoritative; don't surface shadows.
                loadedReaderPages = [];
              }
            }
          }
        } catch (reErr) {
          console.warn('ReaderEdition fetch in builder failed (non-fatal):', reErr);
        }

        // Intentionally NO end-of-load runSingleFlightSync.
        // See JSDoc-style note at top of loadData for rationale.

        setPages(loadedPages);
        setReaderEditionPages(loadedReaderPages);
        setReaderEditionId(loadedReaderId);
        if (loadedReaderPages.length > 0 && !selectedPageId) {
          const first = loadedReaderPages[0];
          if (first?.docId) setSelectedPageId(first.docId);
        }

        try {
          const rePagesArr = Array.isArray(loadedReaderPages) ? loadedReaderPages : [];
          const legacyArr = Array.isArray(loadedPages) ? loadedPages : [];
          const pagesForContents: MagazinePage[] = mergeDisplayedPages(rePagesArr, legacyArr, 'builder');
          await syncContentsPage(pagesForContents);
        } catch (e) {
          // Non-fatal: stale Contents grid will not break anything else.
          console.warn('loadData: auto-sync Contents items (non-fatal):', e);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        if (!silent) toast.error('Failed to load magazine data');
      } finally {
        if (!silent) setLoading(false);
      }
  }, [id, isNew, convertReaderPagesToShadow, selectedPageId, syncContentsPage, extractPrintPageNumberFromBuilderPage]);

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { issueRef.current = issue; }, [issue]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    syncFnRef.current = syncStoryLibrarySpreads;
  });

  useEffect(() => {
    if (!isNew) {
      loadData();
    } else {
      setIssue(prev => ({
        ...prev,
        publishDate: new Date().toISOString().split('T')[0]
      }));
    }
  }, [isNew, loadData]);

  const didSpreadSyncOnTabRef = useRef(false);
  useEffect(() => {
    if (activeTab !== 'builder') {
      didSpreadSyncOnTabRef.current = false;
      return;
    }
    if (isNew || loadingRef.current) return;

    // Case 1: IDML import just happened in another tab (Issue Settings /
    // ManualImporter), pages are empty, and the pending-import-sync flag was
    // set. This case auto-creates structural spreads for exactly ONE tab
    // switch after an import, matching the pre-fix "spreads appear when you
    // open Spread Builder" behavior.
    if (pendingIdmlSyncOnTabSwitchRef.current) {
      pendingIdmlSyncOnTabSwitchRef.current = false;
      didSpreadSyncOnTabRef.current = true;
      const storyLibrary = (issueRef.current?.storyLibrary as any[]) || [];
      if (syncLockRef.current) return;
      if (storyLibrary.length === 0) return;
      let cancelled = false;
      (async () => {
        try {
          const pagesRes = await getMagazinePagesAction(id);
          const currentPages: MagazinePage[] =
            pagesRes?.success && Array.isArray(pagesRes.data)
              ? sortByPrintOrder(pagesRes.data as MagazinePage[])
              : [];
          if (cancelled) return;
          // Don't clobber existing manual pages. If admin already has spreads
          // (e.g. they reimported), only run sync if there are zero pages.
          if (currentPages.length > 0) return;
          const nextPages = await runSingleFlightSync(
            storyLibrary,
            currentPages,
            { suppressToast: false },
          );
          if (!cancelled) {
            setPages(nextPages);
            toast.success('IDML spreads auto-created.');
          }
        } catch (err) {
          console.warn('IDML-triggered spread sync failed on tab switch:', err);
        }
      })();
      return;
    }

    // Case 2 (default): NO auto-create of spreads on tab switch. This was the
    // cause of the deleted-spreads bounce-back bug. "0 pages" is now a VALID
    // user choice. Spreads are created explicitly by: Import IDML button,
    // Smart Batch Fill button, or the pending-import-sync case above.
    didSpreadSyncOnTabRef.current = true;
  }, [activeTab, isNew, id, runSingleFlightSync]);

  // Issue Handlers
  const handleSaveIssue = async () => {
    await emitAndSync('issue-saved', null, { forceSync: false });
    setSaving(true);
    try {
      if (isNew) {
        const res = await createMagazineIssueAction(issue);
        if (res.success) {
          toast.success('Edition created! Now build your spreads.');
          router.push(`/admin/magazine/builder/${res.id}`);
        } else {
          toast.error(res.error || 'Failed to create edition');
        }
      } else {
        const res = await updateMagazineIssueAction(id, issue);
        if (res.success) {
          toast.success('Metadata updated successfully');
          await loadData(true);
        } else {
          toast.error(res.error || 'Failed to update metadata');
        }
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStoryLibrary = async (storyLibrary: any[]) => {
    await emitAndSync('story-library-saved', null, { forceSync: false });
    if (isNew) {
      toast.error('Please create the edition first');
      return;
    }

    setSaving(true);
    try {
      const normalized = normalizeStoryLibraryImageFields(storyLibrary || []);
      const res = await saveMagazineStoryLibraryAction(id, normalized);
      if (res.success) {
        const saved = Array.isArray(res.data) ? res.data : normalized;
        setIssue((prev) => ({
          ...prev,
          storyLibrary: normalizeStoryLibraryImageFields(saved),
        }));
        // If the save resulted in new Story Library content, treat it as an
        // import-style event and auto-generate spreads to match. This ensures
        // "Import IDML" flows in Issue Settings or the Spread Builder tab
        // still produce a full spread layout automatically (Cover → Contents
        // → Articles → Back cover), without reverting to the bad pre-fix
        // behavior of auto-creating spreads whenever pages list happened to
        // be empty (e.g. after an explicit admin delete).
        const hasContent = saved.length > 0;
        const wasEmptyBefore = (issue.storyLibrary?.length || 0) === 0;
        if (hasContent && wasEmptyBefore) {
          pendingIdmlSyncOnTabSwitchRef.current = true;
          const pagesRes = await getMagazinePagesAction(id);
          const currentPages: MagazinePage[] =
            pagesRes?.success && Array.isArray(pagesRes.data)
              ? sortByPrintOrder(pagesRes.data as MagazinePage[])
              : [];
          // Only auto-generate when pages list is actually empty + story
          // library was just populated for the first time. If the admin
          // already has spreads (e.g. they re-saved the library to tweak a
          // single story entry), we don't want to clobber manual edits.
          if (currentPages.length === 0) {
            const nextPages = await runSingleFlightSync(saved, currentPages, {
              suppressToast: true,
            });
            setPages(nextPages);
            pendingIdmlSyncOnTabSwitchRef.current = false;
            toast.success(
              'Story library saved — Cover, Contents, Articles, and Back cover auto-generated in Spread Builder.'
            );
            setActiveTab('builder');
          } else {
            toast.success('Story library saved — click Smart Batch Fill to create missing spreads from new stories.');
          }
        } else {
          toast.success('Story library saved — click Smart Batch Fill to auto-generate spreads from this library.');
        }
      } else {
        toast.error(res.error || 'Failed to save story library');
      }
    } catch {
      toast.error('Failed to save story library');
    } finally {
      setSaving(false);
    }
  };

  const handleStoryLibraryImported = async (storyLibrary: any[]) => {
    await emitAndSync('story-library-saved', null, { forceSync: false });
    setIssue((prev) => ({
      ...prev,
      storyLibrary: Array.isArray(storyLibrary) ? storyLibrary : prev.storyLibrary || [],
    }));

    if (!isNew) {
      // Called from ManualImporter when an IDML was saved into the Story
      // Library via "Import Stored IDML" or the ManualImporter file
      // picker. Always set the pending-sync flag AND eagerly try to build
      // spreads now if pages are empty, so the admin doesn't have to click
      // Spread Builder tab first. If pages aren't empty (admin was already
      // editing manually), only flag for tab switch and let admin choose.
      pendingIdmlSyncOnTabSwitchRef.current = true;
      try {
        const pagesRes = await getMagazinePagesAction(id);
        const currentPages: MagazinePage[] =
          pagesRes?.success && Array.isArray(pagesRes.data)
            ? sortByPrintOrder(pagesRes.data as MagazinePage[])
            : [];
        if (currentPages.length === 0 && Array.isArray(storyLibrary) && storyLibrary.length > 0) {
          const nextPages = await runSingleFlightSync(storyLibrary, currentPages, {
            suppressToast: true,
          });
          setPages(nextPages);
          pendingIdmlSyncOnTabSwitchRef.current = false;
          toast.success('IDML imported — spreads auto-generated. Switching to Spread Builder…');
          setActiveTab('builder');
          return;
        }
      } catch (err) {
        console.warn('Auto-sync after IDML import failed, deferring to tab switch:', err);
      }
      toast.info('Story library imported — spreads will auto-generate when you open the Spread Builder tab.');
    }
  };

  const handleRemoveStoryLibraryItem = async (storyId: string) => {
    await emitAndSync('story-library-saved', null, { forceSync: false });
    const next = (issue.storyLibrary || []).filter((story) => story.id !== storyId);
    try {
      await handleSaveStoryLibrary(next);
    } catch {
      toast.error('Failed to remove story');
    }
  };

  const handleToggleStoryLibraryInclusion = async (storyId: string) => {
    await emitAndSync('story-library-saved', null, { forceSync: false });
    const next = (issue.storyLibrary || []).map((story) =>
      story.id === storyId
        ? { ...story, includedInPremiumReader: story.includedInPremiumReader === false }
        : story,
    );

    try {
      await handleSaveStoryLibrary(next);
    } catch {
      toast.error('Failed to update premium reader inclusion');
    }
  };

  const handleDeleteStoryLibraryAll = async () => {
    await emitAndSync('story-library-saved', null, { forceSync: false });
    try {
      await handleSaveStoryLibrary([]);
      toast.success('Story library cleared');
    } catch {
      toast.error('Failed to clear story library');
    }
  };

  function pickStoryImage(story: any): string {
    if (!story) return '';
    const candidates: string[] = [];
    const prim = ['imageUrl', 'image', 'featureImage', 'heroImage', 'mainImage', 'coverImage', 'photo', 'headshot', 'portrait', 'partnerLogo', 'logoImage', 'backgroundImage'];
    for (const k of prim) {
      const normalized = normalizeImageUrl(story[k]);
      if (normalized) candidates.push(normalized);
    }
    const arrs = ['imageUrls', 'images', 'gallery', 'additionalImages', 'imageFileNames', 'coverImages', 'logoImages'];
    for (const k of arrs) {
      const v = story[k];
      if (Array.isArray(v)) {
        for (const item of v) {
          const normalized = normalizeImageUrl(item);
          if (normalized) candidates.push(normalized);
        }
      }
    }
    return candidates.find((c) => /^https?:\/\//i.test(c)) || candidates[0] || '';
  }

  function buildManualContentFromStory(story: any, pageType: string) {
    const storyTitle = String(story?.title || '').trim();
    const storyAuthor = String(story?.author || '').trim();
    const storyText = String(story?.text || '').trim();
    const storyImage = pickStoryImage(story);
    const storyStandfirst = String(story?.standfirst || '').trim();
    const storyQuote = storyStandfirst || (storyText ? `${storyText.substring(0, 140).trim()}...` : '');
    const imgList = storyImage ? [storyImage] : [];
    const commonImageFields = storyImage
      ? {
          image: storyImage,
          featureImage: storyImage,
          heroImage: storyImage,
          mainImage: storyImage,
          photo: storyImage,
          imageUrl: storyImage,
          coverImage: storyImage,
          images: imgList,
          gallery: imgList,
          additionalImages: imgList,
        }
      : {
          image: '',
          featureImage: '',
          heroImage: '',
          mainImage: '',
          photo: '',
          imageUrl: '',
          coverImage: '',
          images: [],
          gallery: [],
          additionalImages: [],
        };

    switch (pageType) {
      case 'editorial':
        return {
          title: storyTitle || 'Editorial',
          author: storyAuthor || 'Gill Laidler',
          intro: storyStandfirst,
          text: storyText,
          ...commonImageFields,
          headshot: storyImage,
          portrait: storyImage,
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
      case 'column':
        return {
          title: storyTitle || 'Expert Column',
          author: storyAuthor || 'Guest Contributor',
          category: String(story.premiumReaderContentType || 'Expert Column'),
          intro: storyStandfirst,
          text: storyText,
          ...commonImageFields,
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
      case 'feature-left':
      case 'feature-right':
        return {
          name: storyAuthor || 'Featured Guest',
          title: storyTitle || 'Feature Story',
          intro: storyStandfirst,
          text: storyText,
          ...commonImageFields,
          quote: storyQuote,
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
      case 'spotlight':
        return {
          title: storyTitle || 'Member Spotlight',
          name: storyAuthor || 'Member Name',
          role: storyStandfirst,
          bio: storyText,
          ...commonImageFields,
          headshot: storyImage,
          portrait: storyImage,
          message: storyQuote,
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
      case 'lifestyle':
        return {
          title: storyTitle || 'Lifestyle',
          kicker: 'Lifestyle',
          intro: storyStandfirst,
          text: storyText,
          ...commonImageFields,
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
      case 'partner':
        return {
          title: storyTitle || 'Partner Feature',
          brand: storyAuthor || 'Partner Name',
          headline: storyTitle || 'Partner Feature',
          text: storyText,
          ...commonImageFields,
          partnerLogo: storyImage,
          logoImage: storyImage,
          offer: storyStandfirst,
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
      case 'back-cover':
        return {
          title: storyTitle || 'Next Edition',
          text: storyText,
          ...commonImageFields,
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
      case 'full-page-ad': {
        const storyPdf = normalizeImageUrl(story?.pdfUrl || (story as any)?.pdf || '');
        return {
          title: storyTitle || 'Advertisement',
          ...commonImageFields,
          backgroundImage: storyImage,
          pdfUrl: storyPdf,
          alt: storyTitle || 'Advertisement',
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
      }
      default:
        return {
          title: storyTitle,
          intro: storyStandfirst,
          text: storyText,
          ...commonImageFields,
          sourceRef: story.sourceRef,
          storyId: story.id,
        };
    }
  }

  async function syncStoryLibrarySpreads(
    storyLibrary: any[],
    currentPages: MagazinePage[],
    options?: { suppressToast?: boolean },
  ) {
    if (isNew) {
      return currentPages;
    }

    const existingTypes = new Set(currentPages.map((p) => p.type).filter(Boolean));
    const existingKeys = new Set<string>();
    for (const page of currentPages) {
      for (const key of getPageIdentityKeys(page)) {
        existingKeys.add(key);
      }
    }

    let nextPages = [...currentPages];
    let nextPageNumber = nextPages.reduce((max, page) => Math.max(max, page.id || 0), 0);
    let createdCount = 0;

    const includedStories = Array.isArray(storyLibrary)
      ? storyLibrary.filter((story) => story && story.includedInPremiumReader !== false)
      : [];

    if (!existingTypes.has('cover')) {
      const highestPriorityStory = [...includedStories].sort((a, b) => {
        const ap = typeof a?.premiumReaderPriority === 'number' ? a.premiumReaderPriority : 999;
        const bp = typeof b?.premiumReaderPriority === 'number' ? b.premiumReaderPriority : 999;
        return ap - bp;
      })[0];
      const coverImageSource =
        normalizeImageUrl(issue?.coverImage) ||
        pickStoryImage(highestPriorityStory) ||
        '';
      const coverImage = coverImageSource;
      const coverTitle = String(issue?.title || highestPriorityStory?.title || 'New Edition').trim();
      const coverDescription = String(issue?.description || highestPriorityStory?.standfirst || '').trim();
      const newCoverPage = {
        id: ++nextPageNumber,
        type: 'cover' as const,
        generatedFromStoryLibrary: true,
        content: {
          title: coverTitle,
          kicker: 'Digital Edition',
          intro: coverDescription,
          body: coverDescription,
          image: coverImage,
          featureImage: coverImage,
          heroImage: coverImage,
          coverImage: coverImage,
          mainImage: coverImage,
          imageUrl: coverImage,
          images: coverImage ? [coverImage] : [],
          gallery: coverImage ? [coverImage] : [],
        },
        createdAt: new Date().toISOString(),
      };
      try {
        const res = await addMagazinePageAction(id, newCoverPage);
        if (res.success && res.id) {
          nextPages = [...nextPages, { ...newCoverPage, docId: String(res.id) }];
          createdCount += 1;
        }
      } catch (err: any) {
        console.warn('Failed to create cover spread:', err);
        nextPageNumber -= 1;
      }
    }

    if (!existingTypes.has('contents')) {
      const newContentsPage = {
        id: ++nextPageNumber,
        type: 'contents' as const,
        generatedFromStoryLibrary: true,
        content: {
          title: 'Contents',
          items: [],
        },
        createdAt: new Date().toISOString(),
      };
      try {
        const res = await addMagazinePageAction(id, newContentsPage);
        if (res.success && res.id) {
          nextPages = [...nextPages, { ...newContentsPage, docId: String(res.id) }];
          createdCount += 1;
        }
      } catch (err: any) {
        console.warn('Failed to create contents spread:', err);
        nextPageNumber -= 1;
      }
    }

    if (includedStories.length > 0) {
      const candidateStories = [...includedStories].sort((left, right) => {
        const leftPriority = typeof left?.premiumReaderPriority === 'number' ? left.premiumReaderPriority : 999;
        const rightPriority = typeof right?.premiumReaderPriority === 'number' ? right.premiumReaderPriority : 999;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return String(left?.title || '').localeCompare(String(right?.title || ''));
      });

      for (const story of candidateStories) {
        const storyKeys = getStoryIdentityKeys(story);
        if (storyKeys.length === 0 || storyKeys.some((key) => existingKeys.has(key))) {
          continue;
        }

        const type = inferBuilderPageTypeFromStory(story);
        const newPage = {
          id: ++nextPageNumber,
          type,
          storyId: String(story.id || '').trim() || undefined,
          sourceRef: String(story.sourceRef || '').trim() || undefined,
          generatedFromStoryLibrary: true,
          content: buildManualContentFromStory(story, type),
          createdAt: new Date().toISOString(),
        };

        let persisted: MagazinePage | null = null;
        try {
          const res = await addMagazinePageAction(id, newPage);
          if (!res.success || !res.id) {
            const msg = res.error || `Failed to add spread for "${story.title || 'Untitled Story'}"`;
            toast.error(msg);
            nextPageNumber -= 1;
            continue;
          }
          persisted = { ...newPage, docId: String(res.id) };
        } catch (err: any) {
          console.warn(`Failed to create spread for story "${story.title || ''}"`, err);
          nextPageNumber -= 1;
          continue;
        }

        nextPages = [...nextPages, persisted];
        createdCount += 1;

        for (const key of storyKeys) {
          existingKeys.add(key);
        }
        try {
          for (const key of getPageIdentityKeys(persisted)) {
            existingKeys.add(key);
          }
        } catch {
          /* noop */
        }
      }
    }

    if (!existingTypes.has('back-cover')) {
      const lastStory = [...includedStories]
        .sort((a, b) => {
          const ap = typeof a?.premiumReaderPriority === 'number' ? a.premiumReaderPriority : 999;
          const bp = typeof b?.premiumReaderPriority === 'number' ? b.premiumReaderPriority : 999;
          return bp - ap;
        })[0];
      const lastImageSource = pickStoryImage(lastStory) || normalizeImageUrl(issue?.coverImage) || '';
      const lastImage = lastImageSource;
      const lastTitle = String(lastStory?.title || 'See You Next Issue').trim();
      const newBackCoverPage = {
        id: ++nextPageNumber,
        type: 'back-cover' as const,
        generatedFromStoryLibrary: true,
        content: {
          title: 'See You Next Issue',
          kicker: 'Until Next Time',
          body: 'Thank you for reading Yorkshire BusinessWoman in our digital reader. Browse the archive for more editions and return soon for the next issue.',
          image: lastImage,
          featureImage: lastImage,
          heroImage: lastImage,
          mainImage: lastImage,
          coverImage: lastImage,
          imageUrl: lastImage,
          images: lastImage ? [lastImage] : [],
          gallery: lastImage ? [lastImage] : [],
          nextIssue: lastTitle,
          ctaLabel: 'Browse Archive',
          ctaHref: '/new-edition',
        },
        createdAt: new Date().toISOString(),
      };
      try {
        const res = await addMagazinePageAction(id, newBackCoverPage);
        if (res.success && res.id) {
          nextPages = [...nextPages, { ...newBackCoverPage, docId: String(res.id) }];
          createdCount += 1;
        }
      } catch (err: any) {
        console.warn('Failed to create back-cover spread:', err);
        nextPageNumber -= 1;
      }
    }

    if (createdCount > 0) {
      const sortedNextPages = [...nextPages].sort((left, right) => (left.id || 0) - (right.id || 0));
      try {
        await syncContentsPage(sortedNextPages);
      } catch (err) {
        console.warn('Contents page sync failed after spread creation:', err);
      }

      if (!options?.suppressToast) {
        toast.success(`Added ${createdCount} new spread${createdCount === 1 ? '' : 's'} from the Story Library`);
      }

      return sortedNextPages;
    }

    const sortedExisting = [...currentPages].sort((left, right) => (left.id || 0) - (right.id || 0));
    try {
      await syncContentsPage(sortedExisting);
    } catch (err) {
      console.warn('Contents page sync failed after no-op spread sync:', err);
    }
    return sortedExisting;
  }

  const handleApplyStoryToSelectedPage = async (story: any) => {
    await emitAndSync('page-saved', null, { forceSync: false });
    const selectedPage = pages.find((page) => page.docId === selectedPageId);
    if (!selectedPageId || !selectedPage) {
      toast.error('Select a spread first');
      return;
    }

    try {
      await handleImportContent(
        { _isManual: true, title: story.title, manualContent: buildManualContentFromStory(story, selectedPage.type) },
        selectedPage.type,
        selectedPageId,
      );
    } catch {
      toast.error('Failed to apply story to spread');
    }
  };

  // Page Handlers
  const handleAddPage = async (type: string) => {
    await emitAndSync('page-added', null, { forceSync: false });
    if (isNew) return;
    setSaving(true);
    try {
      const maxId = pages.reduce((max, p) => Math.max(max, p.id || 0), 0);
      const newPage = {
        id: maxId + 1,
        type,
        content: getInitialContent(type),
        createdAt: new Date().toISOString()
      };

      const res = await addMagazinePageAction(id, newPage, { skipSync: true });
      if (res.success) {
        const nextPages = [...pages, { ...newPage, docId: String(res.id) }];
        await syncContentsPage(nextPages);
        toast.success('Spread added successfully');
        await loadData(true);
        setSelectedPageId(res.id as string);
        setActiveTab('builder');
      }
    } catch (error) {
      toast.error('Failed to add page');
    } finally {
      setSaving(false);
      syncBuilderToReaderEditionAction(id, { revalidatePublicRoutesOnly: true }).catch((syncErr: any) => {
        console.warn('[handleAddPage] post-fire syncBuilderToReaderEdition non-fatal:', syncErr?.message || syncErr);
      });
    }
  };

  const handleImportContent = async (post: any, type: string, targetPageId?: string) => {
    await emitAndSync(post._isManual ? 'page-saved' : 'page-added', targetPageId || null, { forceSync: false });
    setSaving(true);
    try {
      let content: any = {};
      const templateType = targetPageId ? (pages.find(p => p.docId === targetPageId)?.type || type) : type;

      if (post._isManual) {
        // Handle manual raw import
        content = post.manualContent;
      } else {
        // Handle Ghost CMS import
        // Better extraction logic - preserve basic formatting
        const rawHTML = post.html || '';
        
        // Function to clean HTML but preserve specific tags
        const cleanForMagazine = (html: string) => {
          return html
            .replace(/<p[^>]*>/gi, '<p>') // Standardize paragraphs
            .replace(/<br\s*\/?>/gi, '<br />') // Standardize breaks
            .replace(/<[^>]*>?/gm, (tag) => {
              const allowed = ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'a', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3'];
              const tagName = tag.match(/<\/?([a-z0-9]+)/i)?.[1]?.toLowerCase();
              return allowed.includes(tagName || '') ? tag : '';
            })
            .replace(/&nbsp;/g, ' ')
            .trim();
        };

        const cleanText = cleanForMagazine(rawHTML);
        
        // Extract Subtitle/Standfirst from excerpt or first sentence (clean text version)
        const plainText = rawHTML.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        const subtitle = post.custom_excerpt || post.excerpt || plainText.split('. ')[0] + '.';
        
        // Extract Pullout Quote (Look for <blockquote> tags)
        const quoteMatch = rawHTML.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
        const pulloutQuote = quoteMatch 
          ? quoteMatch[1].replace(/<[^>]*>?/gm, '').trim() 
          : (post.custom_excerpt || plainText.substring(0, 150) + '...');

        switch (templateType) {
          case 'editorial':
            content = {
              title: post.title,
              author: post.primary_author?.name || 'Gill Laidler',
              role: 'Editor-in-Chief',
              featureImage: post.feature_image || '',
              text: cleanText, // Removed truncation limit
              quote: pulloutQuote,
              intro: subtitle
            };
            break;
          case 'column':
            content = {
              title: post.title,
              author: post.primary_author?.name || 'Expert Contributor',
              category: post.primary_tag?.name || 'Expert Column',
              featureImage: post.feature_image || '',
              text: cleanText, // Removed truncation limit
              tips: post.tags?.filter((t: any) => t.name !== post.primary_tag?.name).map((t: any) => t.name).slice(0, 5) || []
            };
            break;
          case 'feature-left':
            content = {
              name: post.primary_author?.name || 'Featured Guest',
              title: post.title || 'Feature Story',
              featureImage: post.feature_image || '',
              intro: subtitle,
              text: cleanText,
              quote: pulloutQuote
            };
            break;
          case 'feature-right':
            content = {
              name: post.primary_author?.name || '',
              title: post.title,
              quote: pulloutQuote,
              text: cleanText, // Removed truncation limit
              featureImage: post.feature_image || '',
              stats: [
                { label: 'READ TIME', value: `${post.reading_time || 5} MIN` },
                { label: 'TOPIC', value: post.primary_tag?.name?.toUpperCase() || 'NEWS' }
              ]
            };
            break;
          case 'lifestyle':
            content = {
              title: post.title,
              kicker: post.primary_tag?.name || 'Lifestyle',
              text: cleanText, // Removed truncation limit
              featureImage: post.feature_image || '',
              highlights: post.tags?.slice(0, 4).map((t: any) => t.name) || []
            };
            break;
          case 'spotlight':
            content = {
              title: post.title || 'Member Spotlight',
              name: post.primary_author?.name || 'Member Name',
              role: post.primary_tag?.name || 'Entrepreneur',
              featureImage: post.feature_image || '',
              message: pulloutQuote,
              bio: cleanText // Removed truncation limit
            };
            break;
          case 'partner':
            content = {
              brand: post.primary_author?.name || 'Partner Brand',
              title: post.title,
              headline: post.title,
              text: cleanText,
              offer: 'Exclusive Member Benefit',
              featureImage: post.feature_image || ''
            };
            break;
          case 'cover':
            content = {
              title: 'Yorkshire BusinessWoman',
              headline: post.title,
              subheadline: subtitle,
              date: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
              issue: 'LATEST',
              image: post.feature_image || '',
              featureImage: post.feature_image || ''
            };
            break;
          default:
            content = {
              title: post.title,
              author: post.primary_author?.name || 'YBW Team',
              featureImage: post.feature_image || '',
              text: cleanText, // Removed truncation limit
              name: post.title,
              intro: subtitle,
              category: post.primary_tag?.name || 'Editorial'
            };
        }
      }

      if (targetPageId) {
        // Update existing page
        const res = await updateMagazinePageAction(id, targetPageId, { content }, { skipSync: true });
        if (res.success) {
          const nextPages = pages.map((page) =>
            page.docId === targetPageId ? { ...page, content } : page,
          );
          await syncContentsPage(nextPages);
          toast.success(`Updated spread with content from "${post.title}"`);
          await loadData(true);
          setActiveTab('builder');
        } else {
          toast.error(res.error || 'Failed to import content');
        }
      } else {
        // Create new page
        const maxId = pages.reduce((max, p) => Math.max(max, p.id || 0), 0);
        const newPage = {
          id: maxId + 1,
          type,
          content,
          createdAt: new Date().toISOString()
        };

        const res = await addMagazinePageAction(id, newPage, { skipSync: true });
        if (res.success) {
          const nextPages = [...pages, { ...newPage, docId: String(res.id) }];
          await syncContentsPage(nextPages);
          toast.success(`Smart Imported "${post.title}" as ${type}`);
          
          const coverImageToSync = String(content.featureImage || content.image || '').trim();
          if (issue.autoSyncCover !== false && type === 'cover' && coverImageToSync) {
            await updateMagazineIssueAction(id, { coverImage: coverImageToSync });
            setIssue(prev => ({ ...prev, coverImage: coverImageToSync }));
            toast.info('Issue thumbnail updated from imported cover');
          }

          await loadData(true);
          setSelectedPageId(res.id as string);
          setActiveTab('builder');
        } else {
          toast.error(res.error || 'Failed to import content');
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import content');
    } finally {
      setSaving(false);
      syncBuilderToReaderEditionAction(id, { revalidatePublicRoutesOnly: true }).catch((syncErr: any) => {
        console.warn('[handleImportContent] post-fire syncBuilderToReaderEdition non-fatal:', syncErr?.message || syncErr);
      });
    }
  };

  const handleSavePageContent = async (pageDocId: string, content: any) => {
    await emitAndSync('page-saved', pageDocId, { forceSync: false });
    const shadowPage = readerEditionPages.find(p => p.docId === pageDocId);
    if (shadowPage?.readOnly) {
      toast.warning('Still finishing an automatic IDML sync for this page — please reload the page and try again in a moment.');
      return;
    }
    // Optimistically update local state to reflect changes immediately
    const nextPages = pages.map((p) =>
      p.docId === pageDocId ? { ...p, content } : p,
    );
    setPages(nextPages);
    
    setSaving(true);
    try {
      // PROACTIVE LOGIC: If this is a cover page, automatically sync its image to the issue metadata
      const page = pages.find(p => p.docId === pageDocId);
      const coverImageToSync = String(content?.featureImage || content?.image || '').trim();
      if (issue.autoSyncCover !== false && page?.type === 'cover' && coverImageToSync && coverImageToSync !== issue.coverImage) {
        console.log('Auto-syncing cover image from page to issue metadata...');
        await updateMagazineIssueAction(id, { coverImage: coverImageToSync });
        setIssue(prev => ({ ...prev, coverImage: coverImageToSync }));
        toast.info('Issue thumbnail synced from cover page');
      }

      const res = await updateMagazinePageAction(id, pageDocId, { content }, { skipSync: true });
      if (res.success) {
        await syncContentsPage(nextPages);
        toast.success('Spread content saved');
        // Re-load data to ensure server sync, but local state is already updated
        await loadData(false); 
      } else {
        toast.error(res.error || 'Failed to save content');
        await loadData(true);
      }
    } catch (error) {
      toast.error('Failed to save content');
      // Rollback on error if necessary
      await loadData(true);
    } finally {
      setSaving(false);
      syncBuilderToReaderEditionAction(id, { revalidatePublicRoutesOnly: true }).catch((syncErr: any) => {
        console.warn('[handleSavePageContent] post-fire syncBuilderToReaderEdition non-fatal:', syncErr?.message || syncErr);
      });
    }
  };

  const handleChangePageType = async (pageDocId: string, type: string) => {
    await emitAndSync('page-type-changed', pageDocId, { forceSync: false });
    const shadowPage = readerEditionPages.find(p => p.docId === pageDocId);
    if (shadowPage?.readOnly) {
      toast.warning('Still finishing an automatic IDML sync for this page — please reload the page and try again in a moment.');
      return;
    }
    const nextPages = pages.map((p) => (p.docId === pageDocId ? { ...p, type } : p));
    setPages(nextPages);

    setSaving(true);
    try {
      const res = await updateMagazinePageAction(id, pageDocId, { type }, { skipSync: true });
      if (res.success) {
        await syncContentsPage(nextPages);
        toast.success('Layout updated');
        await loadData(false);
      } else {
        toast.error(res.error || 'Failed to update layout');
        await loadData(true);
      }
    } catch (error) {
      toast.error('Failed to update layout');
      await loadData(true);
    } finally {
      setSaving(false);
      syncBuilderToReaderEditionAction(id, { revalidatePublicRoutesOnly: true }).catch((syncErr: any) => {
        console.warn('[handleChangePageType] post-fire syncBuilderToReaderEdition non-fatal:', syncErr?.message || syncErr);
      });
    }
  };

  const handleMovePage = async (pageDocId: string, direction: 'up' | 'down') => {
    await emitAndSync('page-reordered', pageDocId, { forceSync: false });
    const mergedPage = mergedDisplayedPages.find(p => p.docId === pageDocId);
    const shadowBacking =
      (mergedPage && (mergedPage as any)?._shadowDocId) ||
      readerEditionPages.some(p => p.docId === pageDocId) ||
      String(pageDocId || '').startsWith('reader:');
    if (mergedPage?.readOnly || shadowBacking) {
      toast.warning('Still finishing an automatic IDML sync for this page — please reload the page and try again in a moment.');
      return;
    }
    const sortedPages = sortByPrintOrder(pages);
    const currentIndex = sortedPages.findIndex((p) => p.docId === pageDocId);
    if (currentIndex === -1) {
      toast.warning('This spread has not finished syncing yet — please reload the page and try again in a moment.');
      return;
    }
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedPages.length - 1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const nextPages = [...sortedPages];
    const [movedPage] = nextPages.splice(currentIndex, 1);
    nextPages.splice(targetIndex, 0, movedPage);

    await persistPageOrder(nextPages);
  };

  const handleMovePageToPosition = async (pageDocId: string, targetPosition: number) => {
    await emitAndSync('page-reordered', pageDocId, { forceSync: false });
    const mergedPage = mergedDisplayedPages.find(p => p.docId === pageDocId);
    const shadowBacking =
      (mergedPage && (mergedPage as any)?._shadowDocId) ||
      readerEditionPages.some(p => p.docId === pageDocId) ||
      String(pageDocId || '').startsWith('reader:');
    if (mergedPage?.readOnly || shadowBacking) {
      toast.warning('Still finishing an automatic IDML sync for this page — please reload the page and try again in a moment.');
      return;
    }
    const sortedPages = sortByPrintOrder(pages);
    const currentIndex = sortedPages.findIndex((page) => page.docId === pageDocId);
    if (currentIndex === -1) {
      toast.warning('This spread has not finished syncing yet — please reload the page and try again in a moment.');
      return;
    }

    const boundedIndex = Math.max(0, Math.min(sortedPages.length - 1, targetPosition - 1));
    if (boundedIndex === currentIndex) return;

    const nextPages = [...sortedPages];
    const [movedPage] = nextPages.splice(currentIndex, 1);
    nextPages.splice(boundedIndex, 0, movedPage);

    await persistPageOrder(nextPages);
  };

  const resolveDeleteTargets = (pageDocId: string) => {
    const merged = mergedDisplayedPages.find(p => p.docId === pageDocId) as any;
    if (merged) {
      const legacyDocId = typeof merged?._legacyDocId === 'string' && merged._legacyDocId ? merged._legacyDocId : '';
      const shadowDocId = typeof merged?._shadowDocId === 'string' && merged._shadowDocId ? merged._shadowDocId : '';
      const finalLegacy = legacyDocId || (typeof pageDocId === 'string' && !pageDocId.startsWith('reader:') ? pageDocId : '');
      const finalShadow = shadowDocId || (typeof pageDocId === 'string' && pageDocId.startsWith('reader:') ? pageDocId : '');
      return { legacyDocId: finalLegacy, shadowDocId: finalShadow };
    }
    const legacyDocId = typeof pageDocId === 'string' && !pageDocId.startsWith('reader:') ? pageDocId : '';
    const shadowDocId = typeof pageDocId === 'string' && pageDocId.startsWith('reader:') ? pageDocId : '';
    return { legacyDocId, shadowDocId };
  };

  const handleDeleteAllPages = async () => {
    const allMerged = Array.isArray(mergedDisplayedPages) ? [...mergedDisplayedPages] : [];
    const totalPages = allMerged.filter((p) => p && typeof p.docId === 'string').length;
    const totalIdmlPublished = allMerged.filter(
      (p) => p?.readOnly || String(p?.docId || '').startsWith('reader:'),
    ).length;
    const totalManual = totalPages - totalIdmlPublished;

    if (totalPages === 0) {
      toast.warning('No spreads in this issue — nothing to delete.');
      return;
    }

    await emitAndSync('pages-all-deleted', null, { forceSync: false });

    const stage1 = confirm(
      `About to permanently delete ALL ${totalPages} spread${totalPages === 1 ? '' : 's'} ` +
        `(${totalIdmlPublished} published IDML spread${totalIdmlPublished === 1 ? '' : 's'}, ` +
        `${totalManual} manual/custom spread${totalManual === 1 ? '' : 's'}) from the builder. ` +
        `Continue to final confirmation?`
    );
    if (!stage1) return;

    const stage2 = confirm(
      `FINAL WARNING: This will destroy ${totalIdmlPublished > 0 ? `ALL ${totalIdmlPublished} published IDML spreads from the live reader edition` : 'all spreads'}. ` +
        `The ReaderEdition pages list will be cleared server-side and public routes will be invalidated. ` +
        `This cannot be undone manually — re-import the IDML file later if you need to restore. ` +
        `Type exactly what you want to do: DELETE EVERYTHING AND CLEAR READER`
    );
    if (!stage2) {
      toast.info('Delete All cancelled.');
      return;
    }

    setSaving(true);
    try {
      const generatedSpreadIds = new Set(
        allMerged
          .filter((p) => p && typeof p.docId === 'string' && Boolean(p.generatedFromStoryLibrary))
          .map((p) => String(p.docId))
      );
      if (generatedSpreadIds.size > 0 && Array.isArray(issue.storyLibrary)) {
        try {
          const allDeletedPageKeys = new Set<string>();
          for (const page of allMerged) {
            if (!page || typeof page.docId !== 'string') continue;
            if (!generatedSpreadIds.has(page.docId)) continue;
            try {
              const keys = getPageIdentityKeys(page);
              for (const k of keys || []) {
                if (typeof k === 'string' && k) allDeletedPageKeys.add(k);
              }
            } catch {
              /* skip page key extraction */
            }
          }
          if (allDeletedPageKeys.size > 0) {
            const nextStoryLibrary = issue.storyLibrary.map((story) => {
              try {
                const storyKeys = getStoryIdentityKeys(story);
                const matchesDeletedPage =
                  Array.isArray(storyKeys) &&
                  storyKeys.length > 0 &&
                  storyKeys.some((key) => typeof key === 'string' && allDeletedPageKeys.has(key));
                if (!matchesDeletedPage || story?.includedInPremiumReader === false) {
                  return story;
                }
                return { ...(story || {}), includedInPremiumReader: false };
              } catch {
                return story;
              }
            });
            const changedStoryLibrary = nextStoryLibrary.some(
              (story, index) =>
                story?.includedInPremiumReader !==
                issue.storyLibrary?.[index]?.includedInPremiumReader
            );
            if (changedStoryLibrary) {
              const storyLibraryRes = await saveMagazineStoryLibraryAction(
                id,
                nextStoryLibrary
              );
              if (!storyLibraryRes.success) {
                console.warn('[delete-all] Story Library dedupe non-fatal:', storyLibraryRes.error);
              } else {
                const persistedStoryLibrary = Array.isArray(storyLibraryRes.data)
                  ? storyLibraryRes.data
                  : nextStoryLibrary;
                setIssue((prev) => ({ ...prev, storyLibrary: persistedStoryLibrary }));
              }
            }
          }
        } catch (dedupeErr) {
          console.warn('[delete-all] Story Library dedupe failed — continuing with deletes', dedupeErr);
        }
      }

      const deletedLegacyDocIds = new Set<string>();
      const deletedShadowDocIds = new Set<string>();
      let firestoreDeleted = 0;
      let firestoreFailed = 0;

      const legacyDocIdsToDelete: string[] = [];
      for (const page of allMerged) {
        if (!page || typeof page.docId !== 'string') continue;

        const { legacyDocId, shadowDocId } = resolveDeleteTargets(page.docId);

        if (shadowDocId) {
          deletedShadowDocIds.add(shadowDocId);
        }

        if (legacyDocId) {
          if (!deletedLegacyDocIds.has(legacyDocId)) {
            legacyDocIdsToDelete.push(legacyDocId);
          }
        } else if (shadowDocId) {
          firestoreDeleted++;
        }
      }

      if (legacyDocIdsToDelete.length > 0) {
        const bulkRes = await bulkDeleteMagazinePagesAction(id, legacyDocIdsToDelete, { skipSync: true });
        if (bulkRes.success) {
          firestoreDeleted += legacyDocIdsToDelete.length;
          legacyDocIdsToDelete.forEach((did) => deletedLegacyDocIds.add(did));
        } else {
          firestoreFailed += legacyDocIdsToDelete.length;
        }
      }

      setSelectedPageId(null);
      didSpreadSyncOnTabRef.current = true;

      const remainingLegacyPages = Array.isArray(pages)
        ? pages.filter((p) => !p.docId || !deletedLegacyDocIds.has(p.docId))
        : [];
      const remainingShadowPages = Array.isArray(readerEditionPages)
        ? readerEditionPages.filter((p) => !p.docId || !deletedShadowDocIds.has(p.docId))
        : [];

      const mergedAfterDelete = (() => {
        const deduped: MagazinePage[] = [];
        const seenPositions = new Set<number>();
        const seenLegacyDocIds = new Set<string>();
        [...remainingLegacyPages, ...remainingShadowPages].forEach((page) => {
          if (!page || typeof page !== 'object') return;
          const docId = String((page as any).docId || '');
          if (!docId) return;
          if (docId.startsWith('reader:') === false) {
            if (seenLegacyDocIds.has(docId)) return;
            seenLegacyDocIds.add(docId);
          }
          const pos = typeof (page as any).position === 'number' ? (page as any).position : (typeof (page as any).pageNumber === 'number' ? (page as any).pageNumber : 0);
          if (docId.startsWith('reader:') && Number.isFinite(pos) && pos > 0) {
            if (seenPositions.has(pos)) return;
            seenPositions.add(pos);
          }
          deduped.push(page);
        });
        return deduped.sort((a: any, b: any) => {
          const pa = typeof a?.position === 'number' ? a.position : (typeof a?.pageNumber === 'number' ? a.pageNumber : 99999);
          const pb = typeof b?.position === 'number' ? b.position : (typeof b?.pageNumber === 'number' ? b.pageNumber : 99999);
          return pa - pb;
        });
      })();

      try {
        await syncContentsPage(mergedAfterDelete);
      } catch {
        /* Contents sync non-fatal */
      }

      setPages(sortByPrintOrder(remainingLegacyPages));
      setReaderEditionPages(remainingShadowPages);

      try {
        await syncBuilderToReaderEditionAction(id, { readerPagesOverride: mergedAfterDelete });
      } catch (syncErr) {
        console.warn('[delete-all] ReaderEdition post-delete sync non-fatal:', syncErr);
      }

      const remainingTotal = remainingLegacyPages.length + remainingShadowPages.length;
      const totalDeleted = totalPages - remainingTotal;

      if (firestoreFailed > 0) {
        toast.warning(
          `Deleted ${totalDeleted} spread${totalDeleted === 1 ? '' : 's'} from builder & reader. ` +
            `${firestoreFailed} Firestore delete(s) had errors. ${remainingTotal} remaining.`
        );
      } else if (totalDeleted === 0 && firestoreDeleted === 0) {
        toast.warning('No spreads were deleted.');
      } else {
        toast.success(
          `Deleted ${totalDeleted} spread${totalDeleted === 1 ? '' : 's'} from builder & live reader. ` +
            `${remainingTotal} spread${remainingTotal === 1 ? '' : 's'} remaining.`
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to delete spreads'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (pageDocId: string) => {
    if (typeof pageDocId !== 'string' || !pageDocId) return;

    await emitAndSync('page-deleted', pageDocId, { forceSync: false });

    const mergedPage = mergedDisplayedPages.find(p => p.docId === pageDocId) as any;
    const { legacyDocId, shadowDocId } = resolveDeleteTargets(pageDocId);

    const shadowPage = readerEditionPages.find(p => p.docId === (shadowDocId || pageDocId));
    const isReadOnlyPublished = Boolean(shadowPage?.readOnly);

    const pageToDelete =
      (legacyDocId ? pages.find((page) => page.docId === legacyDocId) : undefined)
      || pages.find((page) => page.docId === pageDocId)
      || mergedPage;
    const isGeneratedSpread = Boolean(pageToDelete?.generatedFromStoryLibrary);
    const confirmMessage = isReadOnlyPublished
      ? (isGeneratedSpread
          ? 'This published IDML spread AND its Story Library link will be removed from the live reader edition (cannot undo manually — re-import IDML later to restore). Delete this spread?'
          : 'This published IDML spread will be removed from the live reader edition (cannot undo manually — re-import IDML later to restore). Delete this spread?')
      : (isGeneratedSpread
          ? 'Are you sure you want to delete this spread? This will also stop it being regenerated from the Story Library.'
          : 'Are you sure you want to delete this spread?');

    if (!confirm(confirmMessage)) return;
    setSaving(true);
    try {
      if (isGeneratedSpread && pageToDelete && Array.isArray(issue.storyLibrary)) {
        try {
          const pageKeysArr = (() => {
            try {
              return getPageIdentityKeys(pageToDelete);
            } catch {
              return [] as string[];
            }
          })();
          const pageKeys = new Set<string>(
            Array.isArray(pageKeysArr) ? pageKeysArr.filter((k) => typeof k === 'string' && k) : []
          );
          if (pageKeys.size > 0) {
            const nextStoryLibrary = issue.storyLibrary.map((story) => {
              try {
                const storyKeys = getStoryIdentityKeys(story);
                const matchesDeletedPage =
                  Array.isArray(storyKeys) &&
                  storyKeys.length > 0 &&
                  storyKeys.some((key) => typeof key === 'string' && pageKeys.has(key));

                if (!matchesDeletedPage || story?.includedInPremiumReader === false) {
                  return story;
                }

                return {
                  ...(story || {}),
                  includedInPremiumReader: false,
                };
              } catch {
                return story;
              }
            });

            const changedStoryLibrary = nextStoryLibrary.some(
              (story, index) =>
                story?.includedInPremiumReader !==
                issue.storyLibrary?.[index]?.includedInPremiumReader,
            );

            if (changedStoryLibrary) {
              const storyLibraryRes = await saveMagazineStoryLibraryAction(id, nextStoryLibrary);
              if (!storyLibraryRes.success) {
                throw new Error(
                  storyLibraryRes.error || 'Failed to update Story Library inclusion',
                );
              }

              const persistedStoryLibrary = Array.isArray(storyLibraryRes.data)
                ? storyLibraryRes.data
                : nextStoryLibrary;

              setIssue((prev) => ({
                ...prev,
                storyLibrary: persistedStoryLibrary,
              }));
            }
          }
        } catch (dedupeErr) {
          console.warn('Delete page: dedupe/update step failed — still deleting page', dedupeErr);
        }
      }

      let firestoreOk = true;
      let firestoreErrMsg: string | undefined;
      if (legacyDocId) {
        const res = await deleteMagazinePageAction(id, legacyDocId, { skipSync: true });
        if (!res.success) {
          firestoreOk = false;
          firestoreErrMsg = res.error;
        }
      }

      const nextLegacyPages = legacyDocId
        ? pages.filter((page) => page.docId !== legacyDocId)
        : pages;
      const nextShadowPages = shadowDocId
        ? readerEditionPages.filter((page) => page.docId !== shadowDocId)
        : readerEditionPages;

      const combinedForContents = [
        ...nextLegacyPages,
        ...nextShadowPages.filter(
          (sp) => !nextLegacyPages.some((lp) => (
            (extractPrintPageNumberFromBuilderPage(lp) ?? 0) > 0
            && (extractPrintPageNumberFromBuilderPage(sp) ?? 0) === (extractPrintPageNumberFromBuilderPage(lp) ?? 0)
          )),
        ),
      ];

      try {
        await syncContentsPage(combinedForContents);
      } catch {}

      try {
        await syncBuilderToReaderEditionAction(id, { readerPagesOverride: combinedForContents });
      } catch (syncErr) {
        console.warn('[delete-page] ReaderEdition post-delete sync non-fatal:', syncErr);
      }

      didSpreadSyncOnTabRef.current = true;
      if (selectedPageId === pageDocId
        || (legacyDocId && selectedPageId === legacyDocId)
        || (shadowDocId && selectedPageId === shadowDocId)) {
        setSelectedPageId(null);
      }
      setPages(sortByPrintOrder(nextLegacyPages));
      setReaderEditionPages(nextShadowPages);

      if (!firestoreOk) {
        toast.warning(
          `Spread removed from builder list${firestoreErrMsg ? ` (Firestore: ${firestoreErrMsg})` : ''}.`,
        );
      } else {
        toast.success('Spread removed — click Smart Batch Fill or re-import IDML to regenerate.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error deleting spread');
    } finally {
      setSaving(false);
    }
  };

  const getInitialContent = (type: string) => {
    switch (type) {
      case 'cover': 
        return { 
          title: 'Yorkshire BusinessWoman', 
          headline: 'Edition Headline', 
          subheadline: 'Celebrating excellence and innovation across Yorkshire.', 
          date: issue.publishDate || new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), 
          issue: 'No. XX', 
          image: '',
          featureImage: ''
        };
      case 'editorial': 
        return { 
          title: 'Editor\'s Welcome', 
          author: 'Gill Laidler', 
          role: 'Editor-in-Chief', 
          featureImage: '',
          image: '',
          text: 'Welcome to this edition...', 
          quote: 'Empowering women in business across the region.' 
        };
      case 'contents': 
        return { 
          kicker: 'Contents',
          title: 'In This Issue',
          text: '',
          items: [
            { page: 2, category: 'EDITORIAL', title: 'Editor\'s Note' },
            { page: 4, category: 'FEATURE', title: 'Main Interview' }
          ], 
          news: ['Upcoming YBW Networking Event', 'New Member Benefits Launched'],
          newsLabel: 'Regional News'
        };
      case 'feature-left':
        return { 
          kicker: 'Feature',
          mediaLayout: 'side',
          name: 'Featured Guest', 
          title: 'Article Headline', 
          featureImage: '',
          image: '',
          intro: 'An inspiring story of leadership and innovation...' 
        };
      case 'feature-right': 
        return { 
          kicker: 'Feature',
          mediaLayout: 'side',
          name: 'Featured Guest',
          title: 'Feature Story',
          quote: 'Success is not final, failure is not fatal...', 
          text: 'The journey of building a brand in Yorkshire...', 
          stats: [{ label: 'READ TIME', value: '5 MIN' }], 
          featureImage: '',
          image: ''
        };
      case 'column': 
        return { 
          kicker: 'Column',
          mediaLayout: 'side',
          title: 'Expert Insights', 
          category: 'Finance & Growth', 
          author: 'Expert Name', 
          image: '',
          featureImage: '',
          text: 'In today\'s climate...', 
          tips: ['Plan ahead', 'Network often'],
          tipsLabel: 'Key Takeaways'
        };
      case 'lifestyle': 
        return { 
          kicker: 'Lifestyle',
          mediaLayout: 'side',
          title: 'Lifestyle Edit',
          highlightsLabel: 'Highlights',
          editorsPickLabel: 'Editor\'s Pick',
          text: 'Discover the balance between work and wellness...', 
          featureImage: '',
          image: '',
          highlights: ['Summer Style', 'Local Retreats'] 
        };
      case 'spotlight': 
        return { 
          title: 'Meet',
          mediaLayout: 'side',
          name: 'Member Name', 
          role: 'CEO, Company Ltd', 
          featureImage: '',
          image: '',
          message: 'Consistency is key to growth.', 
          bio: 'A brief history of their professional journey...' 
        };
      case 'partner': 
        return { 
          kicker: 'Partner Feature',
          mediaLayout: 'side',
          title: 'Partner Feature',
          brand: 'Partner Name', 
          headline: 'Premium Services for Members', 
          featureImage: '',
          image: '',
          offer: '20% Off for YBW Members' 
        };
      case 'full-page-ad':
        return {
          title: 'Advertisement',
          label: 'Advertisement',
          image: '',
          backgroundImage: '',
          videoUrl: '',
          linkUrl: '',
          alt: '',
        };
      case 'back-cover': 
        return { 
          kicker: 'Next Edition',
          mediaLayout: 'side',
          comingSoonLabel: 'Coming Soon',
          title: 'Next Edition',
          nextIssue: 'Coming Summer 2026', 
          cta: 'Become a Member Today',
          text: 'Yorkshire BusinessWoman magazine — celebrating the leaders, innovators and changemakers shaping our region.',
          socials: ['Instagram', 'LinkedIn', 'X'], 
          image: '',
          featureImage: ''
        };
      default: return {};
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <input
        ref={idmlFileInputRef}
        type="file"
        accept=".idml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setIdmlFileName(file.name);
            handleIdmlFileForSpreads(file);
          }
          if (idmlFileInputRef.current) idmlFileInputRef.current.value = '';
        }}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/magazine">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-serif font-bold">
              {isNew ? 'New Magazine Edition' : issue.title}
            </h1>
            <p className="text-sm text-muted-foreground">Digital Reader Builder & Content Manager</p>
          </div>
        </div>
          <div className="flex gap-2 flex-wrap items-center">
            {!isNew && (
              <>
                <Button
                  variant="outline"
                  onClick={() => idmlFileInputRef.current?.click()}
                  disabled={isIdmlImporting}
                  className="border-accent text-accent hover:bg-accent hover:text-white transition-all"
                >
                  {isIdmlImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Import IDML
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBatchSync}
                  disabled={isBatchSyncing || saving}
                  className="border-accent text-accent hover:bg-accent hover:text-white transition-all"
                >
                  {isBatchSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Smart Batch Fill
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/magazine/issue/${id}`} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Reader
                  </Link>
                </Button>
              </>
            )}
          <Button onClick={handleSaveIssue} disabled={saving} className="bg-accent hover:bg-accent/90 text-white min-w-[120px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isNew ? 'Create Edition' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="metadata" className="rounded-lg px-8">Issue Settings</TabsTrigger>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <TabsTrigger value="builder" className="rounded-lg px-8" disabled={isNew}>Spread Builder</TabsTrigger>
                </div>
              </TooltipTrigger>
              {isNew && <TooltipContent side="top">Save issue first to build spreads</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <TabsTrigger value="import" className="rounded-lg px-8" disabled={isNew}>Import CMS</TabsTrigger>
                </div>
              </TooltipTrigger>
              {isNew && <TooltipContent side="top">Save issue first to import content</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </TabsList>

        <TabsContent value="metadata" className="mt-0 space-y-8">
          {!isNew && (
            <div className="border border-accent/20 rounded-lg overflow-hidden w-full">
              <div className="bg-accent/5 px-4 py-3">
                <div className="flex items-start gap-2 text-accent">
                  <BookOpen className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-base font-serif font-semibold">Import InDesign (IDML)</h3>
                    <p className="text-[10px] text-muted-foreground">
                      Upload your full issue IDML to populate the Story Library and generate spreads automatically.
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-4 space-y-4 bg-background">
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  Upload a full <code className="bg-muted/30 px-1 py-0.5 rounded text-[11px]">.idml</code> export from InDesign.
                  Articles are extracted into the Story Library (including the Editor&rsquo;s Note and short profile/spotlight entries),
                  then a full spread structure is created: Cover → Contents → Articles (by priority) → Back cover.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      InDesign File
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-md border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground truncate">
                        {idmlFileName || 'No file selected'}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => idmlFileInputRef.current?.click()}
                        disabled={isIdmlImporting}
                        className="border-accent/30 text-accent hover:bg-accent hover:text-white transition-all whitespace-nowrap"
                      >
                        {isIdmlImporting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {isIdmlImporting ? 'Importing…' : 'Select .idml File'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => idmlFileInputRef.current?.click()}
                      disabled={isIdmlImporting}
                      className="bg-accent hover:bg-accent/90 text-white transition-all"
                    >
                      {isIdmlImporting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isIdmlImporting ? 'Importing IDML…' : 'Import & Build Spreads'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSyncReaderEditionToBuilder}
                      disabled={isSyncingReaderToBuilder || isIdmlImporting || isBatchSyncing || !readerEditionId}
                      title={
                        !readerEditionId
                          ? 'Publish via ManualImporter → Auto-Import IDML first (or link a ReaderEdition to this issue)'
                          : 'Convert the already-published IDML ReaderEdition pages into editable Story Library items + Builder spread pages (id=position), then auto-rebuild the Contents page links. Re-runnable; replaces spreads 1..N with latest from ReaderEdition.'
                      }
                      className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all whitespace-nowrap"
                    >
                      {isSyncingReaderToBuilder ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <BookOpen className="h-4 w-4 mr-2" />
                      )}
                      {isSyncingReaderToBuilder
                        ? 'Syncing…'
                        : readerEditionId
                          ? 'Sync Published IDML → Builder'
                          : 'Sync Published IDML → Builder (publish first)'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <IssueMetadata 
            issue={issue} 
            isNew={isNew} 
            isSaving={saving} 
            onUpdate={(data) => setIssue(prev => ({ ...prev, ...data }))}
            onSave={handleSaveIssue}
            pages={pages}
          />
        </TabsContent>

        <TabsContent value="builder" className="mt-0">
          <div className="mb-6 border border-accent/20 rounded-lg overflow-hidden w-full">
            <div className="bg-accent/5 px-4 py-3">
              <div className="flex items-start gap-2 text-accent">
                <BookOpen className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="text-base font-serif font-semibold">Import InDesign (IDML)</h3>
                  <p className="text-[10px] text-muted-foreground">
                    Populate the Story Library and auto-generate Cover, Contents, Article and Back-cover spreads.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 py-4 space-y-4 bg-background">
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Upload a full <code className="bg-muted/30 px-1 py-0.5 rounded text-[11px]">.idml</code> export.
                Every article is extracted into the Story Library (Editor&rsquo;s Note, spotlights and short profiles included),
                then spreads are created and ordered by priority: Cover → Contents → Articles → Back cover.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      InDesign File
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-md border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground truncate">
                        {idmlFileName || 'No file selected'}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => idmlFileInputRef.current?.click()}
                        disabled={isIdmlImporting || isNew}
                        className="border-accent/30 text-accent hover:bg-accent hover:text-white transition-all whitespace-nowrap"
                      >
                        {isIdmlImporting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {isIdmlImporting ? 'Importing…' : 'Select .idml File'}
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={() => idmlFileInputRef.current?.click()}
                    disabled={isIdmlImporting || isNew}
                    className="bg-accent hover:bg-accent/90 text-white transition-all sm:mt-6"
                  >
                    {isIdmlImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {isIdmlImporting ? 'Importing IDML…' : 'Import & Build Spreads'}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSyncReaderEditionToBuilder}
                  disabled={isSyncingReaderToBuilder || isIdmlImporting || isBatchSyncing || isNew || !readerEditionId}
                  title={
                    !readerEditionId
                      ? 'Publish via ManualImporter → Auto-Import IDML first (or link a ReaderEdition to this issue)'
                      : 'Convert the already-published IDML ReaderEdition pages into editable Story Library items + Builder spread pages (id=position). Re-runnable; replaces spreads 1..N with latest from ReaderEdition.'
                  }
                  className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all self-start"
                >
                  {isSyncingReaderToBuilder ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <BookOpen className="h-4 w-4 mr-2" />
                  )}
                  {isSyncingReaderToBuilder
                    ? 'Syncing Published IDML → Story Library + Spreads…'
                    : readerEditionId
                      ? 'Sync Published IDML → Story Library + Spreads'
                      : 'Sync Published IDML → Builder (publish via Auto-Import first)'}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-2 min-w-[200px]">
              <PageTypeSelector 
                onAddPage={handleAddPage}
                isSaving={saving}
              />
            </div>
            <div className="lg:col-span-3 min-w-[280px]">
              <PageList 
                pages={mergedDisplayedPages}
                selectedPageId={selectedPageId}
                readerSlug={(issue as any).slug || issue.readerEditionSlug || ''}
                onSelectPage={setSelectedPageId}
                onDeletePage={handleDeletePage}
                onDeleteAllPages={handleDeleteAllPages}
                onChangeType={(pageDocId, type) => {
                  handleChangePageType(pageDocId, type);
                }}
                onMovePage={handleMovePage}
                onMovePageTo={handleMovePageToPosition}
                isSaving={saving}
              />
            </div>
            <div className="lg:col-span-3 min-w-[320px]">
              <div className="lg:sticky lg:top-6">
                <StoryLibraryPanel
                  stories={issue.storyLibrary || []}
                  selectedPage={mergedDisplayedPages.find(p => p.docId === selectedPageId)}
                  isSaving={saving}
                  onApplyStory={handleApplyStoryToSelectedPage}
                  onToggleInclusion={handleToggleStoryLibraryInclusion}
                  onRemoveStory={handleRemoveStoryLibraryItem}
                  onDeleteAll={handleDeleteStoryLibraryAll}
                />
              </div>
            </div>
            <div className="lg:col-span-4">
              <PageEditor 
                page={mergedDisplayedPages.find(p => p.docId === selectedPageId)}
                onSave={(content) => {
                  if (selectedPageId) {
                    handleSavePageContent(selectedPageId, content);
                  }
                }}
                onChangeType={(type) => {
                  if (selectedPageId) {
                    handleChangePageType(selectedPageId, type);
                  }
                }}
                isSaving={saving}
                readOnly={Boolean(mergedDisplayedPages.find(p => p.docId === selectedPageId)?.readOnly)}
              />
            </div>
          </div>
        </TabsContent>

            <TabsContent value="import" className="mt-0">
              <div className="space-y-6">
                <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg flex items-start gap-4">
                  <div className="bg-accent p-2 rounded-full text-white shadow-lg">
                    <Save className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-accent">Import & Integration</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Choose to import from Ghost CMS for existing articles, or use <strong>Manual Import</strong> to paste raw text and images directly into your template.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <GhostImporter 
                      onImport={handleImportContent} 
                      isImporting={saving}
                      selectedPageId={selectedPageId || undefined}
                      selectedPageType={pages.find(p => p.docId === selectedPageId)?.type}
                    />
                  </div>
                  <ManualImporter 
                    onImport={handleImportContent}
                    isImporting={saving}
                    selectedPageId={selectedPageId || undefined}
                    selectedPageType={pages.find(p => p.docId === selectedPageId)?.type}
                    selectedPage={pages.find(p => p.docId === selectedPageId)}
                    issueId={id}
                    storyLibrary={issue.storyLibrary || []}
                    onSaveStoryLibrary={handleSaveStoryLibrary}
                    onStoryLibraryImported={handleStoryLibraryImported}
                    onAfterPublish={() => loadData(true)}
                  />
                </div>
              </div>
            </TabsContent>
      </Tabs>
    </div>
  );
}
