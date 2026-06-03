'use client';

import { 
  Plus, 
  Trash2, 
  Layout, 
  ChevronRight,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PAGE_TYPES, MagazinePage } from './types';

interface PageListProps {
  pages: MagazinePage[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: (type: string) => void;
  onDeletePage: (id: string) => void;
  onMovePage: (id: string, direction: 'up' | 'down') => void;
  isSaving: boolean;
}

export function PageList({ 
  pages, 
  selectedPageId, 
  onSelectPage, 
  onAddPage, 
  onDeletePage, 
  onMovePage,
  isSaving 
}: PageListProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      {/* Page Type Selector */}
      <div className="space-y-6">
        <Card className="border-accent/20 bg-accent/5 sticky top-8">
          <CardHeader>
            <CardTitle className="text-lg">Page Components</CardTitle>
            <CardDescription>Add a new spread to your magazine.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {PAGE_TYPES.map((type) => (
                <Button 
                  key={type.id} 
                  variant="outline" 
                  className="justify-start gap-3 h-12 hover:bg-accent/10 hover:border-accent/30 bg-white"
                  onClick={() => onAddPage(type.id)}
                  disabled={isSaving}
                >
                  <type.icon className="h-4 w-4 text-accent" />
                  {type.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spreads List */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="min-h-[600px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Issue Spreads</CardTitle>
                <CardDescription>
                  {pages.length} {pages.length === 1 ? 'page' : 'pages'} in this edition. Drag or use arrows to reorder.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
                <Layout className="h-12 w-12 text-muted-foreground opacity-10" />
                <p className="text-sm text-muted-foreground italic">No pages built yet. Start by adding a cover!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pages.map((page, index) => (
                  <div 
                    key={page.docId}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      selectedPageId === page.docId 
                        ? 'border-accent bg-accent/5 shadow-md shadow-accent/5' 
                        : 'border-border/50 bg-card hover:border-accent/30'
                    }`}
                  >
                    <div 
                      className="flex items-center gap-4 flex-1 cursor-pointer" 
                      onClick={() => onSelectPage(page.docId)}
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-serif text-xs font-bold shrink-0 border border-border/50">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs uppercase tracking-widest truncate">
                          {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}
                        </h4>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                          {page.content?.title || page.content?.name || 'Untitled Spread'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 border-l pl-3">
                      <div className="flex flex-col">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-accent" 
                          disabled={index === 0 || isSaving}
                          onClick={() => onMovePage(page.docId, 'up')}
                        >
                          <ChevronRight className="h-3 w-3 -rotate-90" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-accent" 
                          disabled={index === pages.length - 1 || isSaving}
                          onClick={() => onMovePage(page.docId, 'down')}
                        >
                          <ChevronRight className="h-3 w-3 rotate-90" />
                        </Button>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors" 
                        onClick={() => onDeletePage(page.docId)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  );
}
