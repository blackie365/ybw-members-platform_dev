'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Ghost, 
  DownloadCloud, 
  Loader2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getGhostPostsAction } from '@/app/actions/magazineActions';
import { toast } from 'sonner';

import { mapGhostToTemplate, MAGAZINE_TEMPLATES } from '@/lib/magazine-theme';

interface GhostImporterProps {
  onImport: (post: any, type: string, targetPageId?: string) => Promise<void>;
  isImporting: boolean;
  selectedPageId?: string;
  selectedPageType?: string;
}

export function GhostImporter({ onImport, isImporting, selectedPageId, selectedPageType }: GhostImporterProps) {
  const [ghostPosts, setGhostPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadGhostPosts = async () => {
    setLoading(true);
    try {
      const res = await getGhostPostsAction({ limit: 20 });
      if (res.success) {
        setGhostPosts(res.data || []);
      } else {
        toast.error(res.error || 'Failed to connect to Ghost');
      }
    } catch (err) {
      toast.error('Failed to load Ghost articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGhostPosts();
  }, []);

  const filteredPosts = ghostPosts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSmartImport = (post: any) => {
    const recommendedType = mapGhostToTemplate(post);
    onImport(post, recommendedType);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Import from Ghost CMS</CardTitle>
            <CardDescription>Select an article to convert into a magazine spread.</CardDescription>
          </div>
          <Button variant="outline" onClick={loadGhostPosts} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DownloadCloud className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search articles by title..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent mb-4" />
            <p className="text-muted-foreground italic font-serif">Connecting to Ghost...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed rounded-lg bg-muted/20">
            <Ghost className="h-8 w-8 mx-auto text-muted-foreground opacity-20 mb-2" />
            <p className="text-sm text-muted-foreground">No articles found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredPosts.map((post) => {
              const recommendedType = mapGhostToTemplate(post);
              const template = MAGAZINE_TEMPLATES.find(t => t.id === recommendedType);

              return (
                <Card key={post.id} className="overflow-hidden group hover:border-accent/50 transition-all">
                  <div className="flex gap-4 p-4">
                    <div className="h-24 w-24 rounded bg-muted overflow-hidden shrink-0 border relative">
                      {post.feature_image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={post.feature_image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Ghost className="h-full w-full p-6 text-muted-foreground opacity-20" />
                      )}
                      <div className="absolute top-1 right-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-accent text-white p-1 rounded-full shadow-lg">
                                <Info className="h-3 w-3" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="text-[10px] font-bold">AI Recommendation:</p>
                              <p className="text-[10px]">{template?.name || recommendedType}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-sm leading-tight pr-2">{post.title}</h4>
                      </div>
                      
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {post.primary_tag?.name || 'Uncategorized'} · {post.reading_time || 1} min read
                      </p>

                      <div className="flex flex-col gap-2 mt-3">
                        {selectedPageId && selectedPageType ? (
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <div className="flex items-center gap-2 px-2 py-1 bg-accent/10 border border-accent/20 rounded text-[9px] text-accent font-bold uppercase tracking-tighter whitespace-nowrap">
                              <Info className="h-3 w-3" />
                              Target: {selectedPageType.toUpperCase()}
                            </div>
                            <Button 
                              size="sm" 
                              className="w-full h-8 text-[10px] uppercase font-bold tracking-widest bg-black hover:bg-zinc-800 text-white shadow-lg"
                              onClick={() => onImport(post, selectedPageType, selectedPageId)}
                              disabled={isImporting}
                            >
                              {isImporting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Ghost className="h-3 w-3 mr-2" />}
                              Import Content
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <Button 
                              size="sm" 
                              className="w-full h-7 text-[10px] uppercase font-bold tracking-widest bg-accent hover:bg-accent/90 text-white"
                              onClick={() => handleSmartImport(post)}
                              disabled={isImporting}
                            >
                              {isImporting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Ghost className="h-3 w-3 mr-2" />}
                              Smart Import ({template?.name.split(' ')[0]})
                            </Button>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[8px] text-muted-foreground w-full mb-0.5 uppercase tracking-tighter opacity-50">Create New spread:</span>
                          {MAGAZINE_TEMPLATES.filter(t => t.category === 'content' || t.category === 'feature').slice(0, 3).map(t => (
                            <Button 
                              key={t.id}
                              variant="ghost" 
                              size="sm" 
                              className="h-5 text-[8px] uppercase font-bold tracking-tighter px-1.5 opacity-60 hover:opacity-100"
                              onClick={() => onImport(post, t.id)}
                              disabled={isImporting}
                            >
                              {t.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
