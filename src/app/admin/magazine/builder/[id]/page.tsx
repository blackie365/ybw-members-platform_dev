'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Loader2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  getMagazinePagesAction, 
  getMagazineIssuesAction, 
  updateMagazineIssueAction,
  createMagazineIssueAction,
  addMagazinePageAction,
  updateMagazinePageAction,
  deleteMagazinePageAction
} from '@/app/actions/magazineActions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Modular Components
import { MagazineIssue, MagazinePage } from '@/components/admin/magazine-builder/types';
import { IssueMetadata } from '@/components/admin/magazine-builder/IssueMetadata';
import { PageList } from '@/components/admin/magazine-builder/PageList';
import { PageEditor } from '@/components/admin/magazine-builder/PageEditor';
import { GhostImporter } from '@/components/admin/magazine-builder/GhostImporter';

export default function MagazineBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('metadata');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const [issue, setIssue] = useState<MagazineIssue>({
    title: '',
    description: '',
    publishDate: '',
    coverImage: '',
    pdfUrl: '',
    downloadUrl: '',
    isLatest: false,
    tags: []
  });

  const [pages, setPages] = useState<MagazinePage[]>([]);

  // Load Initial Data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Load Issue
      const issuesRes = await getMagazineIssuesAction();
      if (issuesRes?.success && issuesRes.data) {
        const currentIssue = issuesRes.data.find((i: any) => i.id === id);
        if (currentIssue) {
          // Format date for <input type="date">
          let formattedDate = currentIssue.publishDate || '';
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
          
          setIssue({ ...currentIssue, publishDate: formattedDate });
        }
      }

      // Load Pages
      const pagesRes = await getMagazinePagesAction(id);
      if (pagesRes?.success && pagesRes.data) {
        const sortedPages = [...pagesRes.data].sort((a, b) => (a.id || 0) - (b.id || 0));
        setPages(sortedPages);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load magazine data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

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

  // Issue Handlers
  const handleSaveIssue = async () => {
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

  // Page Handlers
  const handleAddPage = async (type: string) => {
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

      const res = await addMagazinePageAction(id, newPage);
      if (res.success) {
        toast.success('Spread added successfully');
        await loadData(true);
        setSelectedPageId(res.id as string);
        setActiveTab('builder');
      }
    } catch (error) {
      toast.error('Failed to add page');
    } finally {
      setSaving(false);
    }
  };

  const handleImportContent = async (post: any, type: string) => {
    setSaving(true);
    try {
      const maxId = pages.reduce((max, p) => Math.max(max, p.id || 0), 0);
      const content = {
        title: post.title,
        author: post.primary_author?.name || 'YBW Team',
        image: post.feature_image,
        text: post.excerpt || post.custom_excerpt || '',
        name: post.title,
        intro: post.custom_excerpt || '',
        category: post.primary_tag?.name || 'Editorial',
        quote: '',
        stats: [],
        tips: [],
        highlights: []
      };

      const newPage = {
        id: maxId + 1,
        type,
        content,
        createdAt: new Date().toISOString()
      };

      const res = await addMagazinePageAction(id, newPage);
      if (res.success) {
        toast.success(`Imported "${post.title}" successfully`);
        await loadData(true);
        setSelectedPageId(res.id as string);
        setActiveTab('builder');
      }
    } catch (err) {
      toast.error('Failed to import content');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePageContent = async (pageDocId: string, content: any) => {
    setSaving(true);
    try {
      const res = await updateMagazinePageAction(id, pageDocId, { content });
      if (res.success) {
        toast.success('Spread content saved');
        await loadData(true);
      }
    } catch (error) {
      toast.error('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const handleMovePage = async (pageDocId: string, direction: 'up' | 'down') => {
    const currentIndex = pages.findIndex(p => p.docId === pageDocId);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === pages.length - 1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentPage = pages[currentIndex];
    const targetPage = pages[targetIndex];

    setSaving(true);
    try {
      await Promise.all([
        updateMagazinePageAction(id, currentPage.docId, { id: targetPage.id }),
        updateMagazinePageAction(id, targetPage.docId, { id: currentPage.id })
      ]);
      await loadData(true);
    } catch (err) {
      toast.error('Failed to reorder pages');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (pageDocId: string) => {
    if (!confirm('Are you sure you want to delete this spread?')) return;
    setSaving(true);
    try {
      const res = await deleteMagazinePageAction(id, pageDocId);
      if (res.success) {
        toast.success('Spread removed');
        if (selectedPageId === pageDocId) setSelectedPageId(null);
        await loadData(true);
      }
    } catch (error) {
      toast.error('Error deleting spread');
    } finally {
      setSaving(false);
    }
  };

  const getInitialContent = (type: string) => {
    switch (type) {
      case 'cover': return { title: 'Yorkshire BusinessWoman', headline: 'Main Headline', subheadline: 'Secondary text', date: issue.publishDate, issue: 'No. XX', image: '' };
      case 'editorial': return { title: 'Welcome', author: 'Gill Laidler', role: 'Editor-in-Chief', image: '', text: '', quote: '' };
      case 'contents': return { items: [], news: [] };
      case 'feature-left':
      case 'feature-right': return { name: 'Person Name', title: 'Featured Interview', image: '', intro: '', quote: '', stats: [] };
      case 'column': return { title: 'Column Title', category: 'Expert Column', author: 'Author Name', image: '', text: '', tips: [] };
      case 'lifestyle': return { title: 'Lifestyle Spread', text: '', image: '', highlights: [] };
      case 'spotlight': return { name: 'Member Name', role: 'Company & Role', image: '', message: '', bio: '' };
      case 'partner': return { brand: 'Partner Name', headline: 'Featured Partner', image: '', offer: '', socials: [] };
      case 'back-cover': return { nextIssue: 'Coming Next Month...', cta: 'Join Us', socials: ['Instagram', 'LinkedIn', 'Twitter'], image: '' };
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
        <div className="flex gap-4">
          {!isNew && (
            <Button variant="outline" asChild>
              <Link href={`/magazine/issue/${id}`} target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Reader
              </Link>
            </Button>
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

        <TabsContent value="metadata" className="mt-0">
          <IssueMetadata 
            issue={issue} 
            isNew={isNew} 
            isSaving={saving} 
            onUpdate={(data) => setIssue(prev => ({ ...prev, ...data }))}
            onSave={handleSaveIssue}
          />
        </TabsContent>

        <TabsContent value="builder" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-full">
              <PageList 
                pages={pages}
                selectedPageId={selectedPageId}
                onSelectPage={setSelectedPageId}
                onAddPage={handleAddPage}
                onDeletePage={handleDeletePage}
                onMovePage={handleMovePage}
                isSaving={saving}
              />
            </div>
            <div className="h-full">
              <PageEditor 
                page={pages.find(p => p.docId === selectedPageId)}
                onSave={(content) => handleSavePageContent(selectedPageId!, content)}
                isSaving={saving}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="import" className="mt-0">
          <GhostImporter 
            onImport={handleImportContent}
            isImporting={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
