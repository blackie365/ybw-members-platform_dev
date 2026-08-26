'use client';

import { useMemo, useState } from 'react';
import { 
  Trash2, 
  Layout, 
  ChevronRight,
  Ellipsis,
  GripVertical,
  ArrowDownToLine,
  ExternalLink
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
  readerSlug?: string;
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
  readerSlug,
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
  const deleteAllCandidatePages = useMemo(
    () => sortedPages,
    [sortedPages],
  );
  const builderLegacyPages = useMemo(
    () => sortedPages.filter((p) => !p.readOnly && Boolean(p._legacyDocId)),
    [sortedPages],
  );
  const idmlPublishedPages = useMemo(
    () => sortedPages.filter((p) => p.readOnly || String(p.docId || '').startsWith('reader:')),
    [sortedPages],
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

  const slugForUrl = String(readerSlug || '').trim().toLowerCase();

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
          <div className="flex items-center gap-1.5 shrink-0">
            {slugForUrl && sortedPages.length > 0 && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2.5 gap-1.5 border-accent/30 text-accent hover:bg-accent/10"
              >
                <a
                  href={`/magazine/read/${encodeURIComponent(slugForUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                  Preview Reader
                </a>
              </Button>
            )}
            {sortedPages.length > 0 && !!onDeleteAllPages && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-[10px] px-2.5 gap-1.5 shrink-0"
                disabled={isSaving || deleteAllCandidatePages.length === 0}
                onClick={() => {
                  setDeleteAllOpen(true);
                  setDeleteAllConfirm('');
                }}
              >
                <Trash2 className="h-3 w-3" />
                Delete All Spreads
              </Button>
            )}
          </div>
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
                  if (page.readOnly) return;
                  const draggedPage = sortedPages.find(p => p.docId === draggedPageId);
                  if (draggedPage?.readOnly) return;
                  e.preventDefault();
                  setDropTargetPageId(page.docId);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggedPageId || draggedPageId === page.docId || isSaving) return;
                  if (page.readOnly) return;
                  const draggedPage = sortedPages.find(p => p.docId === draggedPageId);
                  if (draggedPage?.readOnly) return;
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
                } ${dropTargetPageId === page.docId ? 'border-accent ring-1 ring-accent/30 bg-accent/5' : ''} ${
                  page.readOnly ? 'bg-muted/20 border-dashed border-muted-foreground/20' : ''
                }`}
              >
                <button
                  type="button"
                  draggable={!isSaving && !page.readOnly}
                  onDragStart={(e) => {
                    if (page.readOnly) return;
                    e.stopPropagation();
                    setDraggedPageId(page.docId);
                    setDropTargetPageId(page.docId);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', page.docId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`flex h-8 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-accent active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 ${
                    page.readOnly ? 'invisible' : 'cursor-grab'
                  }`}
                  disabled={isSaving || page.readOnly}
                  aria-label={`Drag to reorder ${page.content?.title || page.content?.name || 'page'}`}
                  title={page.readOnly ? 'Published via IDML — reorder in the IDML file' : 'Drag to reorder'}
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
                    <div className="flex items-center gap-1">
                      <h4 className="font-bold text-[9px] uppercase tracking-widest truncate">
                        {PAGE_TYPES.find(t => t.id === page.type)?.label || page.type}
                      </h4>
                      {page.readOnly && (
                        <span className="text-[8px] font-medium text-muted-foreground/80 uppercase tracking-wide shrink-0 bg-muted/50 px-1.5 py-[1px] rounded border border-muted">
                          IDML
                        </span>
                      )}
                    </div>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-tight truncate">
                      {page.content?.title || page.content?.name || 'Untitled'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 border-l pl-1.5">
                  {slugForUrl && (
                    <a
                      href={`/magazine/read/${encodeURIComponent(slugForUrl)}?page=${index + 1}`}
                      target="_blank"
                      rel="noreferrer"
                      title={`View page ${index + 1} in reader`}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-accent transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="flex flex-col">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 text-muted-foreground hover:text-accent" 
                      disabled={index === 0 || isSaving || page.readOnly}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (page.readOnly) return;
                        onMovePage(page.docId, 'up');
                      }}
                    >
                      <ChevronRight className="h-2 w-2 -rotate-90" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 text-muted-foreground hover:text-accent" 
                      disabled={index === sortedPages.length - 1 || isSaving || page.readOnly}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (page.readOnly) return;
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
                          disabled={isSaving || page.readOnly}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Ellipsis className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={isSaving || page.readOnly}
                          onSelect={(e) => {
                            e.preventDefault();
                            if (page.readOnly) return;
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
                            disabled={isSaving || t.id === page.type || page.readOnly}
                            onSelect={(e) => {
                              e.preventDefault();
                              if (page.readOnly || t.id === page.type) return;
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
                    title={page.readOnly ? 'Delete this IDML-published spread from live reader (re-import IDML later to restore)' : 'Delete spread'}
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
            <DialogTitle className="text-destructive">
              Delete all {deleteAllCandidatePages.length} spread{deleteAllCandidatePages.length === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              This removes <strong>ALL {deleteAllCandidatePages.length} spread{deleteAllCandidatePages.length === 1 ? '' : 's'}</strong> from the builder and the live digital reader edition.
              <br />
              <br />
              Breakdown:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                {builderLegacyPages.length > 0 && (
                  <li>
                    <strong>{builderLegacyPages.length} builder-created spread{builderLegacyPages.length === 1 ? '' : 's'}</strong> — deleted from <code>magazine_issues/pages</code> firestore subcollection (Layer B).
                  </li>
                )}
                {idmlPublishedPages.length > 0 && (
                  <li>
                    <strong>{idmlPublishedPages.length} IDML-published spread{idmlPublishedPages.length === 1 ? '' : 's'}</strong> — removed from ReaderEdition document pages array in firestore (Layer A).
                  </li>
                )}
              </ul>
              <br />
              To restore IDML spreads later: re-export InDesign as IDML → Auto-Import → publish.
              <br />
              <br />
              This action cannot be undone. The Story Library and issue metadata remain untouched.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Type <strong className="text-destructive">DELETE ALL SPREADS</strong> to confirm:
            </p>
            <Input
              value={deleteAllConfirm}
              onChange={(e) => setDeleteAllConfirm(e.target.value)}
              placeholder='Type "DELETE ALL SPREADS"'
              autoFocus
            />
            {deleteAllConfirm.trim().length > 0 &&
              deleteAllConfirm.trim() !== 'DELETE ALL SPREADS' && (
                <p className="text-[11px] text-destructive">
                  Type exactly <strong>DELETE ALL SPREADS</strong> (case-sensitive) to enable deletion.
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
                deleteAllCandidatePages.length === 0 ||
                deleteAllConfirm.trim() !== 'DELETE ALL SPREADS'
              }
              onClick={async () => {
                if (deleteAllConfirm.trim() !== 'DELETE ALL SPREADS') return;
                setDeleteAllOpen(false);
                setDeleteAllConfirm('');
                await onDeleteAllPages?.();
              }}
            >
              Delete all {deleteAllCandidatePages.length} spread{deleteAllCandidatePages.length === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
