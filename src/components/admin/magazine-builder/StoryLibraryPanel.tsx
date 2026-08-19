'use client';

import { useMemo, useState } from 'react';
import { BookOpen, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MagazinePage, StoryLibraryItem } from './types';
import { PAGE_TYPES } from './types';

export interface StoryLibraryPanelProps {
  stories: StoryLibraryItem[];
  selectedPage?: MagazinePage;
  isSaving: boolean;
  onApplyStory: (story: StoryLibraryItem) => void;
  onToggleInclusion: (storyId: string) => void;
  onRemoveStory: (storyId: string) => void;
  onDeleteAll?: () => Promise<void> | void;
}

const isIncludedInPremiumReader = (item: StoryLibraryItem) => item.includedInPremiumReader !== false;

export function StoryLibraryPanel({
  stories,
  selectedPage,
  isSaving,
  onApplyStory,
  onToggleInclusion,
  onRemoveStory,
  onDeleteAll,
}: StoryLibraryPanelProps) {
  const [query, setQuery] = useState('');
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [deleteAllInput, setDeleteAllInput] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredStories = useMemo(() => {
    if (!normalizedQuery) return stories;
    return stories.filter((story) => {
      const haystack = `${story.title || ''} ${story.author || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, stories]);

  const includedStoryCount = stories.filter(isIncludedInPremiumReader).length;
  const selectedLayoutLabel = selectedPage
    ? PAGE_TYPES.find((type) => type.id === selectedPage.type)?.label || selectedPage.type
    : '';

  return (
    <Card className="border-accent/20 w-full overflow-hidden">
      <CardHeader className="bg-accent/5 px-4 py-3">
        <div className="flex items-start gap-2 text-accent">
          <BookOpen className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
              <span>Story Library</span>
              {onDeleteAll && stories.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 self-start"
                  onClick={() => {
                    setConfirmingDeleteAll(true);
                    setDeleteAllInput('');
                  }}
                  disabled={isSaving || isDeletingAll}
                >
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  Delete All
                </Button>
              ) : null}
            </CardTitle>
            <CardDescription className="text-[10px] text-muted-foreground">
              Choose a spread first, then apply a saved story into that layout.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-4">
        <div className="rounded-md border border-border bg-muted/10 px-3 py-2">
          <p className="text-[10px] font-mono text-muted-foreground">
            Included in premium reader: {includedStoryCount} / {stories.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {selectedPage
              ? `Selected spread: ${selectedLayoutLabel}`
              : 'Select a spread to enable story placement.'}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Search</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or author..."
          />
        </div>

        {filteredStories.length > 0 ? (
          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {filteredStories.map((story) => {
              const subtitle =
                String(story.author || '').trim() ||
                String(story.source?.fileName || '').trim() ||
                '';
              const isIncluded = isIncludedInPremiumReader(story);

              return (
                <div
                  key={story.id}
                  className="rounded-md border border-border bg-muted/10 p-3 space-y-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {String(story.title || '').trim() || 'Untitled Story'}
                    </p>
                    {subtitle ? (
                      <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
                    ) : null}
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                      {String(story.standfirst || story.text || '').trim() || 'No preview available.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-8 px-3 text-[10px]"
                      disabled={!selectedPage || isSaving}
                      onClick={() => onApplyStory(story)}
                    >
                      <FileText className="h-3 w-3 mr-1.5" />
                      Use On Selected Spread
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-[10px]"
                      disabled={isSaving}
                      onClick={() => onToggleInclusion(story.id)}
                    >
                      {isIncluded ? 'Exclude' : 'Include'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-[10px]"
                      disabled={isSaving}
                      onClick={() => onRemoveStory(story.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-md border border-dashed bg-muted/10">
            <p className="text-xs text-muted-foreground">
              No saved stories found. Import from IDML, Ghost, or quick paste to build the library first.
            </p>
          </div>
        )}

        {confirmingDeleteAll ? (
          <div className="border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-900 rounded-md p-4 space-y-3">
            <div>
              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">
                Delete all {stories.length} stories from the Story Library?
              </p>
              <p className="text-[11px] text-red-700/90 dark:text-red-400/90 mt-1">
                This will also remove them from your premium reader spread sync.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-widest text-red-700 dark:text-red-400">
                Type <span className="font-mono font-bold">DELETE ALL</span> to confirm
              </Label>
              <Input
                value={deleteAllInput}
                onChange={(e) => setDeleteAllInput(e.target.value)}
                placeholder="DELETE ALL"
                className="font-mono"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  setConfirmingDeleteAll(false);
                  setDeleteAllInput('');
                }}
                disabled={isDeletingAll}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={isSaving || isDeletingAll || deleteAllInput.trim() !== 'DELETE ALL'}
                onClick={async () => {
                  if (deleteAllInput.trim() !== 'DELETE ALL') return;
                  setIsDeletingAll(true);
                  try {
                    await onDeleteAll?.();
                  } finally {
                    setIsDeletingAll(false);
                    setConfirmingDeleteAll(false);
                    setDeleteAllInput('');
                  }
                }}
              >
                {isDeletingAll ? 'Deleting…' : 'Delete all stories'}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
