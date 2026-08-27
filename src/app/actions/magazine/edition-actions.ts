import { adminDb } from '@/lib/firebase-admin';
import { checkAdmin } from '@/lib/server/auth-utils';
import type { ReaderEdition } from '@/features/magazine/domain/types';
import { MagazineIssueSchema, safeParseMagazine } from '@/features/magazine/domain/validation-schemas';
import { listReaderEditions } from '@/features/magazine/server/simple-reader';
import { deriveIssueSlug } from '@/features/magazine/domain/builder-to-reader';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';
import { safeRevalidatePath } from './_helpers';
import { syncBuilderToReaderEditionAction } from './reader-edition-actions';

/**
 * getPosts() in lib/ghost.ts deliberately swallows every fetch/network
 * error and returns `[]` (it's also used on the public site, where a
 * silent empty result is the right fallback). That's the wrong behavior
 * for this ADMIN-only action though: an admin staring at an empty "Import
 * from Ghost CMS" tab has no way to tell "there really are 0 posts" apart
 * from "the connection/config is broken in this environment" (e.g. a
 * missing/mismatched env var in a deployed environment vs. local .env).
 * When getPosts() comes back empty, re-attempt a single direct request
 * against each configured base URL here and surface the *actual* reason
 * (HTTP status, or the fetch error) back to the admin UI toast.
 */
async function diagnoseGhostConnectionFailure(): Promise<string | null> {
  const key = String(
    process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || process.env.GHOST_CONTENT_API_KEY || '',
  ).trim();
  const rawBases = [
    process.env.NEXT_PUBLIC_GHOST_API_URL,
    process.env.GHOST_API_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter((v): v is string => Boolean(v && v.trim()));
  if (rawBases.length === 0) {
    return 'No Ghost API URL configured in this environment (NEXT_PUBLIC_GHOST_API_URL / NEXT_PUBLIC_SITE_URL are both unset).';
  }

  const attempts: string[] = [];
  for (const rawBase of rawBases) {
    const base = rawBase.trim().replace(/\/$/, '');
    try {
      const url = new URL(`${base}/ghost/api/content/posts/`);
      url.searchParams.set('key', key);
      url.searchParams.set('limit', '1');
      const res = await fetch(url.toString(), { headers: { 'Accept-Version': 'v5.0' } });
      if (res.ok) {
        // Reachable with a valid key — the 0 results really are 0 posts.
        return null;
      }
      const body = await res.text().catch(() => '');
      let detail = '';
      try {
        const parsed = JSON.parse(body);
        detail = parsed?.errors?.[0]?.message || '';
      } catch {
        /* non-JSON body, ignore */
      }
      attempts.push(`${base} → HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    } catch (err: any) {
      attempts.push(`${base} → ${err?.message || 'request failed'}`);
    }
  }
  return `Could not reach Ghost in this environment. ${attempts.join('; ')}`;
}

export async function getGhostPostsAction(options?: any) {
  try {
    await checkAdmin();
    const { getPosts } = await import('@/lib/ghost');
    const hasGhostKey = Boolean(
      process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || process.env.GHOST_CONTENT_API_KEY
    );
    if (!hasGhostKey) {
      throw new Error('Ghost is not configured (missing Content API key) in this environment.');
    }
    const posts = await getPosts(options);
    if (posts.length === 0) {
      const failureReason = await diagnoseGhostConnectionFailure();
      if (failureReason) {
        return { success: false, error: failureReason };
      }
    }
    return { success: true, data: posts };
  } catch (error: any) {
    console.error("Error in getGhostPostsAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getMagazineIssuesAction() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .get();

    const issues = snapshot.docs.map(doc => {
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
        ...serializedData,
        id: doc.id
      };
    });

    return { success: true, data: issues };
  } catch (error: any) {
    console.error("Error in getMagazineIssuesAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateMagazineIssueAction(issueId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const { id: _ignoredId, ...rest } = data ?? {};
    const issueDoc = await adminDb.collection('magazine_issues').doc(issueId).get();
    const existing = issueDoc.exists ? issueDoc.data() : {};
    const mergedTitle = String(rest.title ?? existing?.title ?? '').trim();
    const mergedTag = String(rest.ghostSyncTag ?? existing?.ghostSyncTag ?? '').trim();
    const mergedReaderSlug = String(rest.readerEditionSlug ?? existing?.readerEditionSlug ?? '').trim();
    const currentSlug = String(rest.slug ?? existing?.slug ?? '').trim();
    const slug = currentSlug || deriveIssueSlug({
      id: issueId,
      title: mergedTitle,
      ghostSyncTag: mergedTag,
      readerEditionSlug: mergedReaderSlug,
    }).toLowerCase();

    const validated = safeParseMagazine(
      MagazineIssueSchema,
      {
        ...existing,
        ...rest,
        id: issueId,
        slug,
        title: mergedTitle,
      },
      `updateMagazineIssueAction issueId=${issueId}`,
    );
    if (!validated.ok) {
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }

    const { id: _idFromValidated, ...cleanValidated } = validated.value as any;
    await adminDb.collection('magazine_issues').doc(issueId).update({
      ...cleanValidated,
      slug,
      updatedAt: new Date().toISOString()
    });

    safeRevalidatePath('/admin/magazine');
    safeRevalidatePath('/magazine');
    safeRevalidatePath('/new-edition');
    try {
      await syncBuilderToReaderEditionAction(issueId);
    } catch (syncErr: any) {
      console.warn('[updateMagazineIssueAction] post-sync Builder→ReaderEdition non-fatal:', syncErr?.message || syncErr);
    }
    return { success: true, slug };
  } catch (error: any) {
    console.error("Error in updateMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function setLatestMagazineIssueAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const now = new Date().toISOString();
    const issuesRef = adminDb.collection('magazine_issues');

    await adminDb.runTransaction(async (tx) => {
      const latestSnap = await tx.get(issuesRef.where('isLatest', '==', true));
      for (const doc of latestSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { isLatest: false, updatedAt: now });
      }
      tx.set(issuesRef.doc(issueId), { isLatest: true, updatedAt: now }, { merge: true });
    });

    safeRevalidatePath('/admin/magazine');
    safeRevalidatePath('/new-edition');
    safeRevalidatePath('/magazine');
    return { success: true };
  } catch (error: any) {
    console.error("Error in setLatestMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function setFeaturedFlipbookIssueAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const now = new Date().toISOString();
    const issuesRef = adminDb.collection('magazine_issues');

    await adminDb.runTransaction(async (tx) => {
      const featuredSnap = await tx.get(issuesRef.where('featureInFlipbook', '==', true));
      for (const doc of featuredSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { featureInFlipbook: false, updatedAt: now });
      }
      tx.set(issuesRef.doc(issueId), { featureInFlipbook: true, updatedAt: now }, { merge: true });
    });

    safeRevalidatePath('/new-edition');
    return { success: true };
  } catch (error: any) {
    console.error("Error in setFeaturedFlipbookIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function createMagazineIssueAction(data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const { id: _ignoredId, ...rest } = data ?? {};
    const slug = deriveIssueSlug({
      id: 'new',
      title: String(rest.title || '').trim(),
      ghostSyncTag: String(rest.ghostSyncTag || '').trim(),
      readerEditionSlug: String(rest.readerEditionSlug || '').trim(),
      slug: String(rest.slug || '').trim(),
    }).toLowerCase();

    const payload = {
      ...rest,
      slug,
      title: String(rest.title || '').trim(),
    };
    const validated = safeParseMagazine(MagazineIssueSchema, payload, 'createMagazineIssueAction');
    if (!validated.ok) {
      return { success: false, error: validated.error, validationIssues: validated.issues };
    }

    const { id: _vId, ...cleanCreate } = validated.value as any;
    const docRef = await adminDb.collection('magazine_issues').add({
      ...cleanCreate,
      slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    safeRevalidatePath('/admin/magazine');
    safeRevalidatePath('/magazine');
    safeRevalidatePath('/new-edition');
    return { success: true, id: docRef.id, slug };
  } catch (error: any) {
    console.error("Error in createMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteMagazineIssueAction(issueId: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).delete();
    safeRevalidatePath('/admin/magazine');
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
}

export interface UnifiedEditionRow {
  key: string;
  source: 'magazine_issue' | 'reader_edition';
  id: string;
  slug?: string;
  title: string;
  description?: string;
  coverImage: string;
  publishDate: string;
  pageCount?: number;
  spreadCount?: number;
  isLatest?: boolean;
  isFeaturedFlipbook?: boolean;
  linkedIssueId?: string;
  linkedReaderEditionId?: string;
  readerEditionSlug?: string;
  readerEditionTitle?: string;
  builderPath?: string;
  viewerPath?: string;
}

export async function getEditionsListingAction(): Promise<{ success: boolean; data?: UnifiedEditionRow[]; error?: string }> {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error('Database not initialized');

    const [issuesSnapshot, readerEditions] = await Promise.all([
      adminDb.collection('magazine_issues').orderBy('publishDate', 'desc').limit(100).get(),
      listReaderEditions(100).catch(() => []),
    ]);

    const readerByIssueId = new Map<string, ReaderEdition>();
    for (const re of readerEditions) {
      if (re.issueId) readerByIssueId.set(re.issueId, re);
    }
    const seenReaderIds = new Set<string>();

    const rows: UnifiedEditionRow[] = [];

    for (const doc of issuesSnapshot.docs) {
      const raw: any = doc.data() ?? {};
      const issueId = doc.id;
      const normalizeTs = (v: any): string => {
        if (!v) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object' && 'seconds' in v) {
          return new Date(v.seconds * 1000).toISOString();
        }
        if (v instanceof Date) return v.toISOString();
        return String(v);
      };
      const tags = Array.isArray(raw.tags) ? raw.tags : [];
      const spreadCount = tags.length;
      const linkedRE = readerByIssueId.get(issueId);
      const coverImageSrc = raw.coverImage || linkedRE?.coverImage || '';

      rows.push({
        key: `issue:${issueId}`,
        source: 'magazine_issue',
        id: issueId,
        slug: raw.slug,
        title: raw.title || 'Untitled issue',
        description: raw.description || '',
        coverImage: fixMagazineImageUrl(coverImageSrc),
        publishDate: normalizeTs(raw.publishDate) || normalizeTs(raw.createdAt) || new Date().toISOString(),
        pageCount: linkedRE?.pageCount,
        spreadCount,
        isLatest: !!raw.isLatest,
        isFeaturedFlipbook: !!raw.isFeaturedFlipbook,
        linkedReaderEditionId: linkedRE?.id || raw.readerEditionId || undefined,
        readerEditionSlug: raw.readerEditionSlug || linkedRE?.slug,
        readerEditionTitle: raw.readerEditionTitle || linkedRE?.title,
        builderPath: `/admin/magazine/builder/${issueId}`,
        viewerPath: raw.readerEditionId || linkedRE
          ? `/magazine`
          : undefined,
      });
      if (linkedRE) seenReaderIds.add(linkedRE.id);
    }

    for (const re of readerEditions) {
      if (seenReaderIds.has(re.id)) continue;
      rows.push({
        key: `reader:${re.id}`,
        source: 'reader_edition',
        id: re.id,
        slug: re.slug,
        title: re.title || 'Untitled reader edition',
        description: re.description || '',
        coverImage: fixMagazineImageUrl(re.coverImage || ''),
        publishDate: re.publishDate || re.createdAt || new Date().toISOString(),
        pageCount: re.pageCount ?? (Array.isArray(re.pages) ? re.pages.length : undefined),
        linkedIssueId: re.issueId,
        viewerPath: `/new-edition`,
        builderPath: re.issueId ? `/admin/magazine/builder/${re.issueId}` : undefined,
      });
    }

    rows.sort((a, b) => {
      const ta = new Date(a.publishDate).getTime() || 0;
      const tb = new Date(b.publishDate).getTime() || 0;
      return tb - ta;
    });

    return { success: true, data: rows };
  } catch (error: any) {
    console.error('Error in getEditionsListingAction:', error);
    return { success: false, error: error.message || 'Failed to load editions listing' };
  }
}
