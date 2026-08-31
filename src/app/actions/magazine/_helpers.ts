import type { StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { revalidatePath } from 'next/cache';
import { normalizeStoryLibraryItem, normalizeStoryLibraryImageFields } from '@/lib/magazine-utils';

export function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    console.warn(`safeRevalidatePath failed for ${path}:`, error);
  }
}

export function normalizeStoryText(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function deriveStandfirst(value: string): string {
  const normalized = normalizeStoryText(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const sentence = normalized.split(/(?<=[.!?])\s+/)[0]?.trim() || normalized;
  return sentence.length <= 220 ? sentence : `${sentence.slice(0, 220).trimEnd()}...`;
}

export function buildStoryLibraryIdentity(item: Partial<StoryLibraryItem>): string {
  const sourceRef = String(item.sourceRef || '').trim().toLowerCase();
  if (sourceRef) return `source:${sourceRef}`;

  const sourceType = String(item.source?.type || '').trim().toLowerCase();
  const fileName = String(item.source?.fileName || '').trim().toLowerCase();
  const path = String(item.source?.path || '').trim().toLowerCase();
  if (sourceType || fileName || path) return `path:${sourceType}:${fileName}:${path}`;

  const title = String(item.title || '').trim().toLowerCase();
  const body = normalizeStoryText(String(item.text || '')).slice(0, 180).toLowerCase();
  return `text:${title}:${body}`;
}

export function mergeStoryLibraryItems(
  collectionItems: StoryLibraryItem[],
  issueItems: StoryLibraryItem[],
): StoryLibraryItem[] {
  const merged: StoryLibraryItem[] = [];
  const seen = new Set<string>();

  for (const item of [...collectionItems, ...issueItems]) {
    const key = buildStoryLibraryIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function resolveStoryLibraryDocId(issueId: string, item: StoryLibraryItem): string {
  const cleanId = String(item.id || '').trim();
  if (cleanId.startsWith(`${issueId}-`)) return cleanId;
  return `${issueId}-library-${cleanId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
}

export function normalizeStoryLibraryItems(storyLibrary: StoryLibraryItem[]): StoryLibraryItem[] {
  return Array.isArray(storyLibrary)
    ? storyLibrary
        .filter(Boolean)
        .map((item) =>
          normalizeStoryLibraryItem({
            ...item,
            title: String(item.title || '').trim(),
            text: normalizeStoryText(item.text || ''),
            standfirst: String(item.standfirst || '').trim() || undefined,
            imageUrl: String(item.imageUrl || '').trim() || undefined,
            imageFileNames: Array.isArray(item.imageFileNames)
              ? item.imageFileNames.map((value) => String(value || '').trim()).filter(Boolean)
              : undefined,
            sourceRef: String(item.sourceRef || '').trim() || undefined,
          } as StoryLibraryItem),
        )
        .filter((item) => item.title || item.text)
    : [];
}

export async function persistStoryLibraryForIssue(
  issueId: string,
  storyLibrary: StoryLibraryItem[],
): Promise<StoryLibraryItem[]> {
  const normalized = normalizeStoryLibraryImageFields(storyLibrary || []);
  const nextItems = normalizeStoryLibraryItems(normalized);

  const resolvedNext = nextItems.map((item) => ({
    ...item,
    id: resolveStoryLibraryDocId(issueId, item),
  }));

  // Phase 5 (Postgres-only): persist through the write store. The PG writer
  // projects the story library onto the issue row for the public reader.
  const { getMagazineWriteStore } = await import('@/features/magazine/server/write-store');
  await getMagazineWriteStore().persistStoryLibrary(issueId, resolvedNext);

  const persistedItems = await getIssueStoryLibraryCollectionItems(issueId);
  return persistedItems.length > 0
    ? mergeStoryLibraryItems(persistedItems, nextItems)
    : nextItems;
}

export async function getIssueStoryLibraryCollectionItems(issueId: string): Promise<StoryLibraryItem[]> {
  if (!issueId) return [];
  try {
    const { getMagazineReadStore } = await import('@/features/magazine/server/read-store');
    const items = await getMagazineReadStore().getStoryLibrary(issueId);
    if (items && Array.isArray(items)) return items;
    return [];
  } catch (err) {
    console.warn('[getIssueStoryLibraryCollectionItems] PG read failed:', err);
    return [];
  }
}
