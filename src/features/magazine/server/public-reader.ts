import slugify from '@sindresorhus/slugify';
import {
  getEditionBySlug,
  listCandidateStories,
  listEditions,
  listFlatplanPages,
  listSlots,
} from './edition-repository';
import type { MagazineIssue } from '@/lib/magazine-service';
import type { Edition, FlatplanPage, Slot, Story } from '../domain/types';

export interface MagazineV2ReaderPage extends FlatplanPage {
  slots: Slot[];
}

export interface MagazineV2ReaderData {
  edition: Edition;
  pages: MagazineV2ReaderPage[];
  stories: Story[];
}

export interface MagazineV2LegacyMatchSummary {
  edition: Edition | null;
  href: string | null;
  score: number;
  pageCount: number;
  slotCount: number;
  readyForPrimary: boolean;
  state: 'legacy_only' | 'v2_assembling' | 'v2_ready' | 'v2_live';
}

type LegacyIssueMatchable = Pick<MagazineIssue, 'title' | 'publishDate' | 'pdfUrl' | 'flipbookUrl'>;

function sortPages(pages: FlatplanPage[]): FlatplanPage[] {
  return [...pages].sort((left, right) => left.position - right.position);
}

function buildPageSlotsMap(slots: Slot[]) {
  const pageSlotsMap = new Map<string, Slot[]>();

  slots.forEach((slot) => {
    const existing = pageSlotsMap.get(slot.flatplanPageId) ?? [];
    existing.push(slot);
    pageSlotsMap.set(slot.flatplanPageId, existing);
  });

  return pageSlotsMap;
}

function hasRenderableReader(pages: FlatplanPage[], slots: Slot[]) {
  return pages.length > 0 && slots.length > 0;
}

function isPrimaryReaderReady(edition: Edition, pages: FlatplanPage[], slots: Slot[]) {
  if (!hasRenderableReader(pages, slots)) return false;

  if (edition.isLive) return true;
  if (edition.readerMode === 'custom') return true;

  return ['ready_for_review', 'approved', 'scheduled', 'live', 'archived'].includes(edition.status);
}

function extractIssuuDocSlug(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);

    if (parsed.hostname === 'e.issuu.com' && parsed.pathname === '/embed.html') {
      const slug = parsed.searchParams.get('d');
      return slug || null;
    }

    const match = parsed.pathname.match(/\/docs\/([^/?#]+)/);
    return match?.[1] || null;
  } catch {
    const embedMatch = url.match(/[?&]d=([^&]+)/);
    if (embedMatch?.[1]) return embedMatch[1];

    const docsMatch = url.match(/\/docs\/([^/?#]+)/);
    return docsMatch?.[1] || null;
  }
}

function buildMonthKey(value?: string): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getLegacyCandidateSlugs(issue: LegacyIssueMatchable): string[] {
  return Array.from(
    new Set(
      [
        extractIssuuDocSlug(issue.flipbookUrl),
        extractIssuuDocSlug(issue.pdfUrl),
        issue.title ? slugify(issue.title) : null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function scoreEditionMatch(edition: Edition, issue: LegacyIssueMatchable, candidateSlugs: string[]): number {
  let score = 0;
  const editionSlug = edition.slug?.toLowerCase();
  const publicationSlug = edition.issuu.publicationSlug?.toLowerCase();
  const issueTitleSlug = issue.title ? slugify(issue.title).toLowerCase() : '';

  candidateSlugs.forEach((slug) => {
    const lower = slug.toLowerCase();
    if (publicationSlug === lower) score += 10;
    if (editionSlug === lower) score += 8;
  });

  if (issueTitleSlug) {
    if (editionSlug === issueTitleSlug) score += 6;
    if (publicationSlug === issueTitleSlug) score += 6;
    if (edition.title && slugify(edition.title).toLowerCase() === issueTitleSlug) score += 4;
  }

  const issueMonthKey = buildMonthKey(issue.publishDate);
  const editionMonthKey = buildMonthKey(edition.publishDate);
  if (issueMonthKey && editionMonthKey && issueMonthKey === editionMonthKey) {
    score += 3;
  }

  return score;
}

async function getBestEditionMatchForLegacyIssue(issue: LegacyIssueMatchable): Promise<{
  edition: Edition | null;
  score: number;
}> {
  const editions = await listEditions(48);
  const candidateSlugs = getLegacyCandidateSlugs(issue);
  const rankedEditions = editions
    .map((edition) => ({
      edition,
      score: scoreEditionMatch(edition, issue, candidateSlugs),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return rankedEditions[0] ?? { edition: null, score: 0 };
}

async function buildReaderData(edition: Edition): Promise<MagazineV2ReaderData | null> {
  const [pages, slots, stories] = await Promise.all([
    listFlatplanPages(edition.id),
    listSlots(edition.id),
    listCandidateStories(250),
  ]);

  if (!hasRenderableReader(pages, slots)) {
    return null;
  }

  const pageSlotsMap = buildPageSlotsMap(slots);
  const relevantStoryIds = new Set(
    slots
      .map((slot) => slot.binding?.storyId)
      .filter((storyId): storyId is string => Boolean(storyId)),
  );

  return {
    edition,
    pages: sortPages(pages).map((page) => ({
      ...page,
      slots: (pageSlotsMap.get(page.id) ?? []).sort((left, right) => left.key.localeCompare(right.key)),
    })),
    stories: stories.filter((story) => relevantStoryIds.has(story.id)),
  };
}

export async function getMagazineV2ReaderDataBySlug(slug: string): Promise<MagazineV2ReaderData | null> {
  const edition = await getEditionBySlug(slug);
  if (!edition) return null;

  return buildReaderData(edition);
}

export async function getLatestMagazineV2ReaderPreview(): Promise<MagazineV2ReaderData | null> {
  const editions = await listEditions(24);
  const rankedEditions = [...editions].sort((left, right) => {
    if (left.isLive !== right.isLive) {
      return left.isLive ? -1 : 1;
    }

    return new Date(right.publishDate).getTime() - new Date(left.publishDate).getTime();
  });

  for (const edition of rankedEditions) {
    const data = await buildReaderData(edition);
    if (data) return data;
  }

  return null;
}

export async function getMagazineV2LegacyMatchSummary(
  issue: LegacyIssueMatchable,
): Promise<MagazineV2LegacyMatchSummary> {
  const match = await getBestEditionMatchForLegacyIssue(issue);
  if (!match.edition) {
    return {
      edition: null,
      href: null,
      score: 0,
      pageCount: 0,
      slotCount: 0,
      readyForPrimary: false,
      state: 'legacy_only',
    };
  }

  const [pages, slots] = await Promise.all([
    listFlatplanPages(match.edition.id),
    listSlots(match.edition.id),
  ]);
  const readyForPrimary = isPrimaryReaderReady(match.edition, pages, slots);

  return {
    edition: match.edition,
    href: pages.length > 0 && slots.length > 0 ? `/magazine/v2/${match.edition.slug}` : null,
    score: match.score,
    pageCount: pages.length,
    slotCount: slots.length,
    readyForPrimary,
    state: match.edition.isLive
      ? 'v2_live'
      : readyForPrimary
        ? 'v2_ready'
        : 'v2_assembling',
  };
}

export async function getPrimaryMagazineV2HrefForLegacyIssue(issue: LegacyIssueMatchable): Promise<string | null> {
  const summary = await getMagazineV2LegacyMatchSummary(issue);
  return summary.readyForPrimary ? summary.href : null;
}
