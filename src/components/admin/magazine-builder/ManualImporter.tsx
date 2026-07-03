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
}

type ParsedInDesignStory = {
  path: string;
  title: string;
  text: string;
  imageFileNames: string[];
  preview: string;
  length: number;
};

export function ManualImporter({ onImport, isImporting, selectedPageId, selectedPageType }: ManualImporterProps) {
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

  const applyInDesignStory = (story: ParsedInDesignStory) => {
    if (story.title) setTitle(story.title);
    setRawText(story.text);
    setImageHints(story.imageFileNames);

    const firstHit = story.imageFileNames.find((name) => imageMap[name]);
    if (firstHit) setImageUrl(imageMap[firstHit]);
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
        manualContent.name = author || 'Member Name';
        manualContent.bio = rawText;
        manualContent.image = imageUrl;
        break;
      case 'lifestyle':
        manualContent.title = title || 'Lifestyle';
        manualContent.text = rawText;
        manualContent.image = imageUrl;
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

        const sorted = stories.sort((a, b) => b.length - a.length);
        setIdmlStories(sorted);
        const initial = sorted[0];
        setSelectedStoryPath(initial.path);
        applyInDesignStory(initial);

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
      <CardContent className="pt-6 space-y-4">
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

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Import from InDesign</p>
            <p className="text-[10px] text-muted-foreground">
              Export an ICML file, or unzip an IDML and choose a Stories/Story_*.xml file. Upload your linked images to match by filename.
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
              <div className="lg:col-span-5 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Story picker {idmlFileName ? `(${idmlFileName})` : ''}
                </Label>
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
                    {idmlStories.map((s) => (
                      <SelectItem key={s.path} value={s.path}>
                        {s.title ? `${s.title} — ` : ''}
                        {s.path.replace('Stories/', '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {idmlStories.length} stories found. Selecting a story replaces Title / Body / image hints.
                </p>
              </div>
              <div className="lg:col-span-7">
                <div className="rounded-lg border border-border bg-muted/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preview</p>
                  <p className="mt-2 text-xs text-foreground/90 leading-relaxed">
                    {idmlStories.find((s) => s.path === selectedStoryPath)?.preview || '—'}
                  </p>
                </div>
              </div>
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
      </CardContent>
    </Card>
  );
}
