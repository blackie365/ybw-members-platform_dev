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

interface GhostImporterProps {
  onImport: (post: any, type: string) => Promise<void>;
  isImporting: boolean;
}

export function GhostImporter({ onImport, isImporting }: GhostImporterProps) {
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPosts.map((post) => (
              <Card key={post.id} className="overflow-hidden group hover:border-accent/50 transition-all">
                <div className="flex gap-4 p-4">
                  <div className="h-20 w-20 rounded bg-muted overflow-hidden shrink-0 border">
                    {post.feature_image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={post.feature_image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Ghost className="h-full w-full p-6 text-muted-foreground opacity-20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-sm truncate pr-2">{post.title}</h4>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground shrink-0 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px]">
                            <p className="text-[10px]">Published: {new Date(post.published_at).toLocaleDateString()}</p>
                            <p className="text-[10px] mt-1 line-clamp-2">{post.excerpt || 'No excerpt available'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-6 text-[9px] uppercase font-bold tracking-wider px-2"
                        onClick={() => onImport(post, 'editorial')}
                        disabled={isImporting}
                      >
                        Editorial
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-6 text-[9px] uppercase font-bold tracking-wider px-2"
                        onClick={() => onImport(post, 'feature-left')}
                        disabled={isImporting}
                      >
                        Feature
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-6 text-[9px] uppercase font-bold tracking-wider px-2"
                        onClick={() => onImport(post, 'column')}
                        disabled={isImporting}
                      >
                        Column
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
