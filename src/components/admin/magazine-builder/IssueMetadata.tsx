'use client';

import { Save, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MagazineIssue } from './types';

interface IssueMetadataProps {
  issue: MagazineIssue;
  isNew: boolean;
  isSaving: boolean;
  onUpdate: (data: Partial<MagazineIssue>) => void;
  onSave: () => void;
}

export function IssueMetadata({ issue, isNew, isSaving, onUpdate, onSave }: IssueMetadataProps) {
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
        <div className="lg:col-span-2">
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
              <div className="space-y-2">
                <Label htmlFor="pdf">Issuu Embed URL (Digital Reader)</Label>
                <Input 
                  id="pdf" 
                  value={issue.pdfUrl} 
                  onChange={(e) => onUpdate({ pdfUrl: e.target.value })} 
                  placeholder="https://e.issuu.com/embed.html?..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cover Asset</CardTitle>
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
                    <p className="text-xs text-muted-foreground italic">Enter a URL below to see a preview</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover">Cover Image URL</Label>
                <Input 
                  id="cover" 
                  value={issue.coverImage} 
                  onChange={(e) => onUpdate({ coverImage: e.target.value })} 
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
