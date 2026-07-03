'use client';

import { Save, Loader2, AlertCircle, Image as ImageIcon, Link as LinkIcon, Sparkles, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { MagazineIssue, MagazinePage } from './types';
import { toast } from 'sonner';
import { fetchIssuuMetadataAction, setLatestMagazineIssueAction } from '@/app/actions/magazineActions';
import { useState } from 'react';
import Link from 'next/link';

interface IssueMetadataProps {
  issue: MagazineIssue;
  isNew: boolean;
  isSaving: boolean;
  onUpdate: (data: Partial<MagazineIssue>) => void;
  onSave: () => void;
  pages?: MagazinePage[];
}

export function IssueMetadata({ issue, isNew, isSaving, onUpdate, onSave, pages = [] }: IssueMetadataProps) {
  const [isFetchingIssuu, setIsFetchingIssuu] = useState(false);
  
  // Logic to find cover image from pages
  const coverPage = pages.find(p => p.type === 'cover');
  const coverFromPages = coverPage?.content?.image;
  const canSync = coverFromPages && coverFromPages !== issue.coverImage;

  const handleSyncCover = () => {
    if (coverFromPages) {
      onUpdate({ coverImage: coverFromPages });
      toast.success('Thumbnail synced from Cover Spread');
    }
  };

  const handleFetchIssuuMetadata = async () => {
    if (!issue.pdfUrl) {
      toast.error('Please enter an Issuu URL first');
      return;
    }

    setIsFetchingIssuu(true);
    try {
      const res = await fetchIssuuMetadataAction(issue.pdfUrl);
      if (res.success && res.data) {
        // If auto-sync is on, update the cover image too
        const updateData: Partial<MagazineIssue> = {
          title: issue.title || res.data.title,
          description: issue.description || res.data.description
        };
        
        if (issue.autoSyncCover !== false) {
          updateData.coverImage = res.data.thumbnailUrl;
        }

        onUpdate(updateData);
        toast.success('Metadata fetched from Issuu!');
      } else {
        toast.error(res.error || 'Failed to fetch Issuu metadata');
      }
    } catch (err) {
      toast.error('An error occurred while fetching Issuu metadata');
    } finally {
      setIsFetchingIssuu(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Save className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h4 className="font-bold text-accent">Issue Configuration</h4>
            <p className="text-xs text-muted-foreground">Define the general details and branding for this edition.</p>
          </div>
        </div>
        <Button 
          onClick={onSave} 
          disabled={isSaving} 
          className="bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 px-8"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {isNew ? 'Create & Start Building' : 'Save Metadata'}
        </Button>
      </div>

      {isNew && (
        <Alert variant="default" className="bg-accent/10 border-accent/20 text-accent">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            You are creating a new edition. Please fill out the details and click <strong>Create & Start Building</strong> to enable the spread builder.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reader Technology</CardTitle>
              <CardDescription>Choose how members will read this edition.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={issue.readerType || 'custom'} 
                onValueChange={(val) => onUpdate({ readerType: val as 'custom' | 'issuu' })}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="custom" id="custom" className="peer sr-only" />
                  <Label
                    htmlFor="custom"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/5 hover:text-accent-foreground peer-data-[state=checked]:border-accent [&:has([data-state=checked])]:border-accent cursor-pointer transition-all"
                  >
                    <Sparkles className="mb-3 h-6 w-6 text-accent" />
                    <span className="font-bold">Digital Builder</span>
                    <span className="text-[10px] text-muted-foreground text-center mt-1">Our high-end, interactive custom reader.</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="issuu" id="issuu" className="peer sr-only" />
                  <Label
                    htmlFor="issuu"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/5 hover:text-accent-foreground peer-data-[state=checked]:border-accent [&:has([data-state=checked])]:border-accent cursor-pointer transition-all"
                  >
                    <LinkIcon className="mb-3 h-6 w-6 text-zinc-400" />
                    <span className="font-bold">Issuu External</span>
                    <span className="text-[10px] text-muted-foreground text-center mt-1">Embed an existing Issuu publication.</span>
                  </Label>
                </div>
              </RadioGroup>

              {issue.readerType === 'issuu' && (
                <Alert className="mt-4">
                  <AlertTitle>Issuu uses an embedded reader</AlertTitle>
                  <AlertDescription className="flex flex-col gap-3">
                    <span>
                      The Rocket-style custom reader (backgrounds, shimmer, page nav) only applies to <strong>Digital Builder</strong> editions.
                    </span>
                    <Button variant="outline" className="w-fit" asChild>
                      <Link href="/magazine/issue/demo" target="_blank">
                        Open Design Preview
                      </Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ghost CMS Integration</CardTitle>
              <CardDescription>Automatically pull articles into this edition.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ghostTag">Ghost Sync Tag</Label>
                <div className="flex gap-2">
                  <Input 
                    id="ghostTag" 
                    value={issue.ghostSyncTag || ''} 
                    onChange={(e) => onUpdate({ ghostSyncTag: e.target.value })} 
                    placeholder="e.g. Issue-April-2026"
                    className="font-mono text-xs"
                  />
                  <div className="h-10 w-10 shrink-0 bg-accent/10 rounded-md flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-accent" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Any Ghost article with this exact tag can be bulk-extracted into your spreads.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Core Details</CardTitle>
              <CardDescription>Public information about this magazine edition.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Edition Title</Label>
                  <Input 
                    id="title" 
                    value={issue.title} 
                    onChange={(e) => onUpdate({ title: e.target.value })} 
                    placeholder="e.g. April / May 2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Publish Date</Label>
                  <Input 
                    id="date" 
                    type="date"
                    value={issue.publishDate} 
                    onChange={(e) => onUpdate({ publishDate: e.target.value })} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Short Description</Label>
                <Textarea 
                  id="desc" 
                  value={issue.description} 
                  onChange={(e) => onUpdate({ description: e.target.value })} 
                  placeholder="What is special about this issue?"
                  rows={4}
                />
              </div>
              
              {issue.readerType === 'issuu' && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="issuuUrl" className="text-accent flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Issuu Publication Link
                    </Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] text-accent font-bold uppercase gap-2 hover:bg-accent/10"
                      onClick={handleFetchIssuuMetadata}
                      disabled={isFetchingIssuu}
                    >
                      {isFetchingIssuu ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      Fetch Cover & Info
                    </Button>
                  </div>
                  <Input 
                    id="issuuUrl" 
                    value={issue.pdfUrl} 
                    onChange={(e) => onUpdate({ pdfUrl: e.target.value })} 
                    placeholder="https://issuu.com/blackie365/docs/..."
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Paste the direct link to your Issuu publication. We will handle the embedding and cover extraction for you.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Archive Thumbnail</CardTitle>
              {canSync && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] text-accent font-bold uppercase gap-2 hover:bg-accent/10"
                  onClick={handleSyncCover}
                >
                  <RefreshCw className="h-3 w-3 animate-pulse" />
                  Sync from Spread
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-[3/4] rounded-lg border-2 border-dashed flex flex-col items-center justify-center bg-muted/30 overflow-hidden relative group">
                {issue.coverImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={issue.coverImage} alt="Cover Preview" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Button variant="secondary" size="sm" onClick={() => onUpdate({ coverImage: '' })}>Change Image</Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-xs text-muted-foreground italic">What people see in the archive</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover">Thumbnail URL</Label>
                <Input 
                  id="cover" 
                  value={issue.coverImage} 
                  onChange={(e) => onUpdate({ coverImage: e.target.value })} 
                  placeholder="https://..."
                />
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Smart Sync</Label>
                    <p className="text-[10px] text-muted-foreground">Keep archive & builder covers identical.</p>
                  </div>
                  <Switch 
                    checked={issue.autoSyncCover !== false}
                    onCheckedChange={(checked) => onUpdate({ autoSyncCover: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {!isNew && (
            <Card className={issue.isLatest ? "border-accent/30 bg-accent/5" : undefined}>
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
                <CardDescription>Control which edition is shown as live.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Live Edition</Label>
                    <p className="text-[10px] text-muted-foreground">
                      This is the edition highlighted on the Admin → Magazine page.
                    </p>
                  </div>
                  {issue.isLatest ? (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-accent">
                      Live
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px] font-bold uppercase"
                      onClick={async () => {
                        if (!issue.id) return;
                        if (!confirm("Set this edition as the live edition? This will replace the current live edition.")) {
                          return;
                        }
                        const res = await setLatestMagazineIssueAction(issue.id);
                        if (res.success) {
                          onUpdate({ isLatest: true });
                          toast.success("Live edition updated");
                        } else {
                          toast.error(res.error || "Failed to set live edition");
                        }
                      }}
                    >
                      Set Live
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {issue.readerType === 'custom' && coverPage && (
            <Card className="border-accent/20">
              <CardHeader>
                <CardTitle className="text-sm">Digital Reader Cover</CardTitle>
                <CardDescription className="text-[10px]">The &quot;clean&quot; image used inside the builder.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-[3/4] rounded bg-muted/50 overflow-hidden relative">
                  {coverFromPages ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={coverFromPages} alt="Builder Cover" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground italic text-[10px]">No image set in builder</div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="bg-white/90 p-3 rounded shadow-sm text-center border border-accent/20">
                      <p className="text-[10px] font-bold text-accent uppercase tracking-tighter">Builder Overlays</p>
                      <p className="text-[8px] text-zinc-500 leading-tight mt-1">{coverPage.content?.headline || 'Headline'}</p>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  To change this, edit the <strong>Main Cover</strong> spread in the builder.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
