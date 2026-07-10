'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Edit2, Bold, Italic, Type, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PAGE_TYPES, MagazinePage } from './types';

interface PageEditorProps {
  page: MagazinePage | undefined;
  onSave: (content: any) => void;
  onChangeType?: (type: string) => void;
  isSaving: boolean;
}

export function PageEditor({ page, onSave, onChangeType, isSaving }: PageEditorProps) {
  const [content, setContent] = useState<any>({});
  const [rawJsonDraft, setRawJsonDraft] = useState<string>('{}');
  const [rawJsonError, setRawJsonError] = useState<string>('');
  const rawJsonFocusedRef = useRef(false);
  const [lifestyleImagesDraft, setLifestyleImagesDraft] = useState<string>('[]');
  const [pullQuotesDraft, setPullQuotesDraft] = useState<string>('');
  const [contentsItemsDraft, setContentsItemsDraft] = useState<string>('[]');
  const [contentsItemsError, setContentsItemsError] = useState<string>('');
  const [newsDraft, setNewsDraft] = useState<string>('[]');
  const [newsError, setNewsError] = useState<string>('');
  const [tipsDraft, setTipsDraft] = useState<string>('[]');
  const [tipsError, setTipsError] = useState<string>('');
  const [highlightsDraft, setHighlightsDraft] = useState<string>('[]');
  const [highlightsError, setHighlightsError] = useState<string>('');
  const [socialsDraft, setSocialsDraft] = useState<string>('[]');
  const [socialsError, setSocialsError] = useState<string>('');
  const [statsDraft, setStatsDraft] = useState<string>('[]');
  const [statsError, setStatsError] = useState<string>('');
  const lastLoadedDocIdRef = useRef<string | null>(null);
  const lastSyncedContentJsonRef = useRef<string>('');
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);

  const stringifyJson = (value: any) => JSON.stringify(value ?? null, null, 2);

  const stringifyPullQuotes = (value: any) => {
    const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    return list.map((q: any) => String(q || '').trim()).filter(Boolean).join('\n');
  };

  const parsePullQuotes = (raw: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return [];
    return trimmed
      .split(/\r?\n+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const stringifyStats = (value: any) => {
    const list = Array.isArray(value) ? value : [];
    return JSON.stringify(list, null, 2);
  };

  const parseStringArray = (raw: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return { value: [] as string[], error: '' };

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return { value: parsed.map((x: any) => String(x || '').trim()).filter(Boolean), error: '' };
        }
        return { value: [] as string[], error: 'Must be a JSON array.' };
      } catch {
        return { value: [] as string[], error: 'Invalid JSON.' };
      }
    }

    const lines = trimmed.split(/\r?\n+/g).map((s) => s.trim()).filter(Boolean);
    return { value: lines, error: '' };
  };

  const parseContentsItems = (raw: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return { items: [] as any[], error: '' };

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return { items: parsed, error: '' };
        return { items: [] as any[], error: 'Items must be a JSON array.' };
      } catch {
        return { items: [] as any[], error: 'Invalid JSON.' };
      }
    }

    const lines = trimmed.split(/\r?\n+/g).map((s) => s.trim()).filter(Boolean);
    const items = lines
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
        if (parts.length < 3) return null;
        const page = Number(parts[0]);
        const category = parts[1];
        const title = parts.slice(2).join(' | ');
        if (!Number.isFinite(page) || page <= 0 || !category || !title) return null;
        return { page, category, title };
      })
      .filter(Boolean);

    if (items.length === 0) {
      return { items: [] as any[], error: 'Use JSON array or one per line: 4 | LIFESTYLE | Summer Fashion' };
    }

    return { items, error: '' };
  };

  const parseImageUrls = (raw: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return [] as string[];

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
        if (typeof parsed === 'string') return parsed.trim() ? [parsed.trim()] : [];
      } catch {}
    }

    const looksLikeUrl = (value: string) => {
      const v = value.trim();
      if (!v) return false;
      return (
        v.startsWith('https://') ||
        v.startsWith('http://') ||
        v.startsWith('/') ||
        v.startsWith('./') ||
        v.startsWith('../') ||
        v.startsWith('data:') ||
        v.startsWith('gs://')
      );
    };

    const lines = trimmed
      .split(/\r?\n+/g)
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);

    if (lines.length === 1) {
      const single = lines[0];

      const commaSpaceParts = single.split(/,\s+/g).map((s) => s.trim()).filter(Boolean);
      if (commaSpaceParts.length > 1 && commaSpaceParts.every(looksLikeUrl)) return commaSpaceParts;

      const semicolonSpaceParts = single.split(/;\s+/g).map((s) => s.trim()).filter(Boolean);
      if (semicolonSpaceParts.length > 1 && semicolonSpaceParts.every(looksLikeUrl)) return semicolonSpaceParts;

      const httpCount = (single.match(/https?:\/\//g) || []).length;
      if (httpCount >= 2) {
        return single.split(/[,;]\s*(?=https?:\/\/)/g).map((s) => s.trim()).filter(Boolean);
      }
    }

    return lines;
  };

  const parseStats = (raw: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return { stats: [] as any[], error: '' };

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return { stats: parsed, error: '' };
        return { stats: [], error: 'Stats must be a JSON array.' };
      } catch {
        return { stats: [], error: 'Invalid JSON.' };
      }
    }

    const lines = trimmed.split(/\r?\n+/g).map((s) => s.trim()).filter(Boolean);
    const stats = lines
      .map((line) => {
        const idx = line.includes('|') ? line.indexOf('|') : line.indexOf(':');
        if (idx <= 0) return null;
        const label = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (!label || !value) return null;
        return { label, value };
      })
      .filter(Boolean);

    return { stats, error: '' };
  };

  useEffect(() => {
    if (!page?.docId) return;
    if (rawJsonFocusedRef.current) return;
    if (rawJsonError) return;

    const nextContent = page.content || {};
    const nextJson = JSON.stringify(nextContent || {});
    const currentJson = JSON.stringify(content || {});
    const isNewDoc = lastLoadedDocIdRef.current !== page.docId;
    const hasLocalEdits = currentJson !== lastSyncedContentJsonRef.current;
    const shouldSync = isNewDoc || !hasLocalEdits;

    if (!shouldSync) return;

    lastLoadedDocIdRef.current = page.docId;
    lastSyncedContentJsonRef.current = nextJson;
    setContent(nextContent);
    setRawJsonDraft(JSON.stringify(nextContent || {}, null, 2));
    setRawJsonError('');

    if (page.type === 'lifestyle') {
      const initial = Array.isArray((nextContent as any)?.images) ? (nextContent as any).images : [];
      setLifestyleImagesDraft(JSON.stringify(initial, null, 2));
    } else {
      setLifestyleImagesDraft('[]');
    }

    setPullQuotesDraft(stringifyPullQuotes((nextContent as any)?.pullQuotes || (nextContent as any)?.quotes || ''));
    setContentsItemsDraft(stringifyJson((nextContent as any)?.items || []));
    setContentsItemsError('');
    setNewsDraft(stringifyJson((nextContent as any)?.news || []));
    setNewsError('');
    setTipsDraft(stringifyJson((nextContent as any)?.tips || []));
    setTipsError('');
    setHighlightsDraft(stringifyJson((nextContent as any)?.highlights || []));
    setHighlightsError('');
    setSocialsDraft(stringifyJson((nextContent as any)?.socials || []));
    setSocialsError('');
    setStatsDraft(stringifyStats((nextContent as any)?.stats));
    setStatsError('');
    setPendingType(null);
    setIsTypeDialogOpen(false);
  }, [content, page?.content, page?.docId, page?.type, rawJsonError]);

  useEffect(() => {
    if (rawJsonFocusedRef.current) return;
    if (rawJsonError) return;
    setRawJsonDraft((prev) => {
      const next = JSON.stringify(content || {}, null, 2);
      return prev === next ? prev : next;
    });
  }, [content, rawJsonError]);

  if (!page) {
    return (
      <Card className="h-full border-dashed flex items-center justify-center text-center p-12 bg-muted/10">
        <div className="max-w-xs">
          <Edit2 className="h-8 w-8 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="text-sm text-muted-foreground">Select a page from the list to edit its content.</p>
        </div>
      </Card>
    );
  }

  const updateContent = (field: string, value: any) => {
    setContent((prev: any) => ({ ...prev, [field]: value }));
  };

  const insertTextAtCursor = (field: string, before: string, after: string = '') => {
    const textarea = document.getElementById(`editor-${field}`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    
    updateContent(field, newText);
    
    // Set focus back and adjust selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertListAtCursor = (field: string, listType: 'ul' | 'ol') => {
    const textarea = document.getElementById(`editor-${field}`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const rawLines = selectedText.split(/\r?\n/g).map((l) => l.trim()).filter(Boolean);

    const listOpen = `<${listType}>`;
    const listClose = `</${listType}>`;

    if (rawLines.length >= 2) {
      const items = rawLines.map((line) => `<li>${line}</li>`).join('');
      const listHtml = `${listOpen}${items}${listClose}`;
      const nextText = text.substring(0, start) + listHtml + text.substring(end);
      updateContent(field, nextText);
      setTimeout(() => {
        textarea.focus();
        const cursor = start + listHtml.length;
        textarea.setSelectionRange(cursor, cursor);
      }, 0);
      return;
    }

    const inner = selectedText.trim();
    const listHtml = `${listOpen}<li>${inner}</li>${listClose}`;
    const nextText = text.substring(0, start) + listHtml + text.substring(end);
    updateContent(field, nextText);
    setTimeout(() => {
      textarea.focus();
      const liStart = start + listOpen.length + '<li>'.length;
      const liEnd = liStart + inner.length;
      textarea.setSelectionRange(liStart, liEnd);
    }, 0);
  };

  const FormattingToolbar = ({ field, allowParagraph = true }: { field: string; allowParagraph?: boolean }) => (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/20 rounded-t-lg border border-b-0">
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 w-8 p-0" 
        onClick={() => insertTextAtCursor(field, '<strong>', '</strong>')}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 w-8 p-0" 
        onClick={() => insertTextAtCursor(field, '<em>', '</em>')}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => insertTextAtCursor(field, '<span style="text-decoration: underline;">', '</span>')}
        title="Underline"
      >
        <span className="text-[10px] font-bold">U</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => {
          const input = document.getElementById(`editor-color-${field}`) as HTMLInputElement | null;
          input?.click();
        }}
        title="Text color"
      >
        <Palette className="h-4 w-4" />
      </Button>
      <input
        id={`editor-color-${field}`}
        type="color"
        defaultValue="#a3413a"
        className="hidden"
        onChange={(e) => insertTextAtCursor(field, `<span style="color: ${e.target.value};">`, '</span>')}
      />
      <Select
        value=""
        onValueChange={(v) => {
          if (!v) return;
          insertTextAtCursor(field, `<span style="font-size: ${v};">`, '</span>');
        }}
      >
        <SelectTrigger className="h-8 px-2 py-0 w-[88px]">
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0.85rem">XS</SelectItem>
          <SelectItem value="1rem">SM</SelectItem>
          <SelectItem value="1.15rem">MD</SelectItem>
          <SelectItem value="1.35rem">LG</SelectItem>
          <SelectItem value="1.6rem">XL</SelectItem>
          <SelectItem value="2rem">2XL</SelectItem>
        </SelectContent>
      </Select>
      {allowParagraph && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0" 
            onClick={() => insertTextAtCursor(field, '<p>', '</p>')}
            title="Paragraph"
          >
            <Type className="h-4 w-4" />
          </Button>
        </>
      )}
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 w-8 p-0" 
        onClick={() => insertTextAtCursor(field, '<br />')}
        title="Line Break"
      >
        <span className="text-[10px] font-bold">BR</span>
      </Button>
      <div className="w-px h-4 bg-border mx-1" />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => insertTextAtCursor(field, '<h2>', '</h2>')}
        title="Heading"
      >
        <span className="text-[10px] font-bold">H2</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => insertTextAtCursor(field, '<h3>', '</h3>')}
        title="Subheading"
      >
        <span className="text-[10px] font-bold">H3</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => insertListAtCursor(field, 'ul')}
        title="Bulleted list"
      >
        <span className="text-[10px] font-bold">UL</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => insertListAtCursor(field, 'ol')}
        title="Numbered list"
      >
        <span className="text-[10px] font-bold">OL</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => {
          const url = window.prompt('Link URL');
          if (!url) return;
          insertTextAtCursor(field, `<a href="${url}" target="_blank" rel="noreferrer">`, '</a>');
        }}
        title="Link"
      >
        <span className="text-[10px] font-bold">LINK</span>
      </Button>
    </div>
  );

  const renderEditorFields = () => {
    const safeContent = content || {};
    
    switch (page.type) {
      case 'cover':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Issue Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Headline</Label>
              <Input value={safeContent.headline || ''} onChange={(e) => updateContent('headline', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Sub-headline</Label>
              <FormattingToolbar field="subheadline" allowParagraph={false} />
              <Textarea
                id="editor-subheadline"
                className="rounded-t-none"
                value={safeContent.subheadline || ''}
                onChange={(e) => updateContent('subheadline', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date Text</Label>
              <Input value={safeContent.date || ''} onChange={(e) => updateContent('date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Issue Number</Label>
              <Input value={safeContent.issue || ''} onChange={(e) => updateContent('issue', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Cover Background Image</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Cover Feature Image (Optional)</Label>
              <Input value={safeContent.featureImage || ''} onChange={(e) => updateContent('featureImage', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Video Background URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
              <p className="text-[10px] text-muted-foreground italic">If provided, this video will replace the static background image.</p>
            </div>
          </div>
        );
      case 'editorial':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Editor Name</Label>
                <Input value={safeContent.author || ''} onChange={(e) => updateContent('author', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Feature Image</Label>
              <Input value={(safeContent.featureImage ?? safeContent.image) || ''} onChange={(e) => updateContent('featureImage', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Additional Images (Inline / Gallery)</Label>
              <Textarea
                rows={3}
                placeholder="One image URL per line (or paste a JSON array)"
                value={(() => {
                  const arr = safeContent.images || safeContent.additionalImages || safeContent.gallery || [];
                  if (Array.isArray(arr)) return arr.map(a => typeof a === 'string' ? a : String(a?.src || a?.url || a?.image || '').trim()).filter(Boolean).join('\n');
                  return '';
                })()}
                onChange={(e) => {
                  const next = e.target.value;
                  updateContent('images', parseImageUrls(next));
                }}
              />
              <p className="text-[10px] text-muted-foreground">Up to 4 images will be floated inline in the text. Remaining images form a gallery at the bottom.</p>
            </div>
          </div>
            <div className="space-y-2">
              <Label>Background Image (Optional)</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Intro Text (Bold Standfirst)</Label>
                <span className="text-[10px] text-muted-foreground italic">Spans both content columns</span>
              </div>
              <FormattingToolbar field="intro" />
              <Textarea 
                id="editor-intro"
                className="rounded-t-none"
                rows={3} 
                value={safeContent.intro || ''} 
                onChange={(e) => updateContent('intro', e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Editorial Body Text</Label>
                <span className="text-[10px] text-muted-foreground italic">Split into 2 columns on reader</span>
              </div>
              <FormattingToolbar field="text" />
              <Textarea 
                id="editor-text"
                className="rounded-t-none"
                rows={12} 
                value={safeContent.text || ''} 
                onChange={(e) => updateContent('text', e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label>Pull Quote</Label>
              <Input value={safeContent.quote || ''} onChange={(e) => updateContent('quote', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Pull Quotes (One Per Line)</Label>
              <Textarea
                rows={3}
                value={pullQuotesDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setPullQuotesDraft(next);
                  updateContent('pullQuotes', parsePullQuotes(next));
                }}
              />
            </div>
          </div>
        );
      case 'contents':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Kicker</Label>
              <Input value={safeContent.kicker || ''} onChange={(e) => updateContent('kicker', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Add Text</Label>
              <FormattingToolbar field="text" />
              <Textarea
                id="editor-text"
                className="rounded-t-none"
                rows={4}
                value={safeContent.text || ''}
                onChange={(e) => updateContent('text', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contents Items (JSON Array)</Label>
              <Textarea 
                rows={6} 
                value={contentsItemsDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setContentsItemsDraft(next);
                  const parsed = parseContentsItems(next);
                  setContentsItemsError(parsed.error);
                  if (!parsed.error) {
                    updateContent('items', parsed.items);
                  }
                }}
              />
              {contentsItemsError ? (
                <p className="text-[10px] text-destructive">{contentsItemsError}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Paste JSON array or use one per line: 4 | LIFESTYLE | Summer Fashion</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Regional News (JSON Array of Strings)</Label>
              <Textarea 
                rows={4} 
                value={newsDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setNewsDraft(next);
                  const parsed = parseStringArray(next);
                  setNewsError(parsed.error);
                  if (!parsed.error) {
                    updateContent('news', parsed.value);
                  }
                }}
              />
              {newsError ? (
                <p className="text-[10px] text-destructive">{newsError}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Paste JSON array or one per line.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Regional News Label</Label>
              <Input value={safeContent.newsLabel || ''} onChange={(e) => updateContent('newsLabel', e.target.value)} />
            </div>
          </div>
        );
      case 'feature-left': case'feature-right':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mini Text</Label>
              <Input value={safeContent.kicker || ''} onChange={(e) => updateContent('kicker', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Person/Feature Name</Label>
              <Input value={safeContent.name || ''} onChange={(e) => updateContent('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Feature Image</Label>
              <Input value={(safeContent.featureImage ?? safeContent.image) || ''} onChange={(e) => updateContent('featureImage', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Additional Images (Inline / Gallery)</Label>
              <Textarea
                rows={3}
                placeholder="One image URL per line (or paste a JSON array)"
                value={(() => {
                  const arr = safeContent.images || safeContent.additionalImages || safeContent.gallery || [];
                  if (Array.isArray(arr)) return arr.map(a => typeof a === 'string' ? a : String(a?.src || a?.url || a?.image || '').trim()).filter(Boolean).join('\n');
                  return '';
                })()}
                onChange={(e) => {
                  const next = e.target.value;
                  updateContent('images', parseImageUrls(next));
                }}
              />
              <p className="text-[10px] text-muted-foreground">Up to 4 images will be floated inline in the text. Remaining images form a gallery at the bottom.</p>
            </div>
            <div className="space-y-2">
              <Label>Background Image (Optional)</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Video URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
            </div>
            <div className="space-y-2">
              <Label>Media Layout</Label>
              <Select value={safeContent.mediaLayout || 'side'} onValueChange={(v) => updateContent('mediaLayout', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side">Side media panel</SelectItem>
                  <SelectItem value="background">Full-page background</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Main Text</Label>
              <FormattingToolbar field="text" />
              <Textarea
                id="editor-text"
                className="rounded-t-none"
                rows={8}
                value={safeContent.text || ''}
                onChange={(e) => updateContent('text', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Introduction Text</Label>
              <FormattingToolbar field="intro" />
              <Textarea
                id="editor-intro"
                className="rounded-t-none"
                value={safeContent.intro || ''}
                onChange={(e) => updateContent('intro', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Quote</Label>
              <Input value={safeContent.quote || ''} onChange={(e) => updateContent('quote', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pull Quotes (One Per Line)</Label>
              <Textarea
                rows={3}
                value={pullQuotesDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setPullQuotesDraft(next);
                  updateContent('pullQuotes', parsePullQuotes(next));
                }}
              />
              <p className="text-[10px] text-muted-foreground">These will be auto-inserted between paragraphs to break up long text.</p>
            </div>
            <div className="space-y-2">
              <Label>Stats (JSON Array)</Label>
              <Textarea 
                rows={4}
                value={statsDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setStatsDraft(next);
                  const parsed = parseStats(next);
                  setStatsError(parsed.error);
                  if (!parsed.error) {
                    updateContent('stats', parsed.stats);
                  }
                }}
              />
              {statsError ? (
                <p className="text-[10px] text-destructive">{statsError}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Paste JSON array or use one per line: YEARS: 14</p>
              )}
            </div>
          </div>
        );
      case 'column':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kicker</Label>
              <Input value={safeContent.kicker || ''} onChange={(e) => updateContent('kicker', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Column Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={safeContent.category || ''} onChange={(e) => updateContent('category', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Author Name</Label>
              <Input value={safeContent.author || ''} onChange={(e) => updateContent('author', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Background Image</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Feature Image (Optional)</Label>
              <Input value={(safeContent.featureImage ?? safeContent.image) || ''} onChange={(e) => updateContent('featureImage', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Additional Images (Inline / Gallery)</Label>
              <Textarea
                rows={3}
                placeholder="One image URL per line (or paste a JSON array)"
                value={(() => {
                  const arr = safeContent.images || safeContent.additionalImages || safeContent.gallery || [];
                  if (Array.isArray(arr)) return arr.map(a => typeof a === 'string' ? a : String(a?.src || a?.url || a?.image || '').trim()).filter(Boolean).join('\n');
                  return '';
                })()}
                onChange={(e) => {
                  const next = e.target.value;
                  updateContent('images', parseImageUrls(next));
                }}
              />
              <p className="text-[10px] text-muted-foreground">Up to 4 images will be floated inline in the text. Remaining images form a gallery at the bottom.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Video Background URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
            </div>
            <div className="space-y-2">
              <Label>Media Layout</Label>
              <Select value={safeContent.mediaLayout || 'side'} onValueChange={(v) => updateContent('mediaLayout', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side">Side media panel</SelectItem>
                  <SelectItem value="background">Full-page background</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Column Text</Label>
              <FormattingToolbar field="text" />
              <Textarea
                id="editor-text"
                className="rounded-t-none"
                rows={6}
                value={safeContent.text || ''}
                onChange={(e) => updateContent('text', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Pull Quotes (One Per Line)</Label>
              <Textarea
                rows={3}
                value={pullQuotesDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setPullQuotesDraft(next);
                  updateContent('pullQuotes', parsePullQuotes(next));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Tips (JSON Array of Strings)</Label>
              <Textarea 
                rows={4} 
                value={tipsDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setTipsDraft(next);
                  const parsed = parseStringArray(next);
                  setTipsError(parsed.error);
                  if (!parsed.error) {
                    updateContent('tips', parsed.value);
                  }
                }}
              />
              {tipsError ? (
                <p className="text-[10px] text-destructive">{tipsError}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Paste JSON array or one per line.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tips Label</Label>
              <Input value={safeContent.tipsLabel || safeContent.tipsTitle || ''} onChange={(e) => updateContent('tipsLabel', e.target.value)} />
            </div>
          </div>
        );
      case 'lifestyle':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kicker</Label>
              <Input value={safeContent.kicker || ''} onChange={(e) => updateContent('kicker', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Logo Image URL (Optional)</Label>
              <Input value={safeContent.logo || ''} onChange={(e) => updateContent('logo', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lifestyle Image</Label>
              <Input value={(safeContent.featureImage ?? safeContent.image) || ''} onChange={(e) => updateContent('featureImage', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Background Image (Optional)</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Video Background URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
            </div>
            <div className="space-y-2">
              <Label>Media Layout</Label>
              <Select value={safeContent.mediaLayout || 'side'} onValueChange={(v) => updateContent('mediaLayout', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side">Side media panel</SelectItem>
                  <SelectItem value="background">Full-page background</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional Images (One URL per line or JSON Array)</Label>
              <Textarea
                rows={4}
                value={lifestyleImagesDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setLifestyleImagesDraft(next);
                  updateContent('images', parseImageUrls(next));
                }}
              />
              <p className="text-[10px] text-muted-foreground">Paste one image URL per line (recommended) or use JSON: {"[\"https://.../image1.jpg\", \"https://.../image2.jpg\"]"}</p>
            </div>
            <div className="space-y-2">
              <Label>Main Text</Label>
              <FormattingToolbar field="text" />
              <Textarea
                id="editor-text"
                className="rounded-t-none"
                rows={6}
                value={safeContent.text || ''}
                onChange={(e) => updateContent('text', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Pull Quotes (One Per Line)</Label>
              <Textarea
                rows={3}
                value={pullQuotesDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setPullQuotesDraft(next);
                  updateContent('pullQuotes', parsePullQuotes(next));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Highlights (JSON Array of Strings)</Label>
              <Textarea 
                rows={4} 
                value={highlightsDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setHighlightsDraft(next);
                  const parsed = parseStringArray(next);
                  setHighlightsError(parsed.error);
                  if (!parsed.error) {
                    updateContent('highlights', parsed.value);
                  }
                }}
              />
              {highlightsError ? (
                <p className="text-[10px] text-destructive">{highlightsError}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Paste JSON array or one per line.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Highlights Label</Label>
              <Input value={safeContent.highlightsLabel || ''} onChange={(e) => updateContent('highlightsLabel', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Editor&apos;s Pick Label</Label>
              <Input value={safeContent.editorsPickLabel || ''} onChange={(e) => updateContent('editorsPickLabel', e.target.value)} />
            </div>
          </div>
        );
      case 'spotlight':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Member Name</Label>
              <Input value={safeContent.name || ''} onChange={(e) => updateContent('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role & Company</Label>
              <Input value={safeContent.role || ''} onChange={(e) => updateContent('role', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Spotlight Image</Label>
              <Input value={(safeContent.featureImage ?? safeContent.image) || ''} onChange={(e) => updateContent('featureImage', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Background Image (Optional)</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Video Background URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
            </div>
            <div className="space-y-2">
              <Label>Media Layout</Label>
              <Select value={safeContent.mediaLayout || 'side'} onValueChange={(v) => updateContent('mediaLayout', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side">Side media panel</SelectItem>
                  <SelectItem value="background">Full-page background</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Member Quote/Message</Label>
              <FormattingToolbar field="message" allowParagraph={false} />
              <Textarea
                id="editor-message"
                className="rounded-t-none"
                value={safeContent.message || ''}
                onChange={(e) => updateContent('message', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Biography</Label>
              <FormattingToolbar field="bio" />
              <Textarea
                id="editor-bio"
                className="rounded-t-none"
                rows={4}
                value={safeContent.bio || ''}
                onChange={(e) => updateContent('bio', e.target.value)}
              />
            </div>
          </div>
        );
      case 'partner':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kicker</Label>
              <Input value={safeContent.kicker || ''} onChange={(e) => updateContent('kicker', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Partner Brand</Label>
              <Input value={safeContent.brand || ''} onChange={(e) => updateContent('brand', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={safeContent.headline || ''} onChange={(e) => updateContent('headline', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Add Text</Label>
              <FormattingToolbar field="text" />
              <Textarea
                id="editor-text"
                className="rounded-t-none"
                rows={6}
                value={safeContent.text || ''}
                onChange={(e) => updateContent('text', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Feature Image</Label>
              <Input value={(safeContent.featureImage ?? safeContent.image) || ''} onChange={(e) => updateContent('featureImage', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Background Image (Optional)</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Video Background URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
            </div>
            <div className="space-y-2">
              <Label>Media Layout</Label>
              <Select value={safeContent.mediaLayout || 'side'} onValueChange={(v) => updateContent('mediaLayout', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side">Side media panel</SelectItem>
                  <SelectItem value="background">Full-page background</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exclusive Offer Text</Label>
              <Input value={safeContent.offer || ''} onChange={(e) => updateContent('offer', e.target.value)} />
            </div>
          </div>
        );
      case 'full-page-ad':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} placeholder="Advertisement" />
            </div>
            <div className="space-y-2">
              <Label>Label (Optional)</Label>
              <Input value={safeContent.label || ''} onChange={(e) => updateContent('label', e.target.value)} placeholder="Advertisement" />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} placeholder="https://..." />
              <p className="text-[10px] text-muted-foreground">This is the main foreground ad artwork shown on top of the background media.</p>
            </div>
            <div className="space-y-2">
              <Label>Background Image URL (Optional)</Label>
              <Input value={safeContent.backgroundImage || ''} onChange={(e) => updateContent('backgroundImage', e.target.value)} placeholder="https://..." />
              <p className="text-[10px] text-muted-foreground">Used behind the main ad image when no background video is set.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Background Video URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
              <p className="text-[10px] text-muted-foreground italic">If provided, this video will replace the static background image.</p>
            </div>
            <div className="space-y-2">
              <Label>Click-through Link (Optional)</Label>
              <Input value={safeContent.linkUrl || ''} onChange={(e) => updateContent('linkUrl', e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Alt Text (Optional)</Label>
              <Input value={safeContent.alt || ''} onChange={(e) => updateContent('alt', e.target.value)} placeholder="Full page advert" />
            </div>
          </div>
        );
      case 'back-cover':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kicker</Label>
              <Input value={safeContent.kicker || ''} onChange={(e) => updateContent('kicker', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Coming Soon Label</Label>
              <Input value={safeContent.comingSoonLabel || ''} onChange={(e) => updateContent('comingSoonLabel', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={safeContent.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Add Text</Label>
              <FormattingToolbar field="text" />
              <Textarea
                id="editor-text"
                className="rounded-t-none"
                rows={6}
                value={safeContent.text || ''}
                onChange={(e) => updateContent('text', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Next Issue Date/Text</Label>
              <Input value={safeContent.nextIssue || ''} onChange={(e) => updateContent('nextIssue', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CTA Button Text</Label>
              <Input value={safeContent.cta || ''} onChange={(e) => updateContent('cta', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Background Image</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Feature Image (Optional)</Label>
              <Input value={(safeContent.featureImage ?? safeContent.image) || ''} onChange={(e) => updateContent('featureImage', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Video Background URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
            </div>
            <div className="space-y-2">
              <Label>Media Layout</Label>
              <Select value={safeContent.mediaLayout || 'side'} onValueChange={(v) => updateContent('mediaLayout', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side">Side media panel</SelectItem>
                  <SelectItem value="background">Full-page background</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Social Platforms (JSON Array of Strings)</Label>
              <Textarea 
                rows={4} 
                value={socialsDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setSocialsDraft(next);
                  const parsed = parseStringArray(next);
                  setSocialsError(parsed.error);
                  if (!parsed.error) {
                    updateContent('socials', parsed.value);
                  }
                }}
              />
              {socialsError ? (
                <p className="text-[10px] text-destructive">{socialsError}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Paste JSON array or one per line.</p>
              )}
            </div>
          </div>
        );
      default:
        return (
          <div className="p-4 rounded-lg bg-muted/30 border border-dashed text-center">
            <p className="text-sm text-muted-foreground italic">
              Editor for &quot;{PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}&quot; is coming soon. 
              You can still edit the raw JSON data below.
            </p>
          </div>
        );
    }
  };

  const hasJsonErrors = Boolean(
    rawJsonError ||
      contentsItemsError ||
      newsError ||
      tipsError ||
      highlightsError ||
      socialsError ||
      statsError
  );

  return (
    <Card className="border-accent/30 shadow-lg">
      <CardHeader className="bg-accent/5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-xl">Page Settings: {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}</CardTitle>
          <CardDescription>Edit the visual elements and text for this spread.</CardDescription>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {!!onChangeType && (
              <Select
                value={page.type}
                onValueChange={(nextType) => {
                  if (nextType === page.type) return;
                  setPendingType(nextType);
                  setIsTypeDialogOpen(true);
                }}
                disabled={isSaving}
              >
                <SelectTrigger className="h-9 w-[220px] bg-white">
                  <SelectValue placeholder="Layout" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => onSave(content)} disabled={isSaving || hasJsonErrors} className="bg-accent text-white">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Page
            </Button>
          </div>
          {hasJsonErrors ? (
            <p className="text-[10px] text-destructive sm:text-right">Fix JSON errors above before saving.</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-6 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
        {renderEditorFields()}
        
        <div className="mt-8 pt-6 border-t">
          <Label className="text-xs text-muted-foreground uppercase tracking-widest">Raw Content JSON</Label>
          <Textarea 
            className="font-mono text-[10px] mt-2 bg-muted/30 focus:bg-white transition-colors" 
            rows={5}
            value={rawJsonDraft}
            onFocus={() => {
              rawJsonFocusedRef.current = true;
            }}
            onBlur={() => {
              rawJsonFocusedRef.current = false;
              if (!rawJsonError) {
                setRawJsonDraft(JSON.stringify(content || {}, null, 2));
              }
            }}
            onChange={(e) => {
              const next = e.target.value;
              setRawJsonDraft(next);
              try {
                const parsed = JSON.parse(next);
                if (typeof parsed === 'object' && parsed !== null) {
                  setRawJsonError('');
                  setContent(parsed);
                  setPullQuotesDraft(stringifyPullQuotes((parsed as any)?.pullQuotes || (parsed as any)?.quotes || ''));
                  setContentsItemsDraft(stringifyJson((parsed as any)?.items || []));
                  setContentsItemsError('');
                  setNewsDraft(stringifyJson((parsed as any)?.news || []));
                  setNewsError('');
                  setTipsDraft(stringifyJson((parsed as any)?.tips || []));
                  setTipsError('');
                  setHighlightsDraft(stringifyJson((parsed as any)?.highlights || []));
                  setHighlightsError('');
                  setSocialsDraft(stringifyJson((parsed as any)?.socials || []));
                  setSocialsError('');
                  setStatsDraft(stringifyStats((parsed as any)?.stats));
                  setStatsError('');
                  if (page?.type === 'lifestyle') {
                    const initial = Array.isArray((parsed as any)?.images) ? (parsed as any).images : [];
                    setLifestyleImagesDraft(JSON.stringify(initial, null, 2));
                  }
                  return;
                }
                setRawJsonError('Content must be a JSON object.');
              } catch {
                setRawJsonError('Invalid JSON.');
              }
            }}
          />
          {rawJsonError ? (
            <p className="text-[10px] text-destructive mt-1">{rawJsonError}</p>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">Edits here update the other panels when valid JSON.</p>
          )}
        </div>
      </CardContent>

      <AlertDialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change layout?</AlertDialogTitle>
            <AlertDialogDescription>
              This updates how the reader renders the spread. Existing content is kept, but some fields may not show up in the new template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingType(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingType) return;
                onChangeType?.(pendingType);
                setPendingType(null);
              }}
            >
              Change Layout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
