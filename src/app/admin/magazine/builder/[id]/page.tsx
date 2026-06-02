'use client';

import { useState, useEffect, use } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical, 
  Image as ImageIcon, 
  Layout, 
  Type, 
  ChevronRight,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    publishDate: new Date().toISOString().split('T')[0],
    coverImage: '',
    pdfUrl: '',
    downloadUrl: '',
    isLatest: false,
    tags: []
  });
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const issuesRes = await getMagazineIssuesAction();
      const currentIssue = issuesRes.data?.find((i: any) => i.id === id);
      if (currentIssue) {
        setIssue(currentIssue);
      }

      const pagesRes = await getMagazinePagesAction(id);
      if (pagesRes.success && pagesRes.data) {
        setPages(pagesRes.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load magazine data');
    } finally {
      setLoading(false);
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

    const newPage = {
      id: pages.length + 1,
      type,
      content: getInitialContent(type),
      createdAt: new Date().toISOString()
    };

    const res = await addMagazinePageAction(id, newPage);
    if (res.success) {
      toast.success('Page added');
      loadData();
      setSelectedPageId(res.id as string);
    } else {
      toast.error('Failed to add page');
    }
  };

  const handleDeletePage = async (pageDocId: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;
    
    const res = await deleteMagazinePageAction(id, pageDocId);
    if (res.success) {
      toast.success('Page deleted');
      if (selectedPageId === pageDocId) setSelectedPageId(null);
      loadData();
    } else {
      toast.error('Failed to delete page');
    }
  };

  const getInitialContent = (type: string) => {
    switch (type) {
      case 'cover': return { title: 'Issue Title', headline: 'Main Headline', subheadline: 'Secondary text', date: issue.publishDate, issue: 'No. XX', image: '' };
      case 'editorial': return { title: 'Welcome', author: 'Gill Laidler', role: 'Editor-in-Chief', image: '', text: '', quote: '' };
      case 'contents': return { items: [], news: [] };
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Issue Details</CardTitle>
              <CardDescription>General information about this edition.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="desc">Short Description</Label>
                <Textarea 
                  id="desc" 
                  value={issue.description} 
                  onChange={(e) => setIssue({ ...issue, description: e.target.value })} 
                  placeholder="Brief summary of this issue..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover">Cover Image URL</Label>
                <div className="flex gap-2">
                  <Input 
                    id="cover" 
                    value={issue.coverImage} 
                    onChange={(e) => setIssue({ ...issue, coverImage: e.target.value })} 
                    placeholder="https://..."
                  />
                  <Button variant="outline" size="icon">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
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

          <Card className="border-accent/20 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-lg">Page Components</CardTitle>
              <CardDescription>Click to add a new spread to your edition.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {PAGE_TYPES.map((type) => (
                  <Button 
                    key={type.id} 
                    variant="outline" 
                    className="justify-start gap-3 h-12 hover:bg-accent/10 hover:border-accent/30"
                    onClick={() => handleAddPage(type.id)}
                    disabled={isNew}
                  >
                    <type.icon className="h-4 w-4 text-accent" />
                    {type.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Page Builder */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="min-h-[600px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Editorial Builder</CardTitle>
                  <CardDescription>Manage the sequence and content of your digital spreads.</CardDescription>
                </div>
                <Badge variant="outline">{pages.length} Pages</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <Layout className="h-8 w-8 text-muted-foreground opacity-20" />
                  </div>
                  <div className="max-w-xs">
                    <p className="text-muted-foreground font-medium italic">No pages built yet.</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">Start by adding a Cover Page from the components menu on the left.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {pages.map((page, index) => (
                    <div 
                      key={page.docId}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${selectedPageId === page.docId ? 'border-accent ring-1 ring-accent bg-accent/5' : 'border-border/50 bg-card hover:border-accent/30'}`}
                    >
                      <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setSelectedPageId(page.docId)}>
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                            {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}
                            {page.type === 'cover' && <Badge className="bg-accent text-white text-[8px] h-4">START</Badge>}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {JSON.stringify(page.content).substring(0, 100)}...
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-accent" onClick={() => setSelectedPageId(page.docId)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeletePage(page.docId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Page Content Editor */}
          {selectedPageId && (
            <PageEditor 
              page={pages.find(p => p.docId === selectedPageId)} 
              onSave={(content) => handleSavePage(selectedPageId, content)}
              isSaving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PageEditor({ page, onSave, isSaving }: { page: any, onSave: (content: any) => void, isSaving: boolean }) {
  const [content, setContent] = useState(page.content);

  useEffect(() => {
    setContent(page.content);
  }, [page.docId]);

  const updateContent = (field: string, value: any) => {
    setContent({ ...content, [field]: value });
  };

  const renderEditorFields = () => {
    switch (page.type) {
      case 'cover':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Headline</Label>
              <Input value={content.headline || ''} onChange={(e) => updateContent('headline', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Sub-headline</Label>
              <Textarea value={content.subheadline || ''} onChange={(e) => updateContent('subheadline', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date Text</Label>
              <Input value={content.date || ''} onChange={(e) => updateContent('date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Issue Number</Label>
              <Input value={content.issue || ''} onChange={(e) => updateContent('issue', e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Cover Background Image</Label>
              <Input value={content.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
          </div>
        );
      case 'editorial':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Editor Name</Label>
              <Input value={content.author || ''} onChange={(e) => updateContent('author', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Editor Image</Label>
              <Input value={content.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Editorial Text</Label>
              <Textarea rows={10} value={content.text || ''} onChange={(e) => updateContent('text', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pull Quote</Label>
              <Input value={content.quote || ''} onChange={(e) => updateContent('quote', e.target.value)} />
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
                value={JSON.stringify(content.items || [], null, 2)} 
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
                value={JSON.stringify(content.news || [], null, 2)} 
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
              <Input value={content.name || ''} onChange={(e) => updateContent('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Feature Image</Label>
              <Input value={content.image || ''} onChange={(e) => updateContent('image', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Introduction Text</Label>
              <Textarea value={content.intro || ''} onChange={(e) => updateContent('intro', e.target.value)} />
            </div>
          </div>
        );
      default:
        return <p className="text-muted-foreground italic">Editor for this page type is coming soon. You can still save raw data below.</p>;
    }
  };

  return (
    <Card className="border-accent/30 shadow-lg">
      <CardHeader className="bg-accent/5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl">Page Settings: {PAGE_TYPES.find(t => t.id === page.type)?.label}</CardTitle>
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
            value={JSON.stringify(content, null, 2)}
            onChange={(e) => {
              try {
                setContent(JSON.parse(e.target.value));
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
