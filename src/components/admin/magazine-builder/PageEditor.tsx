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
  const [lifestyleImagesDraft, setLifestyleImagesDraft] = useState<string>('[]');
  const lastLoadedDocIdRef = useRef<string | null>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);

  useEffect(() => {
    if (!page?.docId) return;
    if (lastLoadedDocIdRef.current === page.docId) return;
    lastLoadedDocIdRef.current = page.docId;

    const nextContent = page.content || {};
    setContent(nextContent);

    if (page.type === 'lifestyle') {
      const initial = Array.isArray((nextContent as any)?.images) ? (nextContent as any).images : [];
      setLifestyleImagesDraft(JSON.stringify(initial, null, 2));
    } else {
      setLifestyleImagesDraft('[]');
    }

    setPendingType(null);
    setIsTypeDialogOpen(false);
  }, [page?.docId, page?.content, page?.type]);

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
        onClick={() => insertTextAtCursor(field, '<ul><li>', '</li></ul>')}
        title="Bulleted list"
      >
        <span className="text-[10px] font-bold">UL</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => insertTextAtCursor(field, '<ol><li>', '</li></ol>')}
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
              <Label className="text-accent flex items-center gap-1.5 font-bold"><Edit2 className="h-3 w-3" /> Video Background URL (Optional)</Label>
              <Input value={safeContent.videoUrl || ''} onChange={(e) => updateContent('videoUrl', e.target.value)} placeholder="https://...mp4" />
              <p className="text-[10px] text-muted-foreground italic">If provided, this video will replace the static background image.</p>
            </div>
          </div>
        );
      case 'editorial':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Editor Name</Label>
                <Input value={safeContent.author || ''} onChange={(e) => updateContent('author', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Editor Image URL</Label>
                <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
              </div>
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
                value={JSON.stringify(safeContent.items || [], null, 2)} 
                onChange={(e) => {
                  try { updateContent('items', JSON.parse(e.target.value)); } catch (err) {}
                }} 
              />
              <p className="text-[10px] text-muted-foreground">Format: {"[{\"page\": 4, \"category\": \"LIFESTYLE\", \"title\": \"Summer Fashion\"}]"}</p>
            </div>
            <div className="space-y-2">
              <Label>Regional News (JSON Array of Strings)</Label>
              <Textarea 
                rows={4} 
                value={JSON.stringify(safeContent.news || [], null, 2)} 
                onChange={(e) => {
                  try { updateContent('news', JSON.parse(e.target.value)); } catch (err) {}
                }} 
              />
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
              <Label>Stats (JSON Array)</Label>
              <Textarea 
                rows={4} 
                value={JSON.stringify(safeContent.stats || [], null, 2)} 
                onChange={(e) => {
                  try { updateContent('stats', JSON.parse(e.target.value)); } catch (err) {}
                }} 
              />
              <p className="text-[10px] text-muted-foreground">Format: {"[{\"label\": \"YEARS\", \"value\": \"15\"}]"}</p>
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
              <Label>Tips (JSON Array of Strings)</Label>
              <Textarea 
                rows={4} 
                value={JSON.stringify(safeContent.tips || [], null, 2)} 
                onChange={(e) => {
                  try { updateContent('tips', JSON.parse(e.target.value)); } catch (err) {}
                }} 
              />
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
                  const normalized = next.trim();
                  if (!normalized) {
                    updateContent('images', []);
                    return;
                  }

                  try {
                    const parsed = JSON.parse(normalized);
                    if (Array.isArray(parsed)) {
                      const urls = parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
                      updateContent('images', urls);
                      return;
                    }
                    if (typeof parsed === 'string') {
                      const url = parsed.trim();
                      updateContent('images', url ? [url] : []);
                      return;
                    }
                  } catch (err) {}

                  const urls = normalized
                    .split(/[\n,]+/g)
                    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
                    .filter(Boolean);
                  updateContent('images', urls);
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
              <Label>Highlights (JSON Array of Strings)</Label>
              <Textarea 
                rows={4} 
                value={JSON.stringify(safeContent.highlights || [], null, 2)} 
                onChange={(e) => {
                  try { updateContent('highlights', JSON.parse(e.target.value)); } catch (err) {}
                }} 
              />
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
                value={JSON.stringify(safeContent.socials || [], null, 2)} 
                onChange={(e) => {
                  try { updateContent('socials', JSON.parse(e.target.value)); } catch (err) {}
                }} 
              />
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

  return (
    <Card className="border-accent/30 shadow-lg">
      <CardHeader className="bg-accent/5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-xl">Page Settings: {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}</CardTitle>
          <CardDescription>Edit the visual elements and text for this spread.</CardDescription>
        </div>
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
          <Button onClick={() => onSave(content)} disabled={isSaving} className="bg-accent text-white">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Page
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
        {renderEditorFields()}
        
        <div className="mt-8 pt-6 border-t">
          <Label className="text-xs text-muted-foreground uppercase tracking-widest">Raw Content JSON</Label>
          <Textarea 
            className="font-mono text-[10px] mt-2 bg-muted/30 focus:bg-white transition-colors" 
            rows={5}
            value={JSON.stringify(content || {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (typeof parsed === 'object' && parsed !== null) {
                  setContent(parsed);
                }
              } catch (err) {
                // Ignore invalid JSON while typing
              }
            }}
          />
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
