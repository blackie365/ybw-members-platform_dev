'use client';

import { useMemo, useState } from 'react';
import { 
  Trash2, 
  Layout, 
  ChevronRight,
  Ellipsis,
  GripVertical,
  ArrowDownToLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PAGE_TYPES, MagazinePage } from './types';

interface PageListProps {
  pages: MagazinePage[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onDeleteAllPages?: () => Promise<void>;
  onChangeType?: (pageDocId: string, type: string) => void;
  onMovePage: (id: string, direction: 'up' | 'down') => void;
  onMovePageTo: (id: string, position: number) => void;
  isSaving: boolean;
}

export function PageList({ 
  pages, 
  selectedPageId, 
  onSelectPage, 
  onDeletePage, 
  onDeleteAllPages,
  onChangeType,
  onMovePage,
  onMovePageTo,
  isSaving 
}: PageListProps) {
  const sortedPages = useMemo(
    () => [...pages].sort((left, right) => (left.id || 0) - (right.id || 0)),
    [pages],
  );
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [dropTargetPageId, setDropTargetPageId] = useState<string | null>(null);
  const [moveDialogPageId, setMoveDialogPageId] = useState<string | null>(null);
  const [moveTargetValue, setMoveTargetValue] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState('');

  const moveDialogPageIndex = sortedPages.findIndex((page) => page.docId === moveDialogPageId);
  const moveDialogPageTitle =
    moveDialogPageIndex >= 0
      ? sortedPages[moveDialogPageIndex].content?.title ||
        sortedPages[moveDialogPageIndex].content?.name ||
        'Untitled'
      : 'Untitled';

  return (
    <>
    <Card className="min-h-[600px] border-accent/20 w-full overflow-hidden">
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Issue Spreads</CardTitle>
            <CardDescription className="text-[10px]">
              {sortedPages.length} {sortedPages.length === 1 ? 'page' : 'pages'} total. Drag to reorder or jump directly to a page number.
            </CardDescription>
          </div>
          {sortedPages.length > 0 && !!onDeleteAllPages && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-[10px] px-2.5 gap-1.5 shrink-0"
              disabled={isSaving}
              onClick={() => {
                setDeleteAllOpen(true);
                setDeleteAllConfirm('');
              }}
            >
              <Trash2 className="h-3 w-3" />
              Delete All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2">
        {sortedPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
            <Layout className="h-12 w-12 text-muted-foreground opacity-10" />
            <p className="text-sm text-muted-foreground italic">No pages built yet.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedPages.map((page, index) => (
              <div 
                key={page.docId}
                onDragOver={(e) => {
                  if (!draggedPageId || draggedPageId === page.docId || isSaving) return;
                  e.preventDefault();
                  setDropTargetPageId(page.docId);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggedPageId || draggedPageId === page.docId || isSaving) return;
                  onMovePageTo(draggedPageId, index + 1);
                  setDraggedPageId(null);
                  setDropTargetPageId(null);
                }}
                onDragEnd={() => {
                  setDraggedPageId(null);
                  setDropTargetPageId(null);
                }}
                className={`flex items-center gap-2 p-1.5 rounded-md border transition-all ${
                  selectedPageId === page.docId 
                    ? 'border-accent bg-accent/5 shadow-sm' 
                    : 'border-border/50 bg-card hover:border-accent/30'
                } ${dropTargetPageId === page.docId ? 'border-accent ring-1 ring-accent/30 bg-accent/5' : ''}`}
              >
                <button
                  type="button"
                  draggable={!isSaving}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggedPageId(page.docId);
                    setDropTargetPageId(page.docId);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', page.docId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-accent active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isSaving}
                  aria-label={`Drag to reorder ${page.content?.title || page.content?.name || 'page'}`}
                  title="Drag to reorder"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
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
                      disabled={index === sortedPages.length - 1 || isSaving}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMovePage(page.docId, 'down');
                      }}
                    >
                      <ChevronRight className="h-2 w-2 rotate-90" />
                    </Button>
                  </div>
                  {!!onChangeType && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-accent"
                          disabled={isSaving}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Ellipsis className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={isSaving}
                          onSelect={(e) => {
                            e.preventDefault();
                            setMoveDialogPageId(page.docId);
                            setMoveTargetValue(String(index + 1));
                          }}
                        >
                          <ArrowDownToLine className="h-3 w-3" />
                          Move to page...
                        </DropdownMenuItem>
                        {PAGE_TYPES.map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            disabled={isSaving || t.id === page.type}
                            onSelect={(e) => {
                              e.preventDefault();
                              if (t.id === page.type) return;
                              if (!confirm('Change layout for this spread?')) return;
                              onChangeType(page.docId, t.id);
                            }}
                          >
                            {t.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
      <Dialog
        open={Boolean(moveDialogPageId)}
        onOpenChange={(open) => {
          if (!open) {
            setMoveDialogPageId(null);
            setMoveTargetValue('');
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move spread</DialogTitle>
            <DialogDescription>
              Choose the new page number for &ldquo;{moveDialogPageTitle}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="number"
              min={1}
              max={sortedPages.length}
              value={moveTargetValue}
              onChange={(e) => setMoveTargetValue(e.target.value)}
              placeholder={`1-${sortedPages.length}`}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Enter a page between 1 and {sortedPages.length}.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMoveDialogPageId(null);
                setMoveTargetValue('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={isSaving || !moveDialogPageId}
              onClick={() => {
                const nextPosition = Number(moveTargetValue);
                if (!moveDialogPageId || !Number.isFinite(nextPosition)) return;
                onMovePageTo(moveDialogPageId, nextPosition);
                setMoveDialogPageId(null);
                setMoveTargetValue('');
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteAllOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteAllOpen(false);
            setDeleteAllConfirm('');
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete ALL spreads</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{sortedPages.length} spread{sortedPages.length === 1 ? '' : 's'}</strong> from this issue. This action cannot be undone. The Story Library and issue metadata will remain untouched.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Type <strong className="text-destructive">DELETE ALL</strong> to confirm:
            </p>
            <Input
              value={deleteAllConfirm}
              onChange={(e) => setDeleteAllConfirm(e.target.value)}
              placeholder='Type "DELETE ALL"'
              autoFocus
            />
            {deleteAllConfirm.trim().length > 0 && deleteAllConfirm.trim() !== 'DELETE ALL' && (
              <p className="text-[11px] text-destructive">
                Type exactly <strong>DELETE ALL</strong> (case-sensitive) to enable deletion.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAllOpen(false);
                setDeleteAllConfirm('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                isSaving ||
                sortedPages.length === 0 ||
                deleteAllConfirm.trim() !== 'DELETE ALL'
              }
              onClick={async () => {
                if (deleteAllConfirm.trim() !== 'DELETE ALL') return;
                setDeleteAllOpen(false);
                setDeleteAllConfirm('');
                await onDeleteAllPages?.();
              }}
            >
              Delete {sortedPages.length} page{sortedPages.length === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
