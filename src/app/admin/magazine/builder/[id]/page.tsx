'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Loader2,
  ExternalLink,
  Sparkles
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
  deleteMagazinePageAction,
  getGhostPostsAction
} from '@/app/actions/magazineActions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

// Modular Components - Type Only Imports
import { MagazineIssue, MagazinePage } from '@/components/admin/magazine-builder/types';

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

const GhostImporter = dynamic(() => import('@/components/admin/magazine-builder/GhostImporter').then(m => m.GhostImporter), {
  loading: () => <div className="h-60 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-accent/20" /><p className="text-xs text-muted-foreground italic">Initializing Ghost Importer...</p></div>
});

const ManualImporter = dynamic(() => import('@/components/admin/magazine-builder/ManualImporter').then(m => m.ManualImporter), {
  loading: () => <div className="h-60 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-accent/20" /><p className="text-xs text-muted-foreground italic">Initializing Manual Importer...</p></div>
});

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
    readerType: 'custom'
  });

  const [pages, setPages] = useState<MagazinePage[]>([]);

  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

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
      setActiveTab('builder');
    } catch (err) {
      toast.error('Batch extraction failed');
    } finally {
      setIsBatchSyncing(false);
    }
  };

  // Load Initial Data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
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
            ghostSyncTag: castIssue.ghostSyncTag || ''
          });
        }
      }

      // Load Pages
      const pagesRes = await getMagazinePagesAction(id);
      if (pagesRes?.success && pagesRes.data) {
        const sortedPages = [...(pagesRes.data as any[])].sort((a, b) => (a.id || 0) - (b.id || 0));
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

  const handleImportContent = async (post: any, type: string, targetPageId?: string) => {
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
              const allowed = ['p', 'br', 'strong', 'em', 'u', 'b', 'i'];
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
              image: post.feature_image || '',
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
              image: post.feature_image || '',
              text: cleanText, // Removed truncation limit
              tips: post.tags?.filter((t: any) => t.name !== post.primary_tag?.name).map((t: any) => t.name).slice(0, 5) || []
            };
            break;
          case 'feature-left':
            content = {
              name: post.primary_author?.name || 'Featured Guest',
              title: post.title || 'Feature Story',
              image: post.feature_image || '',
              intro: subtitle
            };
            break;
          case 'feature-right':
            content = {
              name: post.primary_author?.name || '',
              quote: pulloutQuote,
              text: cleanText, // Removed truncation limit
              image: post.feature_image || '',
              stats: [
                { label: 'READ TIME', value: `${post.reading_time || 5} MIN` },
                { label: 'TOPIC', value: post.primary_tag?.name?.toUpperCase() || 'NEWS' }
              ]
            };
            break;
          case 'lifestyle':
            content = {
              text: cleanText, // Removed truncation limit
              image: post.feature_image || '',
              highlights: post.tags?.slice(0, 4).map((t: any) => t.name) || []
            };
            break;
          case 'spotlight':
            content = {
              name: post.primary_author?.name || 'Member Name',
              role: post.primary_tag?.name || 'Entrepreneur',
              image: post.feature_image || '',
              message: pulloutQuote,
              bio: cleanText // Removed truncation limit
            };
            break;
          case 'partner':
            content = {
              brand: post.primary_author?.name || 'Partner Brand',
              headline: post.title,
              offer: 'Exclusive Member Benefit',
              image: post.feature_image || ''
            };
            break;
          case 'cover':
            content = {
              title: 'Yorkshire BusinessWoman',
              headline: post.title,
              subheadline: subtitle,
              date: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
              issue: 'LATEST',
              image: post.feature_image || ''
            };
            break;
          default:
            content = {
              title: post.title,
              author: post.primary_author?.name || 'YBW Team',
              image: post.feature_image,
              text: cleanText, // Removed truncation limit
              name: post.title,
              intro: subtitle,
              category: post.primary_tag?.name || 'Editorial'
            };
        }
      }

      if (targetPageId) {
        // Update existing page
        const res = await updateMagazinePageAction(id, targetPageId, { content });
        if (res.success) {
          toast.success(`Updated spread with content from "${post.title}"`);
          await loadData(true);
          setActiveTab('builder');
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

        const res = await addMagazinePageAction(id, newPage);
        if (res.success) {
          toast.success(`Smart Imported "${post.title}" as ${type}`);
          
          if (issue.autoSyncCover !== false && type === 'cover' && content.image) {
            await updateMagazineIssueAction(id, { coverImage: content.image });
            setIssue(prev => ({ ...prev, coverImage: content.image }));
            toast.info('Issue thumbnail updated from imported cover');
          }

          await loadData(true);
          setSelectedPageId(res.id as string);
          setActiveTab('builder');
        }
      }
    } catch (err) {
      toast.error('Failed to import content');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePageContent = async (pageDocId: string, content: any) => {
    // Optimistically update local state to reflect changes immediately
    setPages(prev => prev.map(p => 
      p.docId === pageDocId ? { ...p, content } : p
    ));
    
    setSaving(true);
    try {
      // PROACTIVE LOGIC: If this is a cover page, automatically sync its image to the issue metadata
      const page = pages.find(p => p.docId === pageDocId);
      if (issue.autoSyncCover !== false && page?.type === 'cover' && content.image && content.image !== issue.coverImage) {
        console.log('Auto-syncing cover image from page to issue metadata...');
        await updateMagazineIssueAction(id, { coverImage: content.image });
        setIssue(prev => ({ ...prev, coverImage: content.image }));
        toast.info('Issue thumbnail synced from cover page');
      }

      const res = await updateMagazinePageAction(id, pageDocId, { content });
      if (res.success) {
        toast.success('Spread content saved');
        // Re-load data to ensure server sync, but local state is already updated
        await loadData(false); 
      }
    } catch (error) {
      toast.error('Failed to save content');
      // Rollback on error if necessary
      await loadData(true);
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
      case 'cover': 
        return { 
          title: 'Yorkshire BusinessWoman', 
          headline: 'Edition Headline', 
          subheadline: 'Celebrating excellence and innovation across Yorkshire.', 
          date: issue.publishDate || new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), 
          issue: 'No. XX', 
          image: '' 
        };
      case 'editorial': 
        return { 
          title: 'Editor\'s Welcome', 
          author: 'Gill Laidler', 
          role: 'Editor-in-Chief', 
          image: '', 
          text: 'Welcome to this edition...', 
          quote: 'Empowering women in business across the region.' 
        };
      case 'contents': 
        return { 
          items: [
            { page: 2, category: 'EDITORIAL', title: 'Editor\'s Note' },
            { page: 4, category: 'FEATURE', title: 'Main Interview' }
          ], 
          news: ['Upcoming YBW Networking Event', 'New Member Benefits Launched'] 
        };
      case 'feature-left':
        return { 
          name: 'Featured Guest', 
          title: 'Article Headline', 
          image: '', 
          intro: 'An inspiring story of leadership and innovation...' 
        };
      case 'feature-right': 
        return { 
          name: 'Featured Guest',
          quote: 'Success is not final, failure is not fatal...', 
          text: 'The journey of building a brand in Yorkshire...', 
          stats: [{ label: 'READ TIME', value: '5 MIN' }], 
          image: '' 
        };
      case 'column': 
        return { 
          title: 'Expert Insights', 
          category: 'Finance & Growth', 
          author: 'Expert Name', 
          image: '', 
          text: 'In today\'s climate...', 
          tips: ['Plan ahead', 'Network often'] 
        };
      case 'lifestyle': 
        return { 
          text: 'Discover the balance between work and wellness...', 
          image: '', 
          highlights: ['Summer Style', 'Local Retreats'] 
        };
      case 'spotlight': 
        return { 
          name: 'Member Name', 
          role: 'CEO, Company Ltd', 
          image: '', 
          message: 'Consistency is key to growth.', 
          bio: 'A brief history of their professional journey...' 
        };
      case 'partner': 
        return { 
          brand: 'Partner Name', 
          headline: 'Premium Services for Members', 
          image: '', 
          offer: '20% Off for YBW Members' 
        };
      case 'back-cover': 
        return { 
          nextIssue: 'Coming Summer 2026', 
          cta: 'Become a Member Today', 
          socials: ['Instagram', 'LinkedIn', 'X'], 
          image: '' 
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
              <>
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

        <TabsContent value="metadata" className="mt-0">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-2 min-w-[200px]">
              <PageTypeSelector 
                onAddPage={handleAddPage}
                isSaving={saving}
              />
            </div>
            <div className="lg:col-span-4 min-w-[300px]">
              <PageList 
                pages={pages}
                selectedPageId={selectedPageId}
                onSelectPage={setSelectedPageId}
                onDeletePage={handleDeletePage}
                onMovePage={handleMovePage}
                isSaving={saving}
              />
            </div>
            <div className="lg:col-span-6">
              <PageEditor 
                page={pages.find(p => p.docId === selectedPageId)}
                onSave={(content) => {
                  if (selectedPageId) {
                    handleSavePageContent(selectedPageId, content);
                  }
                }}
                isSaving={saving}
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

                <div className="flex flex-col gap-8">
                  <GhostImporter 
                    onImport={handleImportContent} 
                    isImporting={saving}
                    selectedPageId={selectedPageId || undefined}
                    selectedPageType={pages.find(p => p.docId === selectedPageId)?.type}
                  />
                  <ManualImporter 
                    onImport={handleImportContent}
                    isImporting={saving}
                    selectedPageId={selectedPageId || undefined}
                    selectedPageType={pages.find(p => p.docId === selectedPageId)?.type}
                  />
                </div>
              </div>
            </TabsContent>
      </Tabs>
    </div>
  );
}
