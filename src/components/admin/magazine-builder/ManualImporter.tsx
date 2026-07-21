'use client';

import { useState } from 'react';
import { Image as ImageIcon, ClipboardPaste, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import type { StoryContentType } from '@/features/magazine/domain/types';

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

function inferPremiumReaderDefaults(input: {
  title: string;
  text: string;
  path: string;
  index: number;
}): {
  includedInPremiumReader: boolean;
  premiumReaderContentType: StoryContentType;
  premiumReaderPriority: number;
} {
  const haystack = `${input.title} ${input.path} ${input.text.slice(0, 240)}`.toLowerCase();

  if (/\b(contents|table of contents)\b/.test(haystack)) {
    return {
      includedInPremiumReader: false,
      premiumReaderContentType: 'utility',
      premiumReaderPriority: 5,
    };
  }

  if (/\b(advert|advertisement|sponsor|sponsored|advertorial)\b/.test(haystack)) {
    return {
      includedInPremiumReader: false,
      premiumReaderContentType: 'partner',
      premiumReaderPriority: 10,
    };
  }

  if (/\b(editor('?s)? note|from the editor|editorial)\b/.test(haystack)) {
    return {
      includedInPremiumReader: true,
      premiumReaderContentType: 'editorial',
      premiumReaderPriority: 85,
    };
  }

  if (/\b(profile|spotlight|member spotlight)\b/.test(haystack)) {
    return {
      includedInPremiumReader: true,
      premiumReaderContentType: 'profile',
      premiumReaderPriority: 58,
    };
  }

  if (/\b(column|opinion|comment|expert)\b/.test(haystack)) {
    return {
      includedInPremiumReader: true,
      premiumReaderContentType: 'column',
      premiumReaderPriority: 56,
    };
  }

  if (input.index <= 1) {
    return {
      includedInPremiumReader: true,
      premiumReaderContentType: 'lead',
      premiumReaderPriority: 72,
    };
  }

  return {
    includedInPremiumReader: true,
    premiumReaderContentType: 'feature',
    premiumReaderPriority: 48,
  };
}

function buildStoryLibraryItemFromParsedStory(
  story: ParsedInDesignStory,
  options: {
    idmlFileName: string;
    index: number;
  },
): StoryLibraryItem {
  const cleanTitle = String(story.title || '').trim();
  const cleanText = String(story.text || '').trim();
  const defaults = inferPremiumReaderDefaults({
    title: cleanTitle,
    text: cleanText,
    path: story.path,
    index: options.index,
  });

  return {
    id: createStoryId(),
    title: cleanTitle || `Imported Story ${options.index + 1}`,
    standfirst: deriveStandfirst(cleanText) || undefined,
    text: cleanText,
    includedInPremiumReader: defaults.includedInPremiumReader,
    premiumReaderPriority: defaults.premiumReaderPriority,
    premiumReaderContentType: defaults.premiumReaderContentType,
    premiumReaderPlacementPreference: 'auto',
    imageFileNames: story.imageFileNames,
    source: {
      type: 'idml',
      fileName: options.idmlFileName || undefined,
      path: story.path,
    },
    createdAt: new Date().toISOString(),
  };
}

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
  imageFileNames: string[];
  preview: string;
  length: number;
};

const createStoryId = () => {
  const anyCrypto = globalThis.crypto as undefined | { randomUUID?: () => string };
  const uuid = anyCrypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isIncludedInPremiumReader = (item: StoryLibraryItem) => item.includedInPremiumReader !== false;

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

  const safeStoryLibrary = Array.isArray(storyLibrary) ? storyLibrary.filter(Boolean) : [];
  const includedStoryCount = safeStoryLibrary.filter(isIncludedInPremiumReader).length;

  const applyInDesignStory = (story: ParsedInDesignStory) => {
    if (story.title) setTitle(story.title);
    setRawText(story.text);
    setImageHints(story.imageFileNames);

    const firstHit = story.imageFileNames.find((name) => imageMap[name]);
    if (firstHit) setImageUrl(imageMap[firstHit]);
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
    if (firstHit) setImageUrl(imageMap[firstHit]);
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
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const storyPaths = Object.keys(zip.files).filter((p) => /^Stories\/.+\.xml$/i.test(p));

        if (storyPaths.length === 0) {
          toast.error('No Stories found in that IDML file');
          return;
        }

        const stories: ParsedInDesignStory[] = [];
        for (const p of storyPaths) {
          const xml = await zip.files[p].async('text');
          const parsed = extractInDesignTextAndImageHints(xml);
          if (!parsed.text) continue;
          const cleaned = normalizeWhitespace(parsed.text);
          const preview = cleaned.replace(/\s+/g, ' ').slice(0, 180);
          stories.push({
            path: p,
            title: parsed.title,
            text: cleaned,
            imageFileNames: parsed.imageFileNames,
            preview,
            length: cleaned.length,
          });
        }

        if (stories.length === 0) {
          toast.error('No readable story text found in that IDML file');
          return;
        }

        const sorted = [...stories].sort((a, b) =>
          a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }),
        );
        setIdmlStories(sorted);
        const initial = sorted[0];
        setSelectedStoryPath(initial.path);
        applyInDesignStory(initial);

        if (issueId && issueId !== 'new' && onSaveStoryLibrary) {
          const importedItems = sorted.map((story, index) =>
            buildStoryLibraryItemFromParsedStory(story, {
              idmlFileName: file.name,
              index,
            }),
          );
          const nextLibrary = mergeStoryLibraryItems(safeStoryLibrary, importedItems);
          await saveStoryLibrary(nextLibrary);
          toast.success(`Imported ${importedItems.length} IDML stories into the Story Library`);
          return;
        }

        toast.success(`Imported from IDML (${initial.path.replace('Stories/', '')})`);
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
