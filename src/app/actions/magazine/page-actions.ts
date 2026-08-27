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

export async function updateMagazinePageAction(issueId: string, pageId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const raw: any = { docId: pageId, id: data?.id ?? 0, type: data?.type ?? 'feature-full', ...data, updatedAt: new Date().toISOString() };
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
    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).set(payload, { merge: true });
    try {
      await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
    } catch (syncErr: any) {
      console.warn('[updateMagazinePageAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function addMagazinePageAction(issueId: string, data: any) {
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
    try {
      await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
    } catch (syncErr: any) {
      console.warn('[addMagazinePageAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
    }
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error in addMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMagazinePageAction(issueId: string, pageId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).delete();
    try {
      await syncBuilderToReaderEditionAction(issueId, { revalidatePublicRoutesOnly: true });
    } catch (syncErr: any) {
      console.warn('[deleteMagazinePageAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}
