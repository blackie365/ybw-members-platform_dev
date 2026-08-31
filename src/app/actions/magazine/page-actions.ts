import { checkAdmin } from '@/lib/server/auth-utils';
import { MagazinePageSchema, safeParseMagazine } from '@/features/magazine/domain/validation-schemas';
import { normalizeMagazinePageContent } from '@/lib/magazine-utils';
import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import { getMagazineWriteStore } from '@/features/magazine/server/write-store';
import { syncBuilderToReaderEditionAction } from './reader-edition-actions';
import { safeRevalidatePath } from './_helpers';
import { MagazinePage } from '@/components/admin/magazine-builder/types';

function eagerRevalidateAdminBuilderPaths(issueId: string): void {
  safeRevalidatePath('/admin/magazine');
  safeRevalidatePath(`/admin/magazine/builder/${issueId}`);
  safeRevalidatePath(`/admin/magazine/builder`);
}

/**
 * Page identity (Phase 5): a builder page is keyed by its numeric `id` in the
 * magazine_pages table, and that numeric id is surfaced to the builder client
 * as its `docId` (docId === String(id)). All reads go through the magazine read
 * store (Postgres primary on VPS) and all writes through the write store, so
 * the admin builder is fully decoupled from Firestore.
 */

export async function getMagazinePagesAction(issueId: string) {
  try {
    await checkAdmin();
    const pages = await getMagazineReadStore().getMagazinePages(issueId);
    return { success: true, data: pages };
  } catch (error: any) {
    console.error("Error in getMagazinePagesAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateMagazinePageAction(issueId: string, pageId: string, data: any, opts: { skipSync?: boolean; skipExistingFetch?: boolean; existingDoc?: unknown } = {}) {
  try {
    await checkAdmin();
    const store = getMagazineWriteStore();

    // Partial saves (e.g. handleSavePageContent only ever passes `{ content }`)
    // must NOT clobber fields they don't mention. Fetch the current page so
    // unspecified fields fall back to their CURRENT stored values, not defaults.
    let existingData: any = opts.existingDoc && typeof opts.existingDoc === 'object'
      ? { ...(opts.existingDoc as any) }
      : undefined;
    if (!opts.skipExistingFetch || typeof existingData !== 'object') {
      const current = await getMagazineReadStore().getMagazinePages(issueId);
      const found = current.find((p: MagazinePage & { docId?: string }) => String(p.docId) === String(pageId) || String((p as any)?.id) === String(pageId));
      existingData = found ? { ...(found as any) } : {};
    }

    const raw: any = {
      id: 0,
      type: 'feature-full',
      ...existingData,
      docId: pageId,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    if (raw.content && typeof raw.content === 'object') {
      raw.content = normalizeMagazinePageContent(raw.content);
    }
    const validated = safeParseMagazine(MagazinePageSchema, raw, `MagazinePage pageId=${pageId} (updateMagazinePageAction)`);
    if (!validated.ok) {
      console.error('[updateMagazinePageAction] validation failed:\n', validated.error);
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }
    const payload: any = { ...validated.value };
    const t0 = Date.now();
    await store.upsertPage(issueId, { ...payload, id: payload.id ?? pageId });
    console.log(`[SAVEDIAG] ${new Date().toISOString()} updateMagazinePageAction write OK pageId=${pageId} in ${Date.now() - t0}ms`);
    eagerRevalidateAdminBuilderPaths(issueId);
    if (!opts.skipSync) {
      try {
        const t1 = Date.now();
        await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
        console.log(`[SAVEDIAG] ${new Date().toISOString()} updateMagazinePageAction syncBuilderToReaderEditionAction done in ${Date.now() - t1}ms`);
      } catch (syncErr: any) {
        console.warn('[updateMagazinePageAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
      }
    }
    console.log(`[SAVEDIAG] ${new Date().toISOString()} updateMagazinePageAction TOTAL ${Date.now() - t0}ms`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function addMagazinePageAction(issueId: string, data: any, opts: { skipSync?: boolean } = {}) {
  try {
    await checkAdmin();
    const store = getMagazineWriteStore();

    const now = new Date().toISOString();
    const raw: any = {
      docId: `new-${Math.random().toString(36).slice(2, 10)}`,
      id: data?.id ?? 0,
      type: data?.type ?? 'feature-full',
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    if (raw.content && typeof raw.content === 'object') {
      raw.content = normalizeMagazinePageContent(raw.content);
    }
    const validated = safeParseMagazine(MagazinePageSchema, raw, 'MagazinePage (addMagazinePageAction)');
    if (!validated.ok) {
      console.error('[addMagazinePageAction] validation failed:\n', validated.error);
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }
    const payload: any = { ...validated.value };
    const id = await store.addPage(issueId, { ...payload, id: payload.id ?? payload.docId ?? undefined });
    eagerRevalidateAdminBuilderPaths(issueId);
    if (!opts.skipSync) {
      try {
        await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
      } catch (syncErr: any) {
        console.warn('[addMagazinePageAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
      }
    }
    return { success: true, id };
  } catch (error: any) {
    console.error("Error in addMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMagazinePageAction(issueId: string, pageId: string, opts: { skipSync?: boolean } = {}) {
  try {
    await checkAdmin();
    const store = getMagazineWriteStore();

    await store.deletePage(issueId, pageId);
    eagerRevalidateAdminBuilderPaths(issueId);
    if (!opts.skipSync) {
      try {
        await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
      } catch (syncErr: any) {
        console.warn('[deleteMagazinePageAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
      }
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

interface BulkUpdatePageEntry {
  pageId: string;
  data: Record<string, unknown>;
  skipExistingFetch?: boolean;
  existingDoc?: unknown;
}

export async function bulkUpdateMagazinePagesAction(
  issueId: string,
  entries: BulkUpdatePageEntry[],
  opts: { skipSync?: boolean } = {},
) {
  try {
    await checkAdmin();
    const store = getMagazineWriteStore();
    if (!Array.isArray(entries) || entries.length === 0) {
      return { success: true, updated: 0 };
    }

    const t0 = Date.now();
    const current = await getMagazineReadStore().getMagazinePages(issueId);
    const currentByDocId = new Map<string, any>();
    for (const p of current as Array<MagazinePage & { docId?: string }>) {
      const key = String((p as any).docId ?? (p as any).id);
      currentByDocId.set(key, { ...(p as any) });
      currentByDocId.set(String((p as any).id), { ...(p as any) });
    }

    const existingById = new Map<string, any>();
    const needFetch: string[] = [];

    for (const entry of entries) {
      if (!entry?.pageId) continue;
      if (entry.skipExistingFetch && entry.existingDoc && typeof entry.existingDoc === 'object') {
        existingById.set(entry.pageId, { ...(entry.existingDoc as any) });
      } else {
        needFetch.push(entry.pageId);
      }
    }

    if (needFetch.length > 0) {
      for (const pid of needFetch) {
        const found = currentByDocId.get(pid);
        existingById.set(pid, found ? { ...found } : {});
      }
    }

    const resolvedPages: Array<MagazinePage & { id: number | string }> = [];
    let staged = 0;

    for (const entry of entries) {
      if (!entry?.pageId) continue;
      const existingData: any = existingById.has(entry.pageId)
        ? { ...existingById.get(entry.pageId) }
        : {};

      const raw: any = {
        id: 0,
        type: 'feature-full',
        ...existingData,
        docId: entry.pageId,
        ...(entry.data || {}),
        updatedAt: new Date().toISOString(),
      };
      if (raw.content && typeof raw.content === 'object') {
        raw.content = normalizeMagazinePageContent(raw.content);
      }
      const validated = safeParseMagazine(
        MagazinePageSchema,
        raw,
        `MagazinePage pageId=${entry.pageId} (bulkUpdateMagazinePagesAction)`,
      );
      if (!validated.ok) {
        console.error('[bulkUpdateMagazinePagesAction] row validation failed:\n', validated.error);
        return { success: false, error: validated.error, validationIssues: validated.issues, updated: staged };
      }
      const payload: any = { ...validated.value };
      resolvedPages.push({ ...payload, id: payload.id ?? entry.pageId });
      staged++;
    }

    await store.bulkUpsertPages(issueId, resolvedPages);
    const elapsed = Date.now() - t0;
    console.log(
      `[SAVEDIAG] ${new Date().toISOString()} bulkUpdateMagazinePagesAction commit OK: ${staged} pages, ${Date.now() - t0}ms`,
    );
    eagerRevalidateAdminBuilderPaths(issueId);

    if (!opts.skipSync) {
      try {
        const t1 = Date.now();
        await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
        console.log(
          `[SAVEDIAG] ${new Date().toISOString()} bulkUpdate post-sync syncBuilderToReaderEditionAction ${Date.now() - t1}ms (total incl commit ${Date.now() - t0}ms)`,
        );
      } catch (syncErr: any) {
        console.warn('[bulkUpdateMagazinePagesAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
      }
    }

    return { success: true, updated: staged, elapsedMs: elapsed };
  } catch (error: any) {
    console.error('Error in bulkUpdateMagazinePagesAction:', error);
    return { success: false, error: error.message, updated: 0 };
  }
}

export async function bulkDeleteMagazinePagesAction(
  issueId: string,
  pageIds: string[],
  opts: { skipSync?: boolean } = {},
) {
  try {
    await checkAdmin();
    const store = getMagazineWriteStore();
    const ids = Array.isArray(pageIds) ? pageIds.filter((p) => typeof p === 'string' && p) : [];
    if (ids.length === 0) {
      return { success: true, deleted: 0 };
    }

    const t0 = Date.now();
    await store.bulkDeletePages(issueId, ids);

    const elapsed = Date.now() - t0;
    console.log(
      `[SAVEDIAG] ${new Date().toISOString()} bulkDeleteMagazinePagesAction commit OK: ${ids.length} pages in ${elapsed}ms`,
    );
    eagerRevalidateAdminBuilderPaths(issueId);

    if (!opts.skipSync) {
      try {
        const t1 = Date.now();
        await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
        console.log(
          `[SAVEDIAG] ${new Date().toISOString()} bulkDelete post-sync syncBuilderToReaderEditionAction ${Date.now() - t1}ms (total incl commit ${Date.now() - t0}ms)`,
        );
      } catch (syncErr: any) {
        console.warn('[bulkDeleteMagazinePagesAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
      }
    }

    return { success: true, deleted: ids.length, elapsedMs: elapsed };
  } catch (error: any) {
    console.error('Error in bulkDeleteMagazinePagesAction:', error);
    return { success: false, error: error.message, deleted: 0 };
  }
}
