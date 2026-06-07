'use client';

import { useState } from 'react';
import { Image as ImageIcon, ClipboardPaste, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export interface ManualImporterProps {
  onImport: (content: any, type: string, targetPageId?: string) => Promise<void>;
  isImporting: boolean;
  selectedPageId?: string;
  selectedPageType?: string;
}

export function ManualImporter({ onImport, isImporting, selectedPageId, selectedPageType }: ManualImporterProps) {
  const [rawText, setRawText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

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
      </CardContent>
    </Card>
  );
}
