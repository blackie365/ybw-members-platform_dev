import {
  CURRENT_READER_SCHEMA_VERSION,
  fixMagazineImageUrl,
  isPlaceholderImageUrl,
  normalizeImageUrl,
} from '@/lib/magazine-utils';
export { CURRENT_READER_SCHEMA_VERSION };
import type { ReaderEdition } from '../domain/types';
import { editionRecordsMatch } from '../domain/edition-match';

/**
 * Published magazine reader — Postgres-only facade.
 *
 * All edition reads resolve through the Postgres read store; all writes go
 * through the Postgres write store. Firestore is no longer a source for
 * magazine data (Phase 5 complete).
 */

function sanitizeImageUrl(value: unknown): string {
  const normalized = normalizeImageUrl(value);
  if (!normalized) return '';
  if (isPlaceholderImageUrl(normalized)) return '';
  return fixMagazineImageUrl(normalized);
}

export async function getReaderEditionByIssueId(issueId: string): Promise<ReaderEdition | null> {
  const { getMagazineReadStore } = await import('./read-store');
  const edition = await getMagazineReadStore().getReaderEditionByIssueId(issueId);
  return edition && Array.isArray(edition.pages) && edition.pages.length > 0 ? edition : null;
}

export async function getReaderEditionById(id: string): Promise<ReaderEdition | null> {
  const { getMagazineReadStore } = await import('./read-store');
  const edition = await getMagazineReadStore().getReaderEditionById(id);
  return edition && Array.isArray(edition.pages) && edition.pages.length > 0 ? edition : null;
}

export async function listReaderEditions(limit = 24): Promise<ReaderEdition[]> {
  const { getMagazineReadStore } = await import('./read-store');
  const editions = await getMagazineReadStore().listReaderEditions(limit);
  return Array.isArray(editions) ? editions : [];
}

export async function getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null> {
  const { getMagazineReadStore } = await import('./read-store');
  const edition = await getMagazineReadStore().getReaderEditionBySlug(slug);
  return edition && Array.isArray(edition.pages) && edition.pages.length > 0 ? edition : null;
}

export async function getReaderEditionIdBySlug(slug: string): Promise<string | null> {
  const { getMagazineReadStore } = await import('./read-store');
  const edition = await getMagazineReadStore().getReaderEditionBySlug(slug);
  return edition && edition.id ? String(edition.id) : null;
}

export async function upsertReaderEdition(edition: ReaderEdition): Promise<void> {
  const { getMagazineWriteStore } = await import('./write-store');
  const stamped: ReaderEdition & { schemaVersion: number } = {
    ...edition,
    schemaVersion: CURRENT_READER_SCHEMA_VERSION,
  };
  await getMagazineWriteStore().upsertReaderEdition(stamped);
}

export async function syncReaderEditionCoverFromIssue(editionId: string): Promise<ReaderEdition | null> {
  const { getMagazineReadStore } = await import('./read-store');
  const edition = await getMagazineReadStore().getReaderEditionById(editionId);
  if (!edition) return null;

  const issues = await getMagazineReadStore().getMagazineIssues();
  const matchingIssue = issues.find((issue) => editionRecordsMatch(issue, edition)) ?? null;
  const issueCover = matchingIssue ? sanitizeImageUrl(matchingIssue.coverImage) || '' : '';
  if (!issueCover || issueCover === edition.coverImage) return edition;

  const synced: ReaderEdition = {
    ...edition,
    coverImage: issueCover,
    pages: (edition.pages || []).map((page) =>
      page.template === 'cover'
        ? {
            ...page,
            content: {
              ...page.content,
              imageUrl: issueCover,
              imageUrls: issueCover ? [issueCover] : page.content.imageUrls || [],
            },
          }
        : page,
    ),
  };

  await upsertReaderEdition(synced);
  return synced;
}

export async function syncReaderEditionsForIssue(issueId: string): Promise<number> {
  const { getMagazineReadStore } = await import('./read-store');
  const issueRaw = await getMagazineReadStore().getMagazineIssue(issueId);
  if (!issueRaw) return 0;

  const issue = {
    ...(issueRaw || {}),
    id: String((issueRaw as any)?.id ?? issueId),
  } as { title?: string; coverImage?: string; publishDate?: string };
  const issueCover = sanitizeImageUrl(issue.coverImage) || '';
  if (!issueCover) return 0;

  const editions = await listReaderEditions(100);
  const matches = editions.filter((edition) => editionRecordsMatch(issue, edition));
  if (matches.length === 0) return 0;

  let syncedCount = 0;
  for (const edition of matches) {
    if (edition.coverImage === issueCover) continue;
    await upsertReaderEdition({
      ...edition,
      coverImage: issueCover,
      pages: (edition.pages || []).map((page) =>
        page.template === 'cover'
          ? {
              ...page,
              content: {
                ...page.content,
                imageUrl: issueCover,
                imageUrls: issueCover ? [issueCover] : page.content.imageUrls || [],
              },
            }
          : page,
      ),
    });
    syncedCount += 1;
  }
  return syncedCount;
}

export async function deleteReaderEdition(id: string): Promise<void> {
  const { getMagazineWriteStore } = await import('./write-store');
  await getMagazineWriteStore().deleteReaderEdition(id);
}
