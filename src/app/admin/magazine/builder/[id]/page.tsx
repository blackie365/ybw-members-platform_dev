'use client';

import { useState, useEffect, use } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Layout, 
  Type, 
  ChevronRight,
  Loader2,
  ExternalLink,
  Edit2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

const PAGE_TYPES = [
  { id: 'cover', label: 'Cover Page', icon: ImageIcon },
  { id: 'editorial', label: 'Editor\'s Note', icon: Type },
  { id: 'contents', label: 'Contents & News', icon: Layout },
  { id: 'feature-left', label: 'Feature (Left Image)', icon: Layout },
  { id: 'feature-right', label: 'Feature (Right Image)', icon: Layout },
  { id: 'column', label: 'Expert Column', icon: Type },
  { id: 'lifestyle', label: 'Lifestyle Spread', icon: ImageIcon },
  { id: 'spotlight', label: 'Business Spotlight', icon: Layout },
  { id: 'partner', label: 'Partner Showcase', icon: Layout },
  { id: 'back-cover', label: 'Back Cover', icon: ImageIcon },
];

export default function MagazineBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<any>({
    title: '',
    description: '',
    publishDate: '',
    coverImage: '',
    pdfUrl: '',
    downloadUrl: '',
    isLatest: false,
    tags: []
  });

  useEffect(() => {
    if (isNew) {
      setIssue((prev: any) => ({
        ...prev,
        publishDate: new Date().toISOString().split('T')[0]
      }));
    }
  }, [isNew]);

  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('metadata');

  useEffect(() => {
    if (!isNew) {
      loadData();
    }
  }, [id]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      console.log(`[MagazineBuilder] Loading data for issue: ${id}`);
      const issuesRes = await getMagazineIssuesAction();
      if (issuesRes?.success && issuesRes.data) {
        const currentIssue = issuesRes.data.find((i: any) => i.id === id);
        if (currentIssue) {
          // Ensure publishDate is in YYYY-MM-DD format for the date input
          let formattedDate = (currentIssue as any).publishDate || '';
          
          if (formattedDate && typeof formattedDate !== 'string') {
            // Handle Firestore Timestamp if it exists
            try {
              if ((formattedDate as any).seconds) {
                formattedDate = new Date((formattedDate as any).seconds * 1000).toISOString().split('T')[0];
              } else if (formattedDate instanceof Date) {
                formattedDate = formattedDate.toISOString().split('T')[0];
              } else {
                formattedDate = new Date().toISOString().split('T')[0];
              }
            } catch (e) {
              console.error('Error formatting date:', e);
              formattedDate = new Date().toISOString().split('T')[0];
            }
          } else if (typeof formattedDate === 'string' && formattedDate.includes('T')) {
            formattedDate = formattedDate.split('T')[0];
          }
          
          setIssue({
            ...currentIssue,
            publishDate: formattedDate
          });
        }
      }

      const pagesRes = await getMagazinePagesAction(id);
      if (pagesRes?.success && pagesRes.data) {
        console.log(`[MagazineBuilder] Loaded ${pagesRes.data.length} pages`);
        setPages(pagesRes.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load magazine data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSaveIssue = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const res = await createMagazineIssueAction(issue);
        if (res.success) {
          toast.success('Issue created successfully');
          router.push(`/admin/magazine/builder/${res.id}`);
        } else {
          toast.error(res.error || 'Failed to create issue');
        }
      } else {
        const res = await updateMagazineIssueAction(id, issue);
        if (res.success) {
          toast.success('Issue updated successfully');
          await loadData(true);
        } else {
          toast.error(res.error || 'Failed to update issue');
        }
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPage = async (type: string) => {
    if (isNew) {
      toast.error('Please save the issue details first');
      return;
    }

    try {
      const newPage = {
        id: pages.length + 1,
        type,
        content: getInitialContent(type),
        createdAt: new Date().toISOString()
      };

      console.log(`[MagazineBuilder] Adding page of type: ${type}`);
      const res = await addMagazinePageAction(id, newPage);
      if (res.success) {
        toast.success('Page added');
        await loadData(true); // Silent refresh
        setSelectedPageId(res.id as string);
        setActiveTab('builder'); // Ensure we stay on builder tab
      } else {
        toast.error(res.error || 'Failed to add page');
      }
    } catch (error) {
      console.error('Error adding page:', error);
      toast.error('An unexpected error occurred while adding the page');
    }
  };

  const handleDeletePage = async (pageDocId: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;
    
    try {
      const res = await deleteMagazinePageAction(id, pageDocId);
      if (res.success) {
        toast.success('Page deleted');
        if (selectedPageId === pageDocId) setSelectedPageId(null);
        await loadData(true);
      } else {
        toast.error('Failed to delete page');
      }
    } catch (error) {
      toast.error('Error deleting page');
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

  const handleSavePage = async (pageDocId: string, content: any) => {
    setSaving(true);
    try {
      const res = await updateMagazinePageAction(id, pageDocId, { content });
      if (res.success) {
        toast.success('Page content saved');
        loadData();
      } else {
        toast.error('Failed to save page');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/magazine">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-serif font-bold">
              {isNew ? 'Create New Edition' : `Editing: ${issue.title}`}
            </h1>
            <p className="text-muted-foreground">Configure issue details and build digital spreads.</p>
          </div>
        </div>
        <div className="flex gap-4">
          {!isNew && (
            <Button variant="outline" asChild>
              <Link href={`/magazine/issue/${id}`} target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Reader
              </Link>
            </Button>
          )}
          <Button onClick={handleSaveIssue} disabled={saving} className="bg-accent hover:bg-accent/90 text-white min-w-[120px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isNew ? 'Create Issue' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="metadata" className="rounded-lg px-8">Issue Metadata</TabsTrigger>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <TabsTrigger 
                    value="builder" 
                    className="rounded-lg px-8" 
                    disabled={isNew}
                  >
                    Editorial Builder
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isNew && (
                <TooltipContent side="top">
                  <p>Save issue details first to enable the builder</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TabsList>

        <TabsContent value="metadata" className="mt-0">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Save className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-accent">Save Metadata</h4>
                  <p className="text-xs text-muted-foreground">Changes must be saved to enable the builder spreads.</p>
                </div>
              </div>
              <Button 
                onClick={handleSaveIssue} 
                disabled={saving} 
                className="bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 px-8"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {isNew ? 'Create & Unlock Builder' : 'Save All Changes'}
              </Button>
            </div>

            {isNew && (
              <Alert variant="default" className="bg-accent/10 border-accent/20 text-accent">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Action Required</AlertTitle>
                <AlertDescription>
                  You are creating a new edition. Please fill out the details and click <strong>Create & Unlock Builder</strong> to start adding pages.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Issue Details</CardTitle>
                  <CardDescription>General information about this edition.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Issue Title</Label>
                      <Input 
                        id="title" 
                        value={issue.title} 
                        onChange={(e) => setIssue({ ...issue, title: e.target.value })} 
                        placeholder="e.g. April / May 2026"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Publish Date</Label>
                      <Input 
                        id="date" 
                        type="date"
                        value={issue.publishDate} 
                        onChange={(e) => setIssue({ ...issue, publishDate: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc">Short Description</Label>
                    <Textarea 
                      id="desc" 
                      value={issue.description} 
                      onChange={(e) => setIssue({ ...issue, description: e.target.value })} 
                      placeholder="Brief summary of this issue..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pdf">Issuu Embed URL (Flipping Book)</Label>
                    <Input 
                      id="pdf" 
                      value={issue.pdfUrl} 
                      onChange={(e) => setIssue({ ...issue, pdfUrl: e.target.value })} 
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
                           <Button variant="secondary" size="sm" onClick={() => setIssue({ ...issue, coverImage: '' })}>Change Image</Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                        <p className="text-xs text-muted-foreground">Enter URL below to preview cover</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cover">Cover Image URL</Label>
                    <Input 
                      id="cover" 
                      value={issue.coverImage} 
                      onChange={(e) => setIssue({ ...issue, coverImage: e.target.value })} 
                      placeholder="https://..."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </TabsContent>

        <TabsContent value="builder" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <Card className="border-accent/20 bg-accent/5">
                <CardHeader>
                  <CardTitle className="text-lg">Page Components</CardTitle>
                  <CardDescription>Click to add a new spread.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2">
                    {PAGE_TYPES.map((type) => (
                      <Button 
                        key={type.id} 
                        variant="outline" 
                        className="justify-start gap-3 h-12 hover:bg-accent/10 hover:border-accent/30 bg-white"
                        onClick={() => handleAddPage(type.id)}
                      >
                        <type.icon className="h-4 w-4 text-accent" />
                        {type.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="min-h-[600px]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Spreads</CardTitle>
                      <CardDescription>{pages.length} pages in this edition</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {pages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
                      <Layout className="h-8 w-8 text-muted-foreground opacity-20" />
                      <p className="text-sm text-muted-foreground">No pages built yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pages.map((page, index) => (
                        <div 
                          key={page.docId}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${selectedPageId === page.docId ? 'border-accent bg-accent/5' : 'border-border/50 bg-card hover:border-accent/30'}`}
                        >
                          <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setSelectedPageId(page.docId)}>
                            <div className="h-7 w-7 rounded bg-muted flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-[11px] uppercase tracking-wider truncate">
                                {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}
                              </h4>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeletePage(page.docId)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedPageId === page.docId ? 'rotate-90 text-accent' : ''}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {selectedPageId ? (
                <PageEditor 
                  page={pages.find(p => p.docId === selectedPageId)} 
                  onSave={(content) => handleSavePage(selectedPageId, content)}
                  isSaving={saving}
                />
              ) : (
                <Card className="h-full border-dashed flex items-center justify-center text-center p-12 bg-muted/10">
                  <div className="max-w-xs">
                    <Edit2 className="h-8 w-8 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <p className="text-sm text-muted-foreground">Select a page from the list to edit its content.</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PageEditor({ page, onSave, isSaving }: { page: any, onSave: (content: any) => void, isSaving: boolean }) {
  const [content, setContent] = useState<any>({});

  useEffect(() => {
    if (page?.content) {
      setContent(page.content);
    } else {
      setContent({});
    }
  }, [page?.docId, page?.content]);

  if (!page) return null;

  const updateContent = (field: string, value: any) => {
    setContent((prev: any) => ({ ...prev, [field]: value }));
  };

  const renderEditorFields = () => {
    // Ensure content is an object to prevent crashes
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
              <Textarea value={safeContent.subheadline || ''} onChange={(e) => updateContent('subheadline', e.target.value)} />
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
          </div>
        );
      case 'editorial':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Editor Name</Label>
              <Input value={safeContent.author || ''} onChange={(e) => updateContent('author', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Editor Image</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Editorial Text</Label>
              <Textarea rows={10} value={safeContent.text || ''} onChange={(e) => updateContent('text', e.target.value)} />
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
          </div>
        );
      case 'feature-left':
      case 'feature-right':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Person/Feature Name</Label>
              <Input value={safeContent.name || ''} onChange={(e) => updateContent('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Feature Image</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Introduction Text</Label>
              <Textarea value={safeContent.intro || ''} onChange={(e) => updateContent('intro', e.target.value)} />
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
              <Label>Column Text</Label>
              <Textarea rows={6} value={safeContent.text || ''} onChange={(e) => updateContent('text', e.target.value)} />
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
          </div>
        );
      case 'lifestyle':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lifestyle Image</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Main Text</Label>
              <Textarea rows={6} value={safeContent.text || ''} onChange={(e) => updateContent('text', e.target.value)} />
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
          </div>
        );
      case 'spotlight':
        return (
          <div className="space-y-4">
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
              <Label>Member Quote/Message</Label>
              <Textarea value={safeContent.message || ''} onChange={(e) => updateContent('message', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Biography</Label>
              <Textarea rows={4} value={safeContent.bio || ''} onChange={(e) => updateContent('bio', e.target.value)} />
            </div>
          </div>
        );
      case 'partner':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Partner Brand</Label>
              <Input value={safeContent.brand || ''} onChange={(e) => updateContent('brand', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={safeContent.headline || ''} onChange={(e) => updateContent('headline', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Feature Image</Label>
              <Input value={safeContent.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
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
              Editor for "{PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}" is coming soon. 
              You can still edit the raw JSON data below.
            </p>
          </div>
        );
    }
  };

  return (
    <Card className="border-accent/30 shadow-lg">
      <CardHeader className="bg-accent/5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl">Page Settings: {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}</CardTitle>
          <CardDescription>Edit the visual elements and text for this spread.</CardDescription>
        </div>
        <Button onClick={() => onSave(content)} disabled={isSaving} className="bg-accent text-white">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Page
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {renderEditorFields()}
        
        <div className="mt-8 pt-6 border-t">
          <Label className="text-xs text-muted-foreground uppercase tracking-widest">Raw Content JSON</Label>
          <Textarea 
            className="font-mono text-[10px] mt-2 bg-muted/30" 
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
    </Card>
  );
}
