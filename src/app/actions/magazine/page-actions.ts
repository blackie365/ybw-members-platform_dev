import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';
import { MagazinePageSchema, safeParseMagazine } from '@/features/magazine/domain/validation-schemas';
import { normalizeMagazinePageContent } from '@/lib/magazine-utils';
import { syncBuilderToReaderEditionAction } from './reader-edition-actions';
import { safeRevalidatePath } from './_helpers';

function eagerRevalidateAdminBuilderPaths(issueId: string): void {
  safeRevalidatePath('/admin/magazine');
  safeRevalidatePath(`/admin/magazine/builder/${issueId}`);
  safeRevalidatePath(`/admin/magazine/builder`);
}

export async function getMagazinePagesAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('magazine_issues').doc(issueId).collection('pages')
      .orderBy('id', 'asc')
      .get();

    const pages = snapshot.docs.map(doc => {
      const data = doc.data();
      const serializedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value && typeof value === 'object' && 'seconds' in value) {
          acc[key] = new Date((value as any).seconds * 1000).toISOString();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      return {
        docId: doc.id,
        ...serializedData
      };
    });

    return { success: true, data: pages };
  } catch (error: any) {
    console.error("Error in getMagazinePagesAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateMagazinePageAction(issueId: string, pageId: string, data: any, opts: { skipSync?: boolean; skipExistingFetch?: boolean; existingDoc?: unknown } = {}) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    // IMPORTANT: partial saves (e.g. handleSavePageContent only ever passes
    // `{ content }`) must NOT clobber fields they don't mention. Previously
    // this defaulted `id`/`type` to 0/'feature-full' whenever the caller
    // omitted them, and because MagazinePageSchema requires `id`, that 0
    // ended up in every merge payload — silently corrupting the page's
    // sort-order id (orderBy('id','asc') everywhere) on every plain content
    // save. Fetch the existing doc first so unspecified fields fall back to
    // their CURRENT stored values, not hardcoded defaults.
    let existingData: any = opts.existingDoc && typeof opts.existingDoc === 'object'
      ? { ...(opts.existingDoc as any) }
      : undefined;
    if (!opts.skipExistingFetch || typeof existingData !== 'object') {
      const existingSnap = await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).get();
      existingData = existingSnap.exists ? existingSnap.data() : {};
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
    delete payload.docId;
    const t0 = Date.now();
    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).set(payload, { merge: true });
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
    if (!adminDb) throw new Error("Database not initialized");

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
    delete payload.docId;
    const docRef = await adminDb.collection('magazine_issues').doc(issueId).collection('pages').add(payload);
    eagerRevalidateAdminBuilderPaths(issueId);
    if (!opts.skipSync) {
      try {
        await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
      } catch (syncErr: any) {
        console.warn('[addMagazinePageAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
      }
    }
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error in addMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMagazinePageAction(issueId: string, pageId: string, opts: { skipSync?: boolean } = {}) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).delete();
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
    if (!adminDb) throw new Error('Database not initialized');
    if (!Array.isArray(entries) || entries.length === 0) {
      return { success: true, updated: 0 };
    }

    const collectionRef = adminDb.collection('magazine_issues').doc(issueId).collection('pages');
    const batch = adminDb.batch();
    let staged = 0;
    let fetchedDocs = 0;
    const t0 = Date.now();

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
      const existingSnaps = await Promise.all(
        needFetch.map((pid) => collectionRef.doc(pid).get()),
      );
      existingSnaps.forEach((snap, i) => {
        existingById.set(needFetch[i], snap.exists ? snap.data() || {} : {});
      });
      fetchedDocs += existingSnaps.length;
    }

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
      delete payload.docId;
      batch.set(collectionRef.doc(entry.pageId), payload, { merge: true });
      staged++;
    }

    await batch.commit();
    const elapsed = Date.now() - t0;
    console.log(
      `[SAVEDIAG] ${new Date().toISOString()} bulkUpdateMagazinePagesAction commit OK: ${staged} pages, ${fetchedDocs} fetched, ${Date.now() - t0}ms`,
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
    if (!adminDb) throw new Error('Database not initialized');
    const ids = Array.isArray(pageIds) ? pageIds.filter((p) => typeof p === 'string' && p) : [];
    if (ids.length === 0) {
      return { success: true, deleted: 0 };
    }

    const collectionRef = adminDb.collection('magazine_issues').doc(issueId).collection('pages');
    const batch = adminDb.batch();
    const t0 = Date.now();

    for (const pid of ids) {
      batch.delete(collectionRef.doc(pid));
    }
    await batch.commit();

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
