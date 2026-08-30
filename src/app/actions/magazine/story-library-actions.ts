import type { StoryLibraryItem } from '@/components/admin/magazine-builder/types';
import { checkAdmin } from '@/lib/server/auth-utils';
import { StoryLibraryItemSchema, safeParseMagazine } from '@/features/magazine/domain/validation-schemas';
import {
  safeRevalidatePath,
  mergeStoryLibraryItems,
  getIssueStoryLibraryCollectionItems,
  persistStoryLibraryForIssue,
} from './_helpers';
import { syncBuilderToReaderEditionAction } from './reader-edition-actions';

export async function getMagazineStoryLibraryAction(issueId: string) {
  try {
    await checkAdmin();
    const { getMagazineReadStore } = await import('@/features/magazine/server/read-store');

    const [issueDoc, collectionItems] = await Promise.all([
      getMagazineReadStore().getMagazineIssue(issueId),
      getIssueStoryLibraryCollectionItems(issueId),
    ]);

    const issueData = (issueDoc || {}) as { storyLibrary?: StoryLibraryItem[] };
    const issueItems = Array.isArray(issueData.storyLibrary) ? issueData.storyLibrary : [];
    const merged = mergeStoryLibraryItems(collectionItems, issueItems);

    return { success: true, data: merged };
  } catch (error: any) {
    console.error('Error in getMagazineStoryLibraryAction:', error);
    return { success: false, error: error.message };
  }
}

export async function saveMagazineStoryLibraryAction(issueId: string, storyLibrary: StoryLibraryItem[]) {
  try {
    await checkAdmin();

    const validatedItems: StoryLibraryItem[] = [];
    for (let i = 0; i < (Array.isArray(storyLibrary) ? storyLibrary.length : 0); i += 1) {
      const raw = storyLibrary[i];
      const parsed = safeParseMagazine(
        StoryLibraryItemSchema,
        raw,
        `StoryLibraryItem[${i}] title="${String((raw as any)?.title || '').slice(0, 60)}"`,
      );
      if (!parsed.ok) {
        console.error('[saveMagazineStoryLibraryAction] validation failed:\n', parsed.error);
        return { success: false, error: parsed.error, validationIssues: parsed.issues };
      }
      validatedItems.push(parsed.value as unknown as StoryLibraryItem);
    }

    const resolvedItems = await persistStoryLibraryForIssue(issueId, validatedItems);

    try { safeRevalidatePath('/admin/magazine'); } catch { /* noop */ }
    try {
      await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
    } catch (syncErr: any) {
      console.warn('[saveMagazineStoryLibraryAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
    }
    return { success: true, data: resolvedItems };
  } catch (error: any) {
    console.error('Error in saveMagazineStoryLibraryAction:', error);
    return { success: false, error: error.message };
  }
}
