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
    <Card className="min-h-[600px] border-accent/20 w-full overflow-hidden">
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Issue Spreads</CardTitle>
            <CardDescription className="text-[10px]">
              {pages.length} {pages.length === 1 ? 'page' : 'pages'} total.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
            <Layout className="h-12 w-12 text-muted-foreground opacity-10" />
            <p className="text-sm text-muted-foreground italic">No pages built yet.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pages.map((page, index) => (
              <div 
                key={page.docId}
                className={`flex items-center gap-2 p-1.5 rounded-md border transition-all ${
                  selectedPageId === page.docId 
                    ? 'border-accent bg-accent/5 shadow-sm' 
                    : 'border-border/50 bg-card hover:border-accent/30'
                }`}
              >
                <div 
                  className="flex items-center gap-2 flex-1 cursor-pointer min-w-0" 
                  onClick={() => onSelectPage(page.docId)}
                >
                  <div className="h-6 w-6 rounded bg-muted flex items-center justify-center font-serif text-[9px] font-bold shrink-0 border border-border/50">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[9px] uppercase tracking-widest truncate">
                      {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}
                    </h4>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-tight truncate">
                      {page.content?.title || page.content?.name || 'Untitled'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 border-l pl-1.5">
                  <div className="flex flex-col">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 text-muted-foreground hover:text-accent" 
                      disabled={index === 0 || isSaving}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMovePage(page.docId, 'up');
                      }}
                    >
                      <ChevronRight className="h-2 w-2 -rotate-90" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 text-muted-foreground hover:text-accent" 
                      disabled={index === pages.length - 1 || isSaving}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMovePage(page.docId, 'down');
                      }}
                    >
                      <ChevronRight className="h-2 w-2 rotate-90" />
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(page.docId);
                    }}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-3 w-3" />
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
