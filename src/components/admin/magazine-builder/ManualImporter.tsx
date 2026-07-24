'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Image as ImageIcon, ClipboardPaste, Loader2, CheckCircle2, FileDown, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import type { ReaderPage } from '@/features/magazine/domain/types';
import { importIdmlFromUrlAction, publishIdmlEditionAction, saveIdmlDraft, loadLatestIdmlDraft, deleteIdmlDraft, extractIdmlStoryLibraryAction } from '@/app/actions/magazineActions';

const decodeXmlEntities = (value: string) => {
  try {
    const doc = new DOMParser().parseFromString(value, 'text/html');
    return doc.documentElement.textContent || '';
  } catch {
    return value
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
};

const normalizeWhitespace = (value: string) => {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const deriveStandfirst = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';

  const sentence = normalized.split(/\n{2,}/)[0]?.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (!sentence) return '';
  return sentence.length <= 180 ? sentence : `${sentence.slice(0, 180).trimEnd()}...`;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

function mergeStoryLibraryItems(existing: StoryLibraryItem[], incoming: StoryLibraryItem[]) {
  const incomingPaths = new Set(
    incoming.map((item) => `${item.source?.fileName || ''}::${item.source?.path || ''}`).filter((value) => value !== '::'),
  );

  const preservedExisting = existing.filter((item) => {
    const key = `${item.source?.fileName || ''}::${item.source?.path || ''}`;
    if (key === '::') return true;
    return !incomingPaths.has(key);
  });

  return [...incoming, ...preservedExisting].slice(0, 150);
}

const extractInDesignTextAndImageHints = (xml: string) => {
  const contentMatches = [...xml.matchAll(/<Content>([\s\S]*?)<\/Content>/g)];
  const rawPieces = contentMatches.map((m) => decodeXmlEntities(m[1] || '').trim()).filter(Boolean);

  const text = normalizeWhitespace(
    rawPieces
      .join('\n')
      .replace(/\n{2,}/g, '\n\n')
  );

  const title = normalizeWhitespace(rawPieces[0] || '').split('\n')[0] || '';

  const fileNameMatches = [
    ...xml.matchAll(/LinkResourceURI="file:[^"]*\/([^"\/]+\.(?:png|jpe?g|webp|gif|svg))"/gi),
    ...xml.matchAll(/LinkResourceURI="[^"]*\/([^"\/]+\.(?:png|jpe?g|webp|gif|svg))"/gi),
    ...xml.matchAll(/(?:href|src)="[^"]*\/([^"\/]+\.(?:png|jpe?g|webp|gif|svg))"/gi),
  ];
  const imageFileNames = Array.from(
    new Set(
      fileNameMatches
        .map((m) => String(m[1] || '').trim())
        .filter(Boolean)
    )
  );

  return { title, text, imageFileNames };
};

export interface ManualImporterProps {
  onImport: (content: any, type: string, targetPageId?: string) => Promise<void>;
  isImporting: boolean;
  selectedPageId?: string;
  selectedPageType?: string;
  issueId?: string;
  storyLibrary?: StoryLibraryItem[];
  onSaveStoryLibrary?: (storyLibrary: StoryLibraryItem[]) => Promise<void>;
}

type ParsedInDesignStory = {
  path: string;
  title: string;
  text: string;
  imageUrl?: string;
  imageFileNames: string[];
  preview: string;
  length: number;
};

type IdmlDraftMeta = {
  title: string;
  description: string;
  coverImage: string;
};

const createStoryId = () => {
  const anyCrypto = globalThis.crypto as undefined | { randomUUID?: () => string };
  const uuid = anyCrypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isIncludedInPremiumReader = (item: StoryLibraryItem) => item.includedInPremiumReader !== false;

const deriveIdmlDraftStats = (pages: ReaderPage[]) => {
  const safePages = Array.isArray(pages) ? pages : [];
  const imageCount = safePages.reduce((count, page) => {
    const content = page?.content || {};
    return count + (content.imageUrl || content.backgroundImage ? 1 : 0);
  }, 0);

  const storyCount = safePages.filter((page) => {
    const content = page?.content || {};
    return Boolean(String(content.title || '').trim() || String(content.body || '').trim());
  }).length;

  return {
    pageCount: safePages.length,
    storyCount,
    imageCount,
  };
};

const buildFallbackIdmlDraftMeta = (pages: ReaderPage[], fileName: string): IdmlDraftMeta => {
  const safePages = Array.isArray(pages) ? pages : [];
  const coverPage = safePages[0];
  const fallbackTitle =
    String(coverPage?.content?.title || '').trim() ||
    String(fileName || '').replace(/\.idml$/i, '').trim() ||
    'Imported Edition';

  const fallbackDescription =
    String(coverPage?.content?.standfirst || '').trim() ||
    String(coverPage?.content?.body || '').trim().slice(0, 180) ||
    'Imported from IDML';

  const fallbackCoverImage =
    String(
      coverPage?.content?.imageUrl ||
      coverPage?.content?.backgroundImage ||
      '',
    ).trim();

  return {
    title: fallbackTitle,
    description: fallbackDescription,
    coverImage: fallbackCoverImage,
  };
};

export function ManualImporter({
  onImport,
  isImporting,
  selectedPageId,
  selectedPageType,
  issueId,
  storyLibrary,
  onSaveStoryLibrary,
}: ManualImporterProps) {
  const [rawText, setRawText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [imageHints, setImageHints] = useState<string[]>([]);
  const [idmlStories, setIdmlStories] = useState<ParsedInDesignStory[]>([]);
  const [selectedStoryPath, setSelectedStoryPath] = useState<string>('');
  const [idmlFileName, setIdmlFileName] = useState<string>('');
  const [contentsDraftItems, setContentsDraftItems] = useState<Array<{ page: string; category: string; title: string }>>([]);
  const [contentsDraftPage, setContentsDraftPage] = useState('');
  const [contentsDraftCategory, setContentsDraftCategory] = useState('');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [activeLibraryId, setActiveLibraryId] = useState<string>('');
  const [serverIdmlPages, setServerIdmlPages] = useState<ReaderPage[]>([]);
  const [serverIdmlMeta, setServerIdmlMeta] = useState<IdmlDraftMeta | null>(null);
  const [serverIdmlStats, setServerIdmlStats] = useState<{ pageCount: number; storyCount: number; imageCount: number } | null>(null);
  const [isServerIdmlParsing, setIsServerIdmlParsing] = useState(false);
  const [isServerIdmlPublishing, setIsServerIdmlPublishing] = useState(false);
  const [serverIdmlFileName, setServerIdmlFileName] = useState('');
  const [showServerIdmlPreview, setShowServerIdmlPreview] = useState(false);
  const [serverIdmlDraftId, setServerIdmlDraftId] = useState('');

  const safeStoryLibrary = Array.isArray(storyLibrary) ? storyLibrary.filter(Boolean) : [];
  const includedStoryCount = safeStoryLibrary.filter(isIncludedInPremiumReader).length;
  const effectiveServerIdmlMeta =
    serverIdmlMeta || (serverIdmlPages.length > 0 ? buildFallbackIdmlDraftMeta(serverIdmlPages, serverIdmlFileName) : null);
  const effectiveServerIdmlStats =
    serverIdmlStats || (serverIdmlPages.length > 0 ? deriveIdmlDraftStats(serverIdmlPages) : null);
  const hasRecoverableServerIdmlDraft = Boolean(serverIdmlDraftId || serverIdmlFileName || serverIdmlPages.length > 0);
  const canRenderServerIdmlControls = Boolean(
    hasRecoverableServerIdmlDraft && effectiveServerIdmlMeta && serverIdmlPages.length > 0,
  );
  const renderableServerIdmlMeta = canRenderServerIdmlControls ? effectiveServerIdmlMeta : null;

  useEffect(() => {
    loadLatestIdmlDraft().then((result) => {
      if (result.success && result.data) {
        const draft = result.data as any;
        const draftPages = Array.isArray(draft.pages) ? draft.pages : [];
        setServerIdmlPages(draftPages);
        setServerIdmlMeta(draft.metadata || (draftPages.length > 0 ? buildFallbackIdmlDraftMeta(draftPages, draft.fileName || '') : null));
        setServerIdmlStats(draft.stats || (draftPages.length > 0 ? deriveIdmlDraftStats(draftPages) : null));
        setServerIdmlFileName(draft.fileName || '');
        setServerIdmlDraftId(draft.id || '');
        setShowServerIdmlPreview(draftPages.length > 0);
      }
    }).catch(() => {});
  }, []);

  const applyInDesignStory = (story: ParsedInDesignStory) => {
    if (story.title) setTitle(story.title);
    setRawText(story.text);
    setImageHints(story.imageFileNames);

    const firstHit = story.imageFileNames.find((name) => imageMap[name]);
    if (firstHit) {
      setImageUrl(imageMap[firstHit]);
      return;
    }

    setImageUrl(String(story.imageUrl || '').trim());
  };

  const handleAddSelectedStoryToContents = () => {
    const fromIdml = idmlStories.find((s) => s.path === selectedStoryPath);
    const draftTitle =
      String(fromIdml?.title || '').trim() ||
      String(title || '').trim() ||
      fromIdml?.preview ||
      normalizeWhitespace(rawText).replace(/\s+/g, ' ').slice(0, 140) ||
      fromIdml?.path?.replace('Stories/', '') ||
      '';

    if (!draftTitle) {
      toast.error('Choose a story (or load one into the editor) first');
      return;
    }

    const page = String(contentsDraftPage || '').trim();
    const category = String(contentsDraftCategory || '').trim();

    setContentsDraftItems((prev) => [
      ...prev,
      { page, category, title: draftTitle },
    ]);

    if (page) {
      const nextNum = Number.parseInt(page, 10);
      if (Number.isFinite(nextNum)) setContentsDraftPage(String(nextNum + 1));
      else setContentsDraftPage('');
    } else {
      setContentsDraftPage('');
    }
  };

  const applyStoryLibraryItem = (item: StoryLibraryItem) => {
    setActiveLibraryId(item.id);
    setTitle(String(item.title || '').trim());
    setAuthor(String(item.author || '').trim());
    setRawText(String(item.text || ''));

    const hints = Array.isArray(item.imageFileNames) ? item.imageFileNames.map((n) => String(n || '').trim()).filter(Boolean) : [];
    setImageHints(hints);

    const firstHit = hints.find((name) => imageMap[name]);
    if (firstHit) {
      setImageUrl(imageMap[firstHit]);
      return;
    }

    setImageUrl(String(item.imageUrl || '').trim());
  };

  const saveStoryLibrary = async (next: StoryLibraryItem[]) => {
    if (!onSaveStoryLibrary) {
      toast.error('Story library saving is not available here');
      return;
    }
    if (!issueId) {
      toast.error('Please create the edition first');
      return;
    }
    await onSaveStoryLibrary(next);
  };

  const handleSaveSelectedStoryToLibrary = async () => {
    const fromIdml = idmlStories.find((s) => s.path === selectedStoryPath);
    const cleanTitle = String(fromIdml?.title || title || '').trim();
    const cleanText = String(fromIdml?.text || rawText || '').trim();
    if (!cleanText) {
      toast.error('No story text to save');
      return;
    }

    const imageFileNames = Array.isArray(fromIdml?.imageFileNames) ? fromIdml!.imageFileNames : imageHints;
    const item: StoryLibraryItem = {
      id: createStoryId(),
      title: cleanTitle || 'Untitled Story',
      author: String(author || '').trim() || undefined,
      standfirst: deriveStandfirst(cleanText) || undefined,
      text: cleanText,
      imageUrl: String(fromIdml?.imageUrl || imageUrl || '').trim() || undefined,
      includedInPremiumReader: true,
      premiumReaderPriority: 40,
      premiumReaderContentType: 'feature',
      premiumReaderPlacementPreference: 'auto',
      imageFileNames: Array.isArray(imageFileNames) ? imageFileNames : undefined,
      source: fromIdml
        ? { type: 'idml', fileName: idmlFileName || undefined, path: fromIdml.path }
        : { type: 'manual' },
      createdAt: new Date().toISOString(),
    };

    const next = [item, ...safeStoryLibrary].slice(0, 100);
    try {
      await saveStoryLibrary(next);
      toast.success('Saved to Story Library');
      setActiveLibraryId(item.id);
    } catch {
      toast.error('Failed to save story');
    }
  };

  const handleRemoveFromStoryLibrary = async (storyId: string) => {
    const next = safeStoryLibrary.filter((s) => s.id !== storyId);
    try {
      await saveStoryLibrary(next);
      if (activeLibraryId === storyId) setActiveLibraryId('');
      toast.success('Removed from Story Library');
    } catch {
      toast.error('Failed to remove story');
    }
  };

  const handleTogglePremiumReaderInclusion = async (storyId: string) => {
    const next = safeStoryLibrary.map((item) =>
      item.id === storyId
        ? {
            ...item,
            includedInPremiumReader: !isIncludedInPremiumReader(item),
          }
        : item,
    );

    try {
      await saveStoryLibrary(next);
      toast.success('Premium reader inclusion updated');
    } catch {
      toast.error('Failed to update premium reader inclusion');
    }
  };

  const handleApplyContentsListToSelectedPage = async () => {
    if (!selectedPageId || selectedPageType !== 'contents') {
      toast.error('Select your Contents page first');
      return;
    }

    const items = contentsDraftItems
      .map((item) => ({
        page: String(item.page || '').trim(),
        category: String(item.category || '').trim(),
        title: String(item.title || '').trim(),
      }))
      .filter((item) => item.page || item.title || item.category);

    if (items.length === 0) {
      toast.error('Add at least one contents item first');
      return;
    }

    try {
      await onImport({ _isManual: true, manualContent: { items } }, 'contents', selectedPageId);
      toast.success('Contents list applied');
    } catch {
      toast.error('Failed to apply contents list');
    }
  };

  const handleManualImport = async () => {
    if (!selectedPageId || !selectedPageType) {
      toast.error('Please select a page and template first');
      return;
    }

    if (!rawText && !imageUrl) {
      toast.error('Please provide at least some text or an image URL');
      return;
    }

    // Map manual fields to the selected template type
    const manualContent: any = {};
    
    switch (selectedPageType) {
      case 'editorial':
        manualContent.title = title || 'Editorial';
        manualContent.author = author || 'Gill Laidler';
        manualContent.text = rawText;
        manualContent.image = imageUrl;
        break;
      case 'column':
        manualContent.title = title || 'Expert Column';
        manualContent.author = author || 'Guest Contributor';
        manualContent.text = rawText;
        manualContent.image = imageUrl;
        break;
      case 'feature-left': case'feature-right':
        manualContent.name = author || 'Featured Guest';
        manualContent.title = title || 'Feature Story';
        manualContent.text = rawText;
        manualContent.image = imageUrl;
        manualContent.quote = rawText.substring(0, 100) + '...';
        break;
      case 'spotlight':
        manualContent.title = title || 'Member Spotlight';
        manualContent.name = author || 'Member Name';
        manualContent.bio = rawText;
        manualContent.image = imageUrl;
        break;
      case 'lifestyle':
        manualContent.title = title || 'Lifestyle';
        manualContent.text = rawText;
        manualContent.image = imageUrl;
        break;
      case 'partner':
        manualContent.title = title || 'Partner Feature';
        manualContent.brand = author || 'Partner Name';
        manualContent.headline = title || 'Partner Feature';
        manualContent.text = rawText;
        manualContent.image = imageUrl;
        break;
      case 'back-cover':
        manualContent.title = title || 'Next Edition';
        manualContent.text = rawText;
        manualContent.image = imageUrl;
        break;
      case 'full-page-ad':
        manualContent.title = title || 'Advertisement';
        manualContent.image = imageUrl;
        manualContent.alt = title || 'Advertisement';
        break;
      default:
        manualContent.text = rawText;
        manualContent.image = imageUrl;
        manualContent.title = title;
    }

    // Mock a post object for the existing onImport handler
    // Our handleImportContent in page.tsx expects (post, type, targetPageId)
    // But we can modify it or pass a custom object.
    // Actually, looking at handleImportContent, it expects a Ghost post.
    // I should probably modify handleImportContent to handle raw objects too.
    
    try {
      // We pass a special flag or structure that the parent can recognize
      await onImport({ _isManual: true, manualContent }, selectedPageType, selectedPageId);
      toast.success('Manual content imported!');
      setRawText('');
      setImageUrl('');
      setTitle('');
      setAuthor('');
    } catch (err) {
      toast.error('Failed to import manual content');
    }
  };

  const handleImportFromInDesignFile = async (file: File) => {
    setIsParsing(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'idml') {
        setIdmlFileName(file.name);
        const fileBuffer = await file.arrayBuffer();
        const idmlBase64 = arrayBufferToBase64(fileBuffer);
        const res = await extractIdmlStoryLibraryAction(idmlBase64, file.name);

        if (!res.success || !res.data) {
          toast.error(res.error || 'Failed to extract stories from IDML');
          return;
        }

        const importedItems = Array.isArray(res.data.storyLibrary) ? res.data.storyLibrary : [];
        const stories: ParsedInDesignStory[] = importedItems.map((item) => {
          const cleanText = normalizeWhitespace(String(item.text || ''));
          return {
            path: String(item.source?.path || item.sourceRef || item.title || createStoryId()),
            title: String(item.title || '').trim(),
            text: cleanText,
            imageUrl: String(item.imageUrl || '').trim() || undefined,
            imageFileNames: Array.isArray(item.imageFileNames) ? item.imageFileNames : [],
            preview: cleanText.replace(/\s+/g, ' ').slice(0, 180),
            length: cleanText.length,
          };
        });

        if (stories.length === 0) {
          toast.error('No article-level stories found in that IDML file');
          return;
        }

        const sorted = [...stories];
        setIdmlStories(sorted);
        const initial = sorted[0];
        setSelectedStoryPath(initial.path);
        applyInDesignStory(initial);

        if (issueId && issueId !== 'new' && onSaveStoryLibrary) {
          const nextLibrary = mergeStoryLibraryItems(safeStoryLibrary, importedItems);
          await saveStoryLibrary(nextLibrary);
          toast.success(`Imported ${importedItems.length} IDML articles into the Story Library`);
          return;
        }

        toast.success(`Imported ${importedItems.length} IDML articles`);
        return;
      }

      setIdmlFileName('');
      setIdmlStories([]);
      setSelectedStoryPath('');
      const xml = await file.text();
      const parsed = extractInDesignTextAndImageHints(xml);
      if (!parsed.text) {
        toast.error('No text found in that file');
        return;
      }
      if (parsed.title) setTitle(parsed.title);
      setRawText(parsed.text);
      setImageHints(parsed.imageFileNames);

      const firstHit = parsed.imageFileNames.find((name) => imageMap[name]);
      if (firstHit) setImageUrl(imageMap[firstHit]);

      toast.success('Imported text from InDesign file');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to parse file');
    } finally {
      setIsParsing(false);
    }
  };

  const uploadOneImage = async (file: File) => {
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('folder', 'magazine-import');
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData });
    if (!uploadRes.ok) {
      const uploadData = await uploadRes.json().catch(() => ({}));
      throw new Error(uploadData?.error || 'Failed to upload image');
    }
    const { url } = await uploadRes.json();
    if (!url) throw new Error('Upload returned no URL');
    return String(url);
  };

  const handleUploadImages = async (files: FileList) => {
    setIsUploadingImages(true);
    try {
      const nextMap: Record<string, string> = { ...imageMap };
      for (const file of Array.from(files)) {
        const url = await uploadOneImage(file);
        nextMap[file.name] = url;
      }
      setImageMap(nextMap);

      const firstHint = imageHints.find((name) => nextMap[name]);
      if (firstHint) setImageUrl(nextMap[firstHint]);
      else {
        const firstUploaded = Object.values(nextMap)[0];
        if (firstUploaded && !imageUrl) setImageUrl(firstUploaded);
      }

      toast.success('Images uploaded');
    } catch (e: any) {
      toast.error(e?.message || 'Image upload failed');
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleServerIdmlImport = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'idml') {
      toast.error('Please select an .idml file');
      return;
    }

    if (!storage) {
      toast.error('Firebase Storage not configured');
      return;
    }

    setIsServerIdmlParsing(true);
    setServerIdmlFileName(file.name);
    setShowServerIdmlPreview(false);
    setServerIdmlPages([]);
    setServerIdmlMeta(null);
    setServerIdmlStats(null);

    try {
      toast.info('Uploading file to Firebase Storage...');

      const filePath = `magazine-import/${file.name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const fileUrl: string = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            toast.info(`Uploading: ${pct}%`, { id: 'upload-progress' });
          },
          (error) => reject(error),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          },
        );
      });

      toast.info('Parsing IDML on server...', { id: 'upload-progress' });

      const result = await importIdmlFromUrlAction(fileUrl, file.name);

      if (!result.success) {
        toast.error(result.error || 'Failed to parse IDML', { id: 'upload-progress' });
        return;
      }

      setServerIdmlPages(result.data!.pages);
      setServerIdmlMeta(result.data!.metadata);
      const stats = {
        pageCount: result.data!.pageCount,
        storyCount: result.data!.storyCount,
        imageCount: result.data!.imageCount,
      };
      setServerIdmlStats(stats);
      setShowServerIdmlPreview(true);

      const draftId = serverIdmlDraftId || `draft-${Date.now().toString(36)}`;
      setServerIdmlDraftId(draftId);
      saveIdmlDraft({
        id: draftId,
        pages: result.data!.pages,
        metadata: result.data!.metadata,
        stats,
        fileName: file.name,
      }).catch(() => {});

      toast.success(`Parsed ${result.data!.pageCount} pages, ${result.data!.storyCount} stories, ${result.data!.imageCount} images`, { id: 'upload-progress' });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to import IDML', { id: 'upload-progress' });
    } finally {
      setIsServerIdmlParsing(false);
    }
  };

  const handlePublishIdmlEdition = async () => {
    const publishMeta = effectiveServerIdmlMeta;
    if (serverIdmlPages.length === 0 || !publishMeta) return;

    setIsServerIdmlPublishing(true);
    try {
      const result = await publishIdmlEditionAction({
        pages: serverIdmlPages,
        title: publishMeta.title,
        description: publishMeta.description,
        coverImage: publishMeta.coverImage,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to publish');
        return;
      }

      toast.success(`Published "${publishMeta.title}" (${serverIdmlPages.length} pages)`);
      if (serverIdmlDraftId) {
        deleteIdmlDraft(serverIdmlDraftId).catch(() => {});
      }
      setServerIdmlPages([]);
      setServerIdmlMeta(null);
      setServerIdmlStats(null);
      setShowServerIdmlPreview(false);
      setServerIdmlDraftId('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to publish edition');
    } finally {
      setIsServerIdmlPublishing(false);
    }
  };

  const handleUpdateServerIdmlTitle = (newTitle: string) => {
    setServerIdmlMeta((prev) => {
      const next = { ...(prev || buildFallbackIdmlDraftMeta(serverIdmlPages, serverIdmlFileName)), title: newTitle };
      if (serverIdmlDraftId && serverIdmlPages.length > 0) {
        saveIdmlDraft({
          id: serverIdmlDraftId,
          pages: serverIdmlPages,
          metadata: next,
          stats: effectiveServerIdmlStats || { pageCount: 0, storyCount: 0, imageCount: 0 },
          fileName: serverIdmlFileName,
        }).catch(() => {});
      }
      return next;
    });
  };

  const handleClearIdmlDraft = async () => {
    if (serverIdmlDraftId) {
      await deleteIdmlDraft(serverIdmlDraftId).catch(() => {});
    }
    setServerIdmlPages([]);
    setServerIdmlMeta(null);
    setServerIdmlStats(null);
    setShowServerIdmlPreview(false);
    setServerIdmlDraftId('');
    setServerIdmlFileName('');
    toast.success('IDML draft cleared');
  };

  const normalizedLibraryQuery = libraryQuery.trim().toLowerCase();
  const filteredStoryLibrary = normalizedLibraryQuery
    ? safeStoryLibrary.filter((s) => {
        const haystack = `${s.title || ''} ${s.author || ''}`.toLowerCase();
        return haystack.includes(normalizedLibraryQuery);
      })
    : safeStoryLibrary;

  return (
    <Card className="border-accent/20">
      <CardHeader className="bg-accent/5">
        <div className="flex items-center gap-2 text-accent">
          <ClipboardPaste className="h-5 w-5" />
          <CardTitle className="text-lg">Quick Paste / Manual Import</CardTitle>
        </div>
        <CardDescription>
          Paste text and images directly into your selected template.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {!selectedPageId ? (
          <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/20">
            <p className="text-sm text-muted-foreground">Select a page on the left first to use manual import.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title / Headline</Label>
                <Input 
                  placeholder="Enter title..." 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Author / Person Name</Label>
                <Input 
                  placeholder="Enter name..." 
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Image URL (Firebase/Ghost/Public)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="https://..." 
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <Button variant="outline" size="icon" className="shrink-0">
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Body Content / Raw Text</Label>
              <Textarea 
                placeholder="Paste your article text here..." 
                rows={10}
                className="font-serif text-base leading-relaxed"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </div>

            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-12 shadow-lg"
              onClick={handleManualImport}
              disabled={isImporting || (!rawText && !imageUrl)}
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Integrate into {selectedPageType?.toUpperCase()} Spread
            </Button>
          </>
        )}

        <div id="story-library" className="rounded-lg border border-border bg-background p-4 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Import from InDesign</p>
            <p className="text-[10px] text-muted-foreground">
              Upload one IDML file and the system can pull the stories into the Story Library automatically. Linked images can still be uploaded separately by filename.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">InDesign story file (ICML/XML)</Label>
              <Input
                type="file"
                accept=".idml,.icml,.xml,.txt"
                disabled={isParsing || isImporting}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  handleImportFromInDesignFile(file);
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                For full issue ingestion, use `IDML`. Single `ICML/XML` files are still supported for one-off imports.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Upload images (optional)</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                disabled={isUploadingImages || isImporting}
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || !files.length) return;
                  handleUploadImages(files);
                }}
              />
            </div>
          </div>

          {idmlStories.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
              <div className="lg:col-span-5 space-y-2 min-w-0">
                <div className="flex items-baseline gap-2 min-w-0">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">Story picker</Label>
                  {idmlFileName ? (
                    <span className="text-[10px] text-muted-foreground truncate min-w-0">
                      ({idmlFileName})
                    </span>
                  ) : null}
                </div>
                <Select
                  value={selectedStoryPath}
                  onValueChange={(nextPath) => {
                    setSelectedStoryPath(nextPath);
                    const story = idmlStories.find((s) => s.path === nextPath);
                    if (story) applyInDesignStory(story);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose story…" />
                  </SelectTrigger>
                  <SelectContent>
                    {idmlStories.map((s) => {
                      const fileLabel = s.path.replace('Stories/', '');
                      const titleLabel = String(s.title || '').trim();
                      return (
                        <SelectItem key={s.path} value={s.path} className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0 w-full">
                            <span className="min-w-0 flex-1 truncate">
                              {titleLabel || fileLabel}
                            </span>
                            {titleLabel ? (
                              <span className="text-muted-foreground text-xs truncate max-w-[140px]">
                                {fileLabel}
                              </span>
                            ) : null}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {idmlStories.length} stories found. Selecting a story replaces Title / Body / image hints.
                </p>
              </div>
              <div className="lg:col-span-7">
                <div className="rounded-lg border border-border bg-muted/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preview</p>
                  <p className="mt-2 text-xs text-foreground/90 leading-relaxed break-words">
                    {idmlStories.find((s) => s.path === selectedStoryPath)?.preview || '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {idmlStories.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contents Builder</p>
                <p className="text-[10px] text-muted-foreground">
                  Add the selected story to a draft contents list, then apply it to your Contents page.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Page</Label>
                  <Input value={contentsDraftPage} onChange={(e) => setContentsDraftPage(e.target.value)} placeholder="04" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Category</Label>
                  <Input value={contentsDraftCategory} onChange={(e) => setContentsDraftCategory(e.target.value)} placeholder="FEATURE" />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleAddSelectedStoryToContents}
                    disabled={isImporting || isParsing}
                  >
                    Add selected story
                  </Button>
                </div>
              </div>

              {contentsDraftItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Draft items ({contentsDraftItems.length})
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => setContentsDraftItems([])}
                      disabled={isImporting}
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {contentsDraftItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-md border border-border bg-muted/10 p-2 min-w-0">
                        <div className="sm:col-span-2">
                          <Input
                            value={item.page}
                            onChange={(e) => {
                              const next = e.target.value;
                              setContentsDraftItems((prev) => prev.map((p, i) => (i === idx ? { ...p, page: next } : p)));
                            }}
                            placeholder="04"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <Input
                            value={item.category}
                            onChange={(e) => {
                              const next = e.target.value;
                              setContentsDraftItems((prev) => prev.map((p, i) => (i === idx ? { ...p, category: next } : p)));
                            }}
                            placeholder="FEATURE"
                          />
                        </div>
                        <div className="sm:col-span-6 min-w-0">
                          <Input
                            value={item.title}
                            onChange={(e) => {
                              const next = e.target.value;
                              setContentsDraftItems((prev) => prev.map((p, i) => (i === idx ? { ...p, title: next } : p)));
                            }}
                            placeholder="Story title…"
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 px-2 text-[10px]"
                            onClick={() => setContentsDraftItems((prev) => prev.filter((_, i) => i !== idx))}
                            disabled={isImporting}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-11"
                    onClick={handleApplyContentsListToSelectedPage}
                    disabled={isImporting || selectedPageType !== 'contents'}
                  >
                    Apply to selected Contents page
                  </Button>
                  {selectedPageType !== 'contents' && (
                    <p className="text-[10px] text-muted-foreground">
                      Select your Contents page to enable this button.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {(isParsing || isUploadingImages) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isParsing ? 'Parsing file…' : 'Uploading images…'}
            </div>
          )}

          {imageHints.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Detected image names</p>
              <div className="flex flex-wrap gap-1.5">
                {imageHints.slice(0, 10).map((name) => (
                  <span
                    key={name}
                    className={`text-[9px] uppercase tracking-wider px-2 py-1 rounded-full border ${
                      imageMap[name] ? 'border-accent/30 text-accent' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
              {imageHints.length > 10 && (
                <p className="text-[10px] text-muted-foreground">Showing first 10.</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Auto-Import IDML (Server-Side)</p>
            <p className="text-[10px] text-muted-foreground">
              Upload an IDML file for full server-side parsing. Images are extracted and uploaded automatically.
              Pages are mapped to reader templates and can be published as a complete edition.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">IDML File</Label>
            <Input
              type="file"
              accept=".idml"
              disabled={isServerIdmlParsing || isServerIdmlPublishing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                handleServerIdmlImport(file);
              }}
            />
          </div>

          {isServerIdmlParsing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing IDML file on server...
            </div>
          )}

          {canRenderServerIdmlControls && renderableServerIdmlMeta && (
            <div className="space-y-4">
              {effectiveServerIdmlStats ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-md border border-border bg-background p-3 text-center">
                    <p className="text-2xl font-bold">{effectiveServerIdmlStats.pageCount}</p>
                    <p className="text-[10px] text-muted-foreground">Pages</p>
                  </div>
                  <div className="rounded-md border border-border bg-background p-3 text-center">
                    <p className="text-2xl font-bold">{effectiveServerIdmlStats.storyCount}</p>
                    <p className="text-[10px] text-muted-foreground">Stories</p>
                  </div>
                  <div className="rounded-md border border-border bg-background p-3 text-center">
                    <p className="text-2xl font-bold">{effectiveServerIdmlStats.imageCount}</p>
                    <p className="text-[10px] text-muted-foreground">Images</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Edition Title</Label>
                <Input
                  value={renderableServerIdmlMeta.title}
                  onChange={(e) => handleUpdateServerIdmlTitle(e.target.value)}
                  placeholder="Enter edition title..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Page Preview</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowServerIdmlPreview(!showServerIdmlPreview)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {showServerIdmlPreview ? 'Hide' : 'Show'} Pages
                  </Button>
                </div>
                {showServerIdmlPreview && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[300px] overflow-auto">
                    {serverIdmlPages.map((page, idx) => (
                      <div
                        key={page.id}
                        className="rounded-md border border-border bg-background p-2 text-center"
                      >
                        <p className="text-[10px] font-bold text-muted-foreground">Page {idx + 1}</p>
                        <p className="text-[9px] uppercase tracking-wider text-accent mt-1">{page.template}</p>
                        <p className="text-[9px] text-muted-foreground mt-1 truncate">
                          {page.content.title || 'Untitled'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90 text-white font-bold h-12 shadow-lg"
                  onClick={handlePublishIdmlEdition}
                  disabled={isServerIdmlPublishing || serverIdmlPages.length === 0}
                >
                  {isServerIdmlPublishing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  Publish ({serverIdmlPages.length} pages)
                </Button>
                <Button
                  variant="destructive"
                  className="h-12 px-4"
                  onClick={handleClearIdmlDraft}
                  disabled={isServerIdmlPublishing}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Story Library</p>
              <p className="text-[10px] text-muted-foreground">
                Save stories once, then choose exactly which ones feed the premium reader without re-uploading files.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={handleSaveSelectedStoryToLibrary}
              disabled={
                isImporting ||
                !onSaveStoryLibrary ||
                !issueId ||
                issueId === 'new' ||
                (!rawText.trim() && !idmlStories.find((s) => s.path === selectedStoryPath)?.text)
              }
            >
              Save story
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Search</Label>
            <Input
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              placeholder="Search by title or author…"
            />
          </div>

          <div className="rounded-md border border-border bg-muted/10 px-3 py-2">
            <p className="text-[10px] font-mono text-muted-foreground">
              Included in premium reader: {includedStoryCount} / {safeStoryLibrary.length}
            </p>
          </div>

          {filteredStoryLibrary.length > 0 ? (
            <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
              {filteredStoryLibrary.map((s) => {
                const isActive = s.id === activeLibraryId;
                const subtitle = String(s.author || '').trim() || (s.source?.fileName ? s.source.fileName : '');
                const isIncluded = isIncludedInPremiumReader(s);
                return (
                  <div
                    key={s.id}
                    className={[
                      'flex items-center gap-2 rounded-md border p-2 min-w-0',
                      isActive ? 'border-accent/40 bg-accent/5' : 'border-border bg-muted/10',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => applyStoryLibraryItem(s)}
                    >
                      <p className="text-sm font-semibold truncate">{String(s.title || '').trim() || 'Untitled Story'}</p>
                      {subtitle ? (
                        <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
                      ) : null}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {isIncluded ? 'Included in premium reader' : 'Excluded from premium reader'}
                      </p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-[10px] shrink-0"
                      onClick={() => handleTogglePremiumReaderInclusion(s.id)}
                      disabled={isImporting || !onSaveStoryLibrary || !issueId || issueId === 'new'}
                    >
                      {isIncluded ? 'Exclude' : 'Include'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-[10px] shrink-0"
                      onClick={() => handleRemoveFromStoryLibrary(s.id)}
                      disabled={isImporting || !onSaveStoryLibrary || !issueId || issueId === 'new'}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-md border border-dashed bg-muted/10">
              <p className="text-xs text-muted-foreground">
                No saved stories yet. Upload an `IDML` file and stories will be added here automatically.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
