import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';
import { MagazinePageSchema, safeParseMagazine } from '@/features/magazine/domain/validation-schemas';
import { normalizeMagazinePageContent } from '@/lib/magazine-utils';
import { syncBuilderToReaderEditionAction } from './reader-edition-actions';

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
