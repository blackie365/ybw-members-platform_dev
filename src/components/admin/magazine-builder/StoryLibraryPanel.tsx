'use client';

import { useMemo, useState } from 'react';
import { BookOpen, FileText } from 'lucide-react';
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
}

const isIncludedInPremiumReader = (item: StoryLibraryItem) => item.includedInPremiumReader !== false;

export function StoryLibraryPanel({
  stories,
  selectedPage,
  isSaving,
  onApplyStory,
  onToggleInclusion,
  onRemoveStory,
}: StoryLibraryPanelProps) {
  const [query, setQuery] = useState('');
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
          <BookOpen className="h-5 w-5 mt-0.5" />
          <div>
            <CardTitle className="text-base">Story Library</CardTitle>
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
      </CardContent>
    </Card>
  );
}
