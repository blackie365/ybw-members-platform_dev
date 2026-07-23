'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin';
import type { MagazineIssue } from '@/lib/magazine-service';
import { checkAdmin } from '@/lib/server/auth-utils';
import { revalidatePath } from 'next/cache';
import { getPosts } from '@/lib/ghost';
import { parseIdml } from '@/lib/idml-parser';
import { mapIdmlToReaderPages, buildEditionMetadata } from '@/lib/idml-template-mapper';
import type { ReaderPage, ReaderEdition } from '@/features/magazine/domain/types';
import { upsertReaderEdition } from '@/features/magazine/server/simple-reader';

export async function getGhostPostsAction(options?: any) {
  try {
    await checkAdmin();
    const hasGhostKey = Boolean(
      process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || process.env.GHOST_CONTENT_API_KEY
    );
    if (!hasGhostKey) {
      throw new Error('Ghost is not configured (missing Content API key).');
    }
    const posts = await getPosts(options);
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
    await adminDb.collection('magazine_issues').doc(issueId).update({
      ...rest,
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/admin/magazine');
    revalidatePath('/magazine');
    return { success: true };
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

    revalidatePath('/admin/magazine');
    revalidatePath('/new-edition');
    revalidatePath('/magazine');
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

    revalidatePath('/new-edition');
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
    const docRef = await adminDb.collection('magazine_issues').add({
      ...rest,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/admin/magazine');
    return { success: true, id: docRef.id };
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
    revalidatePath('/admin/magazine');
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazineIssueAction:", error);
    return { success: false, error: error.message };
  }
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

export async function updateMagazinePageAction(issueId: string, pageId: string, data: any) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('magazine_issues').doc(issueId).collection('pages').doc(pageId).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    revalidatePath(`/admin/magazine/builder/${issueId}`);
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

    const docRef = await adminDb.collection('magazine_issues').doc(issueId).collection('pages').add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    revalidatePath(`/admin/magazine/builder/${issueId}`);
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
    revalidatePath(`/admin/magazine/builder/${issueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteMagazinePageAction:", error);
    return { success: false, error: error.message };
  }
}

export async function fetchIssuuMetadataAction(url: string) {
  try {
    await checkAdmin();

    const oembedUrl = `https://issuu.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch metadata from Issuu');
    }

    const data = await response.json();

    let highResThumbnail = data.thumbnail_url;
    if (data.thumbnail_url) {
      const idMatch = data.thumbnail_url.match(/(?:image\.issuu\.com|image\.isu\.pub)\/([^\/]+)\//);
      if (idMatch && idMatch[1]) {
        highResThumbnail = `https://image.isu.pub/${idMatch[1]}/jpg/page_1.jpg`;
      } else {
        highResThumbnail = data.thumbnail_url
          .replace(/_thumb_(?:small|medium)\.jpg/i, '.jpg')
          .replace(/_thumb_large\.jpg/i, '.jpg')
          .replace(/issuu\.com/i, 'isu.pub');
      }
    }

    return {
      success: true,
      data: {
        title: data.title,
        thumbnailUrl: highResThumbnail,
        authorName: data.author_name,
        description: data.description
      }
    };
  } catch (error: any) {
    console.error("Error in fetchIssuuMetadataAction:", error);
    return { success: false, error: error.message };
  }
}

export async function importIdmlAction(idmlBase64: string, fileName: string) {
  try {
    await checkAdmin();

    const buffer = Buffer.from(idmlBase64, 'base64');
    const data = await processIdmlBuffer(buffer, fileName);
    return { success: true, data };
  } catch (error: any) {
    console.error('Error importing IDML:', error);
    return { success: false, error: error.message || 'Failed to parse IDML file' };
  }
}

export async function importIdmlFromUrlAction(fileUrl: string, fileName: string) {
  try {
    await checkAdmin();

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const data = await processIdmlBuffer(buffer, fileName);
    return { success: true, data };
  } catch (error: any) {
    console.error('Error importing IDML from URL:', error);
    return { success: false, error: error.message || 'Failed to import IDML file' };
  }
}

async function processIdmlBuffer(buffer: Buffer, fileName: string) {
  const parsed = await parseIdml(buffer);

  if (parsed.pages.length === 0) {
    throw new Error('No readable content found in the IDML file');
  }

  const imageUrls: Record<string, string> = {};

  if (parsed.images.length > 0 && adminStorage) {
    const bucket = adminStorage.bucket();
    const uploadPromises = parsed.images.map(async (img) => {
      const filePath = `magazine-import/${fileName}/${img.fileName}`;
      const storageFile = bucket.file(filePath);

      await storageFile.save(img.data, {
        metadata: { contentType: img.mimeType },
      });
      await storageFile.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      return { fileName: img.fileName, url: publicUrl };
    });

    const results = await Promise.all(uploadPromises);
    for (const r of results) {
      imageUrls[r.fileName] = r.url;
    }
  }

  let pages = mapIdmlToReaderPages(parsed.pages);

  pages = pages.map((page) => ({
    ...page,
    content: {
      ...page.content,
      imageUrl: page.content.imageUrl
        ? (imageUrls[page.content.imageUrl] || page.content.imageUrl)
        : '',
      imageUrls: (page.content.imageUrls || []).map(
        (name) => imageUrls[name] || name,
      ),
    },
  }));

  const metadata = buildEditionMetadata(pages, fileName);

  return {
    pages,
    metadata,
    pageCount: parsed.pageCount,
    storyCount: parsed.pages.reduce((sum, p) => sum + p.stories.length, 0),
    imageCount: parsed.images.length,
    imageUrls,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function publishIdmlEditionAction(params: {
  pages: ReaderPage[];
  title: string;
  description: string;
  coverImage: string;
  publishDate?: string;
}) {
  try {
    await checkAdmin();

    const slug = slugify(params.title) || `edition-${Date.now()}`;
    const now = new Date().toISOString();

    const edition: ReaderEdition = {
      id: `idml-${slug}-${Date.now().toString(36)}`,
      slug,
      title: params.title,
      description: params.description,
      coverImage: params.coverImage,
      publishDate: params.publishDate || now,
      pageCount: params.pages.length,
      pages: params.pages,
      createdAt: now,
    };

    await upsertReaderEdition(edition);
    revalidatePath('/magazine');

    return { success: true, data: { id: edition.id, slug: edition.slug } };
  } catch (error: any) {
    console.error('Error publishing IDML edition:', error);
    return { success: false, error: error.message || 'Failed to publish edition' };
  }
}
