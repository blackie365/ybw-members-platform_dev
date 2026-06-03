'use client';

import { 
  Trash2, 
  Layout, 
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PAGE_TYPES, MagazinePage } from './types';

interface PageListProps {
  pages: MagazinePage[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onMovePage: (id: string, direction: 'up' | 'down') => void;
  isSaving: boolean;
}

export function PageList({ 
  pages, 
  selectedPageId, 
  onSelectPage, 
  onDeletePage, 
  onMovePage,
  isSaving 
}: PageListProps) {
  return (
    <Card className="min-h-[600px] border-accent/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Issue Spreads</CardTitle>
            <CardDescription className="text-xs">
              {pages.length} {pages.length === 1 ? 'page' : 'pages'} total.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
            <Layout className="h-12 w-12 text-muted-foreground opacity-10" />
            <p className="text-sm text-muted-foreground italic">No pages built yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((page, index) => (
              <div 
                key={page.docId}
                className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                  selectedPageId === page.docId 
                    ? 'border-accent bg-accent/5 shadow-sm' 
                    : 'border-border/50 bg-card hover:border-accent/30'
                }`}
              >
                <div 
                  className="flex items-center gap-3 flex-1 cursor-pointer min-w-0" 
                  onClick={() => onSelectPage(page.docId)}
                >
                  <div className="h-7 w-7 rounded bg-muted flex items-center justify-center font-serif text-[10px] font-bold shrink-0 border border-border/50">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[10px] uppercase tracking-widest truncate">
                      {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}
                    </h4>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-tight truncate">
                      {page.content?.title || page.content?.name || 'Untitled'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 border-l pl-2">
                  <div className="flex flex-col">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-muted-foreground hover:text-accent" 
                      disabled={index === 0 || isSaving}
                      onClick={() => onMovePage(page.docId, 'up')}
                    >
                      <ChevronRight className="h-2.5 w-2.5 -rotate-90" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-muted-foreground hover:text-accent" 
                      disabled={index === pages.length - 1 || isSaving}
                      onClick={() => onMovePage(page.docId, 'down')}
                    >
                      <ChevronRight className="h-2.5 w-2.5 rotate-90" />
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors" 
                    onClick={() => onDeletePage(page.docId)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
