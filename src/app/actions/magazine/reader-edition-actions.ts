import { adminDb } from '@/lib/firebase-admin';
import type { StoryLibraryItem, MagazinePage } from '@/components/admin/magazine-builder/types';
import { checkAdmin } from '@/lib/server/auth-utils';
import type { ReaderPage, ReaderEdition } from '@/features/magazine/domain/types';
import {
  ReaderEditionSchema,
  safeParseMagazine,
} from '@/features/magazine/domain/validation-schemas';
import {
  upsertReaderEdition,
  syncReaderEditionCoverFromIssue,
  syncReaderEditionsForIssue,
  getReaderEditionIdBySlug,
  getReaderEditionById,
  getReaderEditionByIssueId,
  hydrateEditionWithLegacyPages,
  CURRENT_READER_SCHEMA_VERSION,
} from '@/features/magazine/server/simple-reader';
import { mapBuilderIssueToReaderEdition } from '@/features/magazine/domain/builder-to-reader';
import { normalizeMagazinePageContent } from '@/lib/magazine-utils';
import { safeRevalidatePath, persistStoryLibraryForIssue } from './_helpers';

function safeRevalidatePublicMagazineRoutesForIssue(params: { issueId: string; slug?: string | null }): void {
  const { issueId, slug } = params;
  if (!issueId) return;
  safeRevalidatePath('/magazine');
  safeRevalidatePath('/new-edition');
  safeRevalidatePath(`/magazine/issue/${issueId}`);
  const issueSlug = String(slug || '').trim();
  if (issueSlug) {
    safeRevalidatePath(`/magazine/read/issue-${issueId}-${issueSlug}`);
    safeRevalidatePath(`/magazine/read/${issueSlug}`);
  } else {
    safeRevalidatePath(`/magazine/read/issue-${issueId}`);
  }
}

export async function syncBuilderToReaderEditionAction(
  issueId: string,
  opts: {
    revalidatePublicRoutesOnly?: boolean;
    readerPagesOverride?: unknown[];
  } = {},
): Promise<{ success: boolean; error?: string; readerEditionId?: string; pageCount?: number; schemaIssues?: unknown[] }> {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Database not initialized');
    if (!issueId) return { success: false, error: 'issueId required' };

    const issueRef = adminDb.collection('magazine_issues').doc(issueId);
    const issueSnap = await issueRef.get();
    if (!issueSnap.exists) {
      return { success: false, error: `magazine_issues/${issueId} not found` };
    }
    const issueDoc = { id: issueSnap.id, ...(issueSnap.data() as any) };

    let sourcePages: MagazinePage[] = [];

    if (Array.isArray(opts.readerPagesOverride) && opts.readerPagesOverride.length > 0) {
      sourcePages = (opts.readerPagesOverride as any[]).map((raw, idx) => {
        const obj: any = typeof raw === 'object' && raw !== null ? { ...raw } : { docId: String(idx) };
        if (!obj.docId) obj.docId = `override:${idx}`;
        if (typeof obj.readOnly !== 'boolean') obj.readOnly = true;
        if (typeof obj.sourceReaderEditionId !== 'string') {
          obj.sourceReaderEditionId = String(issueDoc.readerEditionId || '');
        }
        return obj as MagazinePage;
      });
    } else {
      const pagesSnap = await issueRef.collection('pages').get();
      const builderPages: MagazinePage[] = pagesSnap.docs.map((d) => ({ docId: d.id, ...(d.data() as any) }) as MagazinePage);

      if (builderPages.length === 0 && issueDoc.readerEditionId) {
        try {
          const existingForFallback = await getReaderEditionById(String(issueDoc.readerEditionId));
          if (existingForFallback && Array.isArray((existingForFallback as any).pages) && (existingForFallback as any).pages.length > 0) {
            const fallbackPages: ReaderPage[] = (existingForFallback as any).pages as ReaderPage[];
            const editionIdForFallback = String(existingForFallback.id || issueDoc.readerEditionId || '');
            sourcePages = fallbackPages.map((rp, i) => {
              const pos =
                typeof (rp as any).position === 'number' ? (rp as any).position :
                typeof (rp as any).pageNumber === 'number' ? (rp as any).pageNumber :
                i + 1;
              const now = new Date().toISOString();
              return {
                docId: `reader:${editionIdForFallback}:page:${i}:${pos}`,
                id: 10000 + pos,
                pageNumber: pos,
                position: pos,
                type: String((rp as any).type || (rp as any).template || 'feature-left').toLowerCase().replace(/^editorial$/i, 'editorial') === 'ad' ? 'full-page-ad' : String((rp as any).type || (rp as any).template || 'feature-left'),
                readOnly: true,
                generatedFromStoryLibrary: true,
                sourceReaderEditionId: editionIdForFallback,
                sourceRef: String((rp as any).id || ''),
                storyId: String((rp as any).storyId || (rp as any).content?.storyId || ''),
                content: (rp as any).content || {},
                slug: (rp as any).slug,
                title: (rp as any).title || (rp as any).content?.title || '',
                createdAt: now,
                updatedAt: now,
              } as unknown as MagazinePage;
            });
          } else {
            sourcePages = builderPages;
          }
        } catch {
          sourcePages = builderPages;
        }
      } else {
        sourcePages = builderPages;
      }
    }

    if (Array.isArray(opts.readerPagesOverride) && opts.readerPagesOverride.length === 0) {
      sourcePages = [];
    }

    const projected: any = mapBuilderIssueToReaderEdition(
      issueDoc as any,
      sourcePages,
    );

    let existingReaderEditionId: string | undefined = String(issueDoc.readerEditionId || '').trim() || undefined;
    if (existingReaderEditionId) {
      try {
        const existingSnap = await getReaderEditionById(existingReaderEditionId);
        if (existingSnap) {
          projected.id = existingSnap.id;
          projected.readerEditionId = existingSnap.id;
          projected.createdAt = (existingSnap as any).createdAt ?? projected.createdAt ?? new Date().toISOString();
        } else {
          existingReaderEditionId = undefined;
        }
      } catch {
        existingReaderEditionId = undefined;
      }
    }
    projected.updatedAt = new Date().toISOString();

    const parseResult = ReaderEditionSchema.safeParse(projected);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'ReaderEditionSchema validation failed',
        schemaIssues: (parseResult as any).error?.issues || [],
      };
    }
    const validated = parseResult.data;

    await upsertReaderEdition(validated as ReaderEdition);
    const readerEditionId =
      existingReaderEditionId ||
      String((validated as any).id || String(projected.id || '')) ||
      String(issueDoc.readerEditionId || '');
    const publicSlug = String((validated as any).slug || issueDoc.readerEditionSlug || issueDoc.slug || '').trim();

    const issuePatch: Record<string, unknown> = {
      readerEditionId,
      slug: publicSlug || issueDoc.slug,
      readerEditionSlug: publicSlug || issueDoc.readerEditionSlug,
      published: (validated as any).published ?? issueDoc.published ?? true,
      title: validated.title || issueDoc.title,
      publishDate: validated.publishDate || issueDoc.publishDate,
      pageCount: Array.isArray(validated.pages) ? validated.pages.length : 0,
      updatedAt: new Date().toISOString(),
    };
    await issueRef.set(issuePatch, { merge: true });

    try {
      await syncReaderEditionsForIssue(issueId);
    } catch (err: any) {
      console.warn('[syncBuilderToReaderEditionAction] syncReaderEditionsForIssue non-fatal:', err?.message || err);
    }

    safeRevalidatePublicMagazineRoutesForIssue({ issueId, slug: publicSlug });
    if (!opts.revalidatePublicRoutesOnly) {
      safeRevalidatePath('/admin/magazine');
      safeRevalidatePath(`/admin/magazine/builder/${issueId}`);
    }

    return { success: true, readerEditionId, pageCount: issuePatch.pageCount as number };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

export async function deleteReaderEditionAction(editionId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Firebase Admin not configured');
    if (!editionId) throw new Error('Edition ID is required');

    const { deleteReaderEdition } = await import('@/features/magazine/server/simple-reader');
    await deleteReaderEdition(editionId);

    if (adminDb) {
      const snapshot = await adminDb.collection('magazine_issues')
        .where('readerEditionId', '==', editionId)
        .select()
        .limit(20)
        .get();
      const unlinkPromises = snapshot.docs.map(async (doc) => {
        try {
          await adminDb!.collection('magazine_issues').doc(doc.id).update({
            readerEditionId: null,
            readerEditionSlug: null,
            readerEditionPublished: false,
            readerEditionTitle: null,
            readerEditionPublishDate: null,
            readerEditionPageCount: null,
          });
        } catch (unlinkErr) {
          console.warn(`Failed to unlink edition from issue ${doc.id}:`, unlinkErr);
        }
      });
      await Promise.all(unlinkPromises);
    }

    safeRevalidatePath('/magazine');
    safeRevalidatePath('/new-edition');
    safeRevalidatePath('/admin/magazine');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting reader edition:', error);
    return { success: false, error: error.message || 'Failed to delete edition' };
  }
}

export async function getReaderEditionByIssueIdAction(issueId: string): Promise<{ success: boolean; data?: ReaderEdition | null; error?: string }> {
  try {
    await checkAdmin();
    if (!issueId) return { success: true, data: null };
    const edition = await getReaderEditionByIssueId(issueId);
    if (!edition) return { success: true, data: null };
    const { hydrateEditionWithLegacyPages } = await import('@/features/magazine/server/simple-reader');
    const hydrated = await hydrateEditionWithLegacyPages(edition);
    return { success: true, data: hydrated };
  } catch (error: any) {
    console.error('getReaderEditionByIssueIdAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch reader edition' };
  }
}

function pickImageFromReaderPageContent(content: any): string {
  if (!content || typeof content !== 'object') return '';
  const candidates = [
    content.imageUrl,
    content.coverImage,
    content.heroImage,
    content.featureImage,
    content.mainImage,
    content.backgroundImage,
    content.image,
    Array.isArray(content.imageUrls) ? content.imageUrls[0] : undefined,
    Array.isArray(content.images) ? content.images[0] : undefined,
    Array.isArray(content.gallery) ? content.gallery[0] : undefined,
  ];
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
  }
  return '';
}

function slugifyStoryId(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `story-${Math.random().toString(36).slice(2, 8)}`;
}

function buildStoryLibraryItemsFromReaderPages(
  issueId: string,
  editionId: string,
  readerPages: any[],
): StoryLibraryItem[] {
  const now = new Date().toISOString();
  const arr = Array.isArray(readerPages) ? readerPages : [];
  const out: StoryLibraryItem[] = [];
  const usedSlugs = new Set<string>();

  for (let i = 0; i < arr.length; i++) {
    const rp = arr[i];
    const template = String(rp.template || '').toLowerCase();
    const content = rp.content || {};

    const skipTemplates = new Set(['ad', 'full-page-ad', 'cover', 'contents', 'back-cover']);
    if (skipTemplates.has(template)) continue;

    const title = String(
      content.title || content.headline || content.name || content.brand || rp.title || '',
    ).trim();
    if (!title) continue;

    const standfirst = String(
      content.standfirst || content.subtitle || content.intro || content.description || content.kicker || '',
    ).trim() || undefined;
    const author = String(content.author || content.byline || '').trim() || undefined;
    const text = String(
      content.body || content.text || content.article || content.storyText || '',
    ).trim();
    const imageUrl = pickImageFromReaderPageContent(content) || undefined;
    const position = typeof rp.position === 'number' ? rp.position : i + 1;

    let slug = slugifyStoryId(title);
    let n = 2;
    while (usedSlugs.has(slug)) { slug = `${slugifyStoryId(title)}-${n}`; n += 1; }
    usedSlugs.add(slug);

    const premiumReaderPriority = position;

    const id = `${issueId}-library-reader-edition-${editionId}-${String(position).padStart(4, '0')}-${slug}`;
    out.push({
      id,
      title,
      author,
      standfirst,
      text,
      imageUrl,
      includedInPremiumReader: true,
      premiumReaderPriority,
      premiumReaderContentType:
        template === 'editor-note' ? 'editorial' :
        template === 'feature-full' || template === 'feature-left' || template === 'feature-right' ? 'feature' :
        template === 'spotlight' ? 'spotlight' :
        template === 'column' ? 'column' :
        template === 'lifestyle' ? 'lifestyle' :
        template === 'partner' ? 'partner' : 'feature',
      premiumReaderPlacementPreference: template,
      imageFileNames: Array.isArray(content.imageFileNames) ? content.imageFileNames : undefined,
      sourceRef: `reader-edition:${editionId}:page:${position}`,
      source: {
        type: 'reader-edition',
        fileName: String(rp.content?.source?.fileName || ''),
        path: `readerPages[${i}]@${editionId}`,
      },
      createdAt: rp.createdAt || rp.updatedAt || now,
    } satisfies StoryLibraryItem);
  }
  return out;
}

export async function syncReaderEditionToLegacyIssue(
  editionId: string,
  issueId: string,
): Promise<{
  storyLibraryCount: number;
  legacyPageCount: number;
  removedLegacyIds: string[];
}> {
  if (!adminDb) throw new Error('Database not initialized');
  if (!editionId) throw new Error('ReaderEdition id is required');
  if (!issueId) throw new Error('Issue id is required');

  const { getReaderEditionById, hydrateEditionWithLegacyPages } = await import('@/features/magazine/server/simple-reader');
  const rawEdition = await getReaderEditionById(editionId);
  if (!rawEdition) throw new Error(`ReaderEdition not found: ${editionId}`);
  const edition = (await hydrateEditionWithLegacyPages(rawEdition)) || rawEdition;
  const flatPages = Array.isArray(edition.pages) ? edition.pages : [];
  if (flatPages.length === 0) throw new Error(`ReaderEdition ${editionId} has an empty pages array`);

  const nextStoryLibrary = buildStoryLibraryItemsFromReaderPages(issueId, editionId, flatPages);
  await persistStoryLibraryForIssue(issueId, nextStoryLibrary);

  const pagesRef = adminDb.collection('magazine_issues').doc(issueId).collection('pages');
  const existingSnap = await pagesRef.orderBy('id', 'asc').get();
  const existingById = new Map<number, { docId: string; data: MagazinePage }>();
  for (const doc of existingSnap.docs) {
    const d = doc.data() as MagazinePage;
    const num = typeof d.id === 'number' ? d.id : Number(d.id || 0);
    existingById.set(num, { docId: doc.id, data: d });
  }

  const now = new Date().toISOString();
  const batch = adminDb.batch();
  const removedLegacyIds: string[] = [];

  const maxPrintId = Math.max(...flatPages.map((rp: any) => typeof rp.position === 'number' ? rp.position : 0));
  for (const [idNum, info] of existingById) {
    if (idNum > 0 && idNum <= maxPrintId) {
      batch.delete(pagesRef.doc(info.docId));
      removedLegacyIds.push(info.docId);
    }
  }

  const SOURCE_TEMPLATE_TO_PAGE_TYPE: Record<string, string> = {
    'cover': 'cover',
    'contents': 'contents',
    'editor-note': 'editorial',
    'letter-from-editor': 'editorial',
    'masthead': 'editorial',
    'news-in-brief': 'column',
    'news-in-brief-page': 'column',
    'news-brief': 'column',
    'feature-full': 'feature-full',
    'feature-left': 'feature-left',
    'feature-right': 'feature-right',
    'two-column': 'column',
    'three-column': 'column',
    'listing-directory': 'partner',
    'directory-page': 'partner',
    'member-profile': 'spotlight',
    'gallery': 'lifestyle',
    'gallery-grid': 'lifestyle',
    'photo-essay': 'lifestyle',
    'advertisement': 'full-page-ad',
    'full-page-ad': 'full-page-ad',
    'ad': 'full-page-ad',
    'sponsor-spotlight': 'partner',
    'back-cover': 'back-cover',
  };
  const legacyPageCount = flatPages.length;
  for (let i = 0; i < flatPages.length; i++) {
    const rp: any = flatPages[i];
    const pos = typeof rp.position === 'number' ? rp.position : i + 1;
    const sourceTemplate = String(rp.template || '').toLowerCase();
    const type = SOURCE_TEMPLATE_TO_PAGE_TYPE[sourceTemplate] || 'feature-full';
    let content = rp.content && typeof rp.content === 'object' ? { ...rp.content } : {};
    const title = String(content.title || rp.title || '').trim();
    const body = String(content.body || content.text || '').trim();
    if (title) content.title = title;
    if (body) { content.body = body; content.text = body; }
    content.position = pos;
    content.template = rp.template;
    content = normalizeMagazinePageContent(content);
    const storyLibraryForPosition = nextStoryLibrary.find((s) => s.sourceRef === `reader-edition:${editionId}:page:${pos}`);
    const storyId = storyLibraryForPosition?.id || String(rp.storyId || content.storyId || '').trim() || undefined;

    const legacyDoc: any = {
      id: pos,
      type,
      pageNumber: pos,
      position: pos,
      readOnly: false,
      storyId,
      sourceReaderEditionId: editionId,
      sourceTemplate: rp.template || '',
      generatedFromStoryLibrary: true,
      sourceRef: `reader-edition:${editionId}:page:${pos}`,
      content,
      createdAt: rp.createdAt || now,
      updatedAt: now,
      name: title || `${String(rp.template || 'Page')} ${pos}`,
    };
    const docRef = pagesRef.doc();
    batch.set(docRef, legacyDoc);
  }

  await batch.commit();

  return { storyLibraryCount: nextStoryLibrary.length, legacyPageCount, removedLegacyIds };
}

export async function runSyncLegacyFromReaderEditionAction(
  issueId: string,
): Promise<{ success: boolean; data?: { storyLibraryCount: number; legacyPageCount: number; editionId: string | null } | null; error?: string }> {
  try {
    await checkAdmin();
    if (!issueId) return { success: true, data: null };
    const edition = await getReaderEditionByIssueId(issueId);
    if (!edition) return { success: false, error: 'No ReaderEdition linked to this issue. Publish via Auto-Import IDML first.' };
    const stats = await syncReaderEditionToLegacyIssue(edition.id, issueId);
    safeRevalidatePath(`/admin/magazine/builder/${issueId}`);
    safeRevalidatePath('/magazine');
    return { success: true, data: { ...stats, editionId: edition.id } };
  } catch (error: any) {
    console.error('runSyncLegacyFromReaderEditionAction error:', error);
    return { success: false, error: error.message || 'Failed to sync ReaderEdition into legacy builder systems' };
  }
}
