'use server';

import slugify from '@sindresorhus/slugify';
import { adminDb } from '@/lib/firebase-admin';
import { getLatestIssueServer, getMagazinePagesServer } from '@/lib/magazine-service-server';
import type { MagazineIssue, MagazinePage } from '@/lib/magazine-service';
import { checkAdmin } from '@/lib/server/auth-utils';
import { revalidatePath } from 'next/cache';
import { getPosts } from '@/lib/ghost';
import { autoFillSlots } from '@/features/magazine/domain/slot-fill';
import {
  listFlatplanPages,
  listSlots,
  upsertEdition,
  upsertSlots,
  upsertStories,
} from '@/features/magazine/server/edition-repository';
import { applyEditionPreset } from '@/features/magazine/server/preset-service';
import { getMagazinePreset } from '@/features/magazine/domain/presets';
import { getMagazineV2LegacyMatchSummary } from '@/features/magazine/server/public-reader';
import type { Edition, Slot, Story } from '@/features/magazine/domain/types';

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

    console.log('[magazineActions] Fetching issues...');
    const snapshot = await adminDb.collection('magazine_issues')
      .orderBy('publishDate', 'desc')
      .get();

    const issues = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convert any Firestore Timestamps to ISO strings for serialization
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

    console.log(`[magazineActions] Found ${issues.length} issues`);
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
    const targetRef = issuesRef.doc(issueId);

    await adminDb.runTransaction(async (tx) => {
      const latestSnap = await tx.get(issuesRef.where('isLatest', '==', true));
      for (const doc of latestSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { isLatest: false, updatedAt: now });
      }
      tx.set(targetRef, { isLatest: true, updatedAt: now }, { merge: true });
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
    const targetRef = issuesRef.doc(issueId);

    await adminDb.runTransaction(async (tx) => {
      const featuredSnap = await tx.get(issuesRef.where('featureInFlipbook', '==', true));
      for (const doc of featuredSnap.docs) {
        if (doc.id === issueId) continue;
        tx.update(doc.ref, { featureInFlipbook: false, updatedAt: now });
      }
      tx.set(targetRef, { featureInFlipbook: true, updatedAt: now }, { merge: true });
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
      // Convert any Firestore Timestamps to ISO strings for serialization
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
    
    // Issuu oEmbed API endpoint
    const oembedUrl = `https://issuu.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch metadata from Issuu');
    }
    
    const data = await response.json();
    
    // Intelligent Thumbnail Parsing:
    // Issuu oEmbed often returns low-res 'small' or 'medium' thumbnails.
    // We want the high-res version from the isu.pub CDN.
    let highResThumbnail = data.thumbnail_url;
    
    if (data.thumbnail_url) {
      // 1. Try to extract the document ID to build the absolute highest quality URL
      // Pattern: .../image.issuu.com/{ID}/jpg/page_1_thumb_large.jpg
      const idMatch = data.thumbnail_url.match(/(?:image\.issuu\.com|image\.isu\.pub)\/([^\/]+)\//);
      
      if (idMatch && idMatch[1]) {
        // This is the gold standard for Issuu cover images
        highResThumbnail = `https://image.isu.pub/${idMatch[1]}/jpg/page_1.jpg`;
      } else {
        // 2. Fallback: If pattern is different, manually swap quality keywords
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

type LegacyIssueWithLibrary = MagazineIssue & {
  storyLibrary?: Array<{
    id?: string;
    title?: string;
    author?: string;
    text?: string;
    imageFileNames?: string[];
    createdAt?: string;
  }>;
};

function getLegacyPageContent(page: MagazinePage | undefined): Record<string, unknown> {
  return page?.content && typeof page.content === 'object' ? (page.content as Record<string, unknown>) : {};
}

function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => getText(entry)).filter(Boolean);
}

const MONTH_LOOKUP = new Map<string, number>([
  ['january', 0],
  ['february', 1],
  ['march', 2],
  ['april', 3],
  ['may', 4],
  ['june', 5],
  ['july', 6],
  ['august', 7],
  ['september', 8],
  ['october', 9],
  ['november', 10],
  ['december', 11],
]);

function formatDateOnly(value: Date): string {
  return value.toISOString().split('T')[0];
}

function resolveLegacyIssuePublishDate(issue: LegacyIssueWithLibrary): string {
  const existingValue = typeof issue.publishDate === 'string' ? issue.publishDate.trim() : '';

  if (existingValue) {
    const parsedExisting = new Date(existingValue);
    if (!Number.isNaN(parsedExisting.getTime())) {
      return existingValue.includes('T') ? formatDateOnly(parsedExisting) : existingValue;
    }
  }

  const title = getText(issue.title).toLowerCase();
  const monthMatches = Array.from(
    title.matchAll(new RegExp(`\\b(${Array.from(MONTH_LOOKUP.keys()).join('|')})\\b`, 'gi')),
  );
  const yearMatch = title.match(/\b(20\d{2})\b/);

  if (monthMatches.length > 0 && yearMatch?.[1]) {
    const firstMonth = monthMatches[0]?.[1]?.toLowerCase();
    const monthIndex = firstMonth ? MONTH_LOOKUP.get(firstMonth) : undefined;

    if (typeof monthIndex === 'number') {
      return formatDateOnly(new Date(Date.UTC(Number(yearMatch[1]), monthIndex, 1)));
    }
  }

  return formatDateOnly(new Date());
}

function createLegacyStory(args: {
  issueId: string;
  storyId: string;
  title: string;
  standfirst?: string;
  body?: string;
  author?: string;
  tags: string[];
  heroImage?: string;
  pullQuotes?: string[];
}): Story {
  const now = new Date().toISOString();

  return {
    id: `${args.issueId}-${args.storyId}`,
    source: 'legacy',
    sourceRef: args.issueId,
    title: args.title,
    standfirst: args.standfirst,
    body: args.body,
    author: args.author,
    tags: args.tags,
    heroImage: args.heroImage
      ? {
          src: args.heroImage,
          alt: args.title,
        }
      : undefined,
    pullQuotes: args.pullQuotes?.filter(Boolean),
    status: 'approved',
    createdAt: now,
    updatedAt: now,
  };
}

function buildLegacyIssueStories(issue: LegacyIssueWithLibrary, pages: MagazinePage[]): Story[] {
  const coverPage = pages.find((page) => page.type === 'cover');
  const editorialPage = pages.find((page) => page.type === 'editorial');
  const primaryFeaturePage = pages.find((page) => page.type === 'feature-left');
  const secondaryFeaturePage = pages.find((page) => page.type === 'feature-right');
  const columnPage = pages.find((page) => page.type === 'column');
  const lifestylePage = pages.find((page) => page.type === 'lifestyle');
  const spotlightPage = pages.find((page) => page.type === 'spotlight');

  const coverContent = getLegacyPageContent(coverPage);
  const editorialContent = getLegacyPageContent(editorialPage);
  const primaryFeatureContent = getLegacyPageContent(primaryFeaturePage);
  const secondaryFeatureContent = getLegacyPageContent(secondaryFeaturePage);
  const columnContent = getLegacyPageContent(columnPage);
  const lifestyleContent = getLegacyPageContent(lifestylePage);
  const spotlightContent = getLegacyPageContent(spotlightPage);

  const stories: Story[] = [
    createLegacyStory({
      issueId: issue.id,
      storyId: 'cover',
      title: getText(coverContent.headline) || issue.title,
      standfirst: getText(coverContent.subheadline) || issue.description,
      tags: ['cover', 'lead', 'featured'],
      heroImage: getText(coverContent.image) || issue.coverImage,
    }),
  ];

  if (getText(editorialContent.title) || getText(editorialContent.text)) {
    stories.push(
      createLegacyStory({
        issueId: issue.id,
        storyId: 'editorial',
        title: getText(editorialContent.title) || `From the editor: ${issue.title}`,
        standfirst: getText(editorialContent.role),
        body: getText(editorialContent.text),
        author: getText(editorialContent.author),
        tags: ['editorial', 'cover', 'highlight'],
        heroImage: getText(editorialContent.image),
        pullQuotes: [getText(editorialContent.quote)],
      }),
    );
  }

  if (getText(primaryFeatureContent.title) || getText(primaryFeatureContent.intro)) {
    const primaryFeatureTitle = [getText(primaryFeatureContent.title), getText(primaryFeatureContent.name)]
      .filter(Boolean)
      .join(': ');

    stories.push(
      createLegacyStory({
        issueId: issue.id,
        storyId: 'feature-primary',
        title: primaryFeatureTitle || issue.title,
        standfirst: getText(primaryFeatureContent.intro),
        tags: ['feature', 'lead', 'interview'],
        heroImage: getText(primaryFeatureContent.image),
      }),
    );
  }

  if (getText(secondaryFeatureContent.text) || getText(secondaryFeatureContent.quote)) {
    stories.push(
      createLegacyStory({
        issueId: issue.id,
        storyId: 'feature-secondary',
        title: `${issue.title} Highlights`,
        standfirst: getText(secondaryFeatureContent.quote),
        body: getText(secondaryFeatureContent.text),
        tags: ['feature', 'secondary'],
        heroImage: getText(secondaryFeatureContent.image),
        pullQuotes: [getText(secondaryFeatureContent.quote)],
      }),
    );
  }

  if (getText(columnContent.title) || getText(columnContent.text)) {
    const tips = getStringList(columnContent.tips);
    stories.push(
      createLegacyStory({
        issueId: issue.id,
        storyId: 'column',
        title: getText(columnContent.title) || 'Expert Column',
        standfirst: [getText(columnContent.category), getText(columnContent.author)].filter(Boolean).join(' | '),
        body: [getText(columnContent.text), ...tips.map((tip) => `• ${tip}`)].filter(Boolean).join('\n\n'),
        author: getText(columnContent.author),
        tags: ['feature', 'supporting', 'expert'],
        heroImage: getText(columnContent.image),
      }),
    );
  }

  if (getText(lifestyleContent.title) || getText(lifestyleContent.text)) {
    const highlights = getStringList(lifestyleContent.highlights);
    stories.push(
      createLegacyStory({
        issueId: issue.id,
        storyId: 'lifestyle',
        title: getText(lifestyleContent.title) || 'Lifestyle Feature',
        standfirst: highlights[0],
        body: [getText(lifestyleContent.text), ...highlights.map((entry) => `• ${entry}`)]
          .filter(Boolean)
          .join('\n\n'),
        tags: ['feature', 'supporting', 'lifestyle'],
        heroImage: getText(lifestyleContent.image),
      }),
    );
  }

  if (getText(spotlightContent.name) || getText(spotlightContent.bio)) {
    stories.push(
      createLegacyStory({
        issueId: issue.id,
        storyId: 'spotlight',
        title: getText(spotlightContent.name) || 'Member Spotlight',
        standfirst: getText(spotlightContent.role),
        body: getText(spotlightContent.bio),
        tags: ['feature', 'supporting', 'profile'],
        heroImage: getText(spotlightContent.image),
        pullQuotes: [getText(spotlightContent.message)],
      }),
    );
  }

  (issue.storyLibrary ?? []).forEach((entry, index) => {
    const text = getText(entry.text);
    const title = getText(entry.title);
    if (!text && !title) return;

    stories.push(
      createLegacyStory({
        issueId: issue.id,
        storyId: `library-${entry.id || index + 1}`,
        title: title || `Imported Story ${index + 1}`,
        body: text,
        author: getText(entry.author),
        tags: ['feature', 'supporting', 'imported'],
      }),
    );
  });

  return stories;
}

function applyLegacyPreviewOverrides(issue: LegacyIssueWithLibrary, pages: MagazinePage[], slots: Slot[]): Slot[] {
  const now = new Date().toISOString();
  const contentsContent = getLegacyPageContent(pages.find((page) => page.type === 'contents'));
  const partnerContent = getLegacyPageContent(pages.find((page) => page.type === 'partner'));
  const backCoverContent = getLegacyPageContent(pages.find((page) => page.type === 'back-cover'));

  const contentsEntries = Array.isArray(contentsContent.items)
    ? contentsContent.items
        .map((item) => {
          const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
          const title = getText(record.title);
          const pageLabel = getText(record.page);
          return title && pageLabel ? { title, pageLabel } : null;
        })
        .filter((entry): entry is { title: string; pageLabel: string } => Boolean(entry))
    : [];

  const quotePool = [
    getText(getLegacyPageContent(pages.find((page) => page.type === 'editorial')).quote),
    getText(getLegacyPageContent(pages.find((page) => page.type === 'feature-right')).quote),
    getText(getLegacyPageContent(pages.find((page) => page.type === 'spotlight')).message),
  ].filter(Boolean);

  const galleryPool = [
    issue.coverImage,
    getText(getLegacyPageContent(pages.find((page) => page.type === 'feature-left')).image),
    getText(getLegacyPageContent(pages.find((page) => page.type === 'feature-right')).image),
    getText(getLegacyPageContent(pages.find((page) => page.type === 'column')).image),
    getText(getLegacyPageContent(pages.find((page) => page.type === 'lifestyle')).image),
    getText(getLegacyPageContent(pages.find((page) => page.type === 'spotlight')).image),
  ].filter(Boolean);

  let quoteIndex = 0;
  let galleryIndex = 0;

  return slots.map((slot) => {
    if (slot.contentType === 'contents' && contentsEntries.length > 0) {
      return {
        ...slot,
        binding: {
          ...slot.binding,
          generatedContentId: `${issue.id}-contents`,
        },
        overrideData: {
          entries: contentsEntries,
        },
        updatedAt: now,
      };
    }

    if (slot.contentType === 'quote' && quotePool[quoteIndex]) {
      const quote = quotePool[quoteIndex];
      quoteIndex += 1;
      return {
        ...slot,
        overrideData: {
          quote,
          attribution: issue.title,
        },
        updatedAt: now,
      };
    }

    if (slot.contentType === 'gallery' && galleryPool[galleryIndex]) {
      const src = galleryPool[galleryIndex];
      galleryIndex += 1;
      return {
        ...slot,
        overrideData: {
          items: [
            {
              src,
              alt: issue.title,
            },
          ],
        },
        updatedAt: now,
      };
    }

    if (slot.contentType === 'ad' && (getText(partnerContent.headline) || getText(partnerContent.offer))) {
      return {
        ...slot,
        binding: {
          ...slot.binding,
          adPlacementId: `${issue.id}-legacy-partner`,
        },
        overrideData: {
          advertiserName: getText(partnerContent.brand) || 'Partner Feature',
          headline: getText(partnerContent.headline) || issue.title,
          body: getText(partnerContent.offer) || issue.description,
          ctaLabel: 'Enquire',
          ctaHref: '/contact',
          imageSrc: getText(partnerContent.image) || issue.coverImage,
        },
        updatedAt: now,
      };
    }

    if (slot.contentType === 'static_copy' && (getText(backCoverContent.title) || getText(backCoverContent.cta))) {
      return {
        ...slot,
        overrideData: {
          eyebrow: 'Closing Note',
          title: getText(backCoverContent.title) || issue.title,
          body:
            [getText(backCoverContent.nextIssue), getText(backCoverContent.cta)].filter(Boolean).join(' · ') ||
            issue.description,
          ctaLabel: getText(backCoverContent.cta) || 'Explore Membership',
          ctaHref: '/membership',
        },
        updatedAt: now,
      };
    }

    return slot;
  });
}

function buildLegacyEditionShell(issue: LegacyIssueWithLibrary): Edition {
  const now = new Date().toISOString();
  const publishDate = resolveLegacyIssuePublishDate(issue);
  const publicationSlug = (() => {
    const url = getText(issue.flipbookUrl || issue.pdfUrl);
    const docsMatch = url.match(/\/docs\/([^/?#]+)/i);
    if (docsMatch?.[1]) return docsMatch[1];
    const embedMatch = url.match(/[?&]d=([^&]+)/i);
    return embedMatch?.[1] || undefined;
  })();

  return {
    id: `legacy-${issue.id}`,
    slug: slugify(issue.title || issue.id),
    title: issue.title,
    description: issue.description,
    publishDate,
    coverImage: issue.coverImage,
    status: 'assembling',
    readerMode: 'issuu_fallback',
    themeVariant: 'ybw-editorial',
    isLive: false,
    createdAt: now,
    updatedAt: now,
    issuu: {
      publicationSlug,
      shareUrl: getText(issue.flipbookUrl) || undefined,
      embedUrl: getText(issue.flipbookUrl) || undefined,
      downloadUrl: getText(issue.pdfUrl) || undefined,
      coverImage: issue.coverImage,
      publishDate,
      syncedAt: now,
    },
  };
}

async function buildPremiumReaderFromLatestLocalIssue() {
  const latestIssue = (await getLatestIssueServer()) as LegacyIssueWithLibrary | null;
  if (!latestIssue) {
    throw new Error('No live local issue was found.');
  }

  const legacyPages = await getMagazinePagesServer(latestIssue.id);
  const existingMatch = await getMagazineV2LegacyMatchSummary({
    ...latestIssue,
    publishDate: resolveLegacyIssuePublishDate(latestIssue),
  });

  let edition = existingMatch.edition ?? buildLegacyEditionShell(latestIssue);
  if (!existingMatch.edition) {
    await upsertEdition(edition);
  }

  let pages = existingMatch.edition ? await listFlatplanPages(edition.id) : [];
  let slots = existingMatch.edition ? await listSlots(edition.id) : [];

  if (!edition.presetId || pages.length === 0 || slots.length === 0) {
    const presetResult = await applyEditionPreset(edition, 'standard_monthly');
    edition = {
      ...presetResult.edition,
      status: 'assembling',
      readerMode: 'issuu_fallback',
      isLive: false,
      updatedAt: new Date().toISOString(),
    };
    await upsertEdition(edition);
    pages = presetResult.pages;
    slots = presetResult.slots;
  }

  const stories = buildLegacyIssueStories(latestIssue, legacyPages);
  await upsertStories(stories);

  const autoFilled = autoFillSlots({
    pages,
    slots,
    stories,
  });
  const enrichedSlots = applyLegacyPreviewOverrides(latestIssue, legacyPages, autoFilled.slots);
  await upsertSlots(edition.id, enrichedSlots);

  const finalEdition: Edition = {
    ...edition,
    publishDate: resolveLegacyIssuePublishDate(latestIssue),
    status: 'assembling',
    readerMode: 'issuu_fallback',
    isLive: false,
    updatedAt: new Date().toISOString(),
  };
  await upsertEdition(finalEdition);

  revalidatePath('/admin/magazine');
  revalidatePath('/new-edition');
  revalidatePath('/magazine');
  revalidatePath(`/magazine/v2/${finalEdition.slug}`);

  return {
    legacyIssueId: latestIssue.id,
    legacyIssueTitle: latestIssue.title,
    editionId: finalEdition.id,
    editionTitle: finalEdition.title,
    previewHref: `/magazine/v2/${finalEdition.slug}`,
    importedStories: stories.length,
    pageCount: pages.length,
    slotCount: enrichedSlots.length,
    unresolvedSlots: autoFilled.result.unresolvedSlots.length,
  };
}

export async function getLatestPremiumReaderStatusAction() {
  try {
    await checkAdmin();
    const latestIssue = (await getLatestIssueServer()) as LegacyIssueWithLibrary | null;

    if (!latestIssue) {
      return { success: true, data: null };
    }

    const summary = await getMagazineV2LegacyMatchSummary({
      ...latestIssue,
      publishDate: resolveLegacyIssuePublishDate(latestIssue),
    });

    return {
      success: true,
      data: {
        legacyIssueId: latestIssue.id,
        legacyIssueTitle: latestIssue.title,
        state: summary.state,
        detail:
          summary.state === 'legacy_only'
            ? 'No premium reader edition has been created from the current live issue yet.'
            : summary.state === 'v2_assembling'
              ? 'A premium reader edition exists for the live issue, but it still needs refinement.'
              : summary.state === 'v2_live'
                ? 'The current live issue is already available in the premium reader.'
                : 'A premium-reader preview is ready to review.',
        editionId: summary.edition?.id,
        editionTitle: summary.edition?.title,
        previewHref: summary.href,
      },
    };
  } catch (error: any) {
    console.error('Error in getLatestPremiumReaderStatusAction:', error);
    return { success: false, error: error.message };
  }
}

export async function getLatestPremiumReaderCurationSummaryAction() {
  try {
    await checkAdmin();
    const latestIssue = (await getLatestIssueServer()) as LegacyIssueWithLibrary | null;

    if (!latestIssue) {
      return { success: true, data: null };
    }

    const legacyPages = await getMagazinePagesServer(latestIssue.id);
    const preset = getMagazinePreset('standard_monthly');
    if (!preset) {
      throw new Error('The standard monthly flatplan preset is missing.');
    }

    const mappedStories = buildLegacyIssueStories(latestIssue, legacyPages);
    const availablePageTypes = Array.from(
      new Set(
        legacyPages
          .map((page) => getText(page.type))
          .filter(Boolean),
      ),
    );

    return {
      success: true,
      data: {
        legacyIssueId: latestIssue.id,
        legacyIssueTitle: latestIssue.title,
        hasFlipbook: Boolean(getText(latestIssue.flipbookUrl)),
        flipbookHref: getText(latestIssue.flipbookUrl) || null,
        presetLabel: preset.label,
        flatplanPageCount: preset.pages.length,
        mappedStoryCount: mappedStories.length,
        availablePageTypes,
        flatplan: preset.pages.map((page) => ({
          position: page.position,
          intent: page.intent.replace(/_/g, ' '),
          template: `${page.templateFamily}/${page.templateVariant}`,
        })),
      },
    };
  } catch (error: any) {
    console.error('Error in getLatestPremiumReaderCurationSummaryAction:', error);
    return { success: false, error: error.message };
  }
}

export async function buildPremiumReaderFromLatestIssueAction() {
  try {
    await checkAdmin();
    const data = await buildPremiumReaderFromLatestLocalIssue();
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in buildPremiumReaderFromLatestIssueAction:', error);
    return { success: false, error: error.message };
  }
}
