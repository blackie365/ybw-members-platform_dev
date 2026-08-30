import { MagazineIssue, MagazinePage } from '@/components/admin/magazine-builder/types';
import { ReaderEdition } from '@/features/magazine/domain/types';
import { MagazineReadStore } from './interface';
import { FirestoreMagazineReadStore } from './firestore-store';

/**
 * Composite read store used when MAGAZINE_STORE=pg.
 *
 * Reads are served from the Postgres store (primary) but fall back to
 * Firestore on ANY miss or error, so a publication that isn't backfilled yet —
 * or a transient PG failure — can never break the reader. `magazine_reader_editions`
 * (explicit resolve) does NOT fall back if PG returns null, because in the
 * Firestore world a "true null" is already the reader's 404 / redirect state;
 * falling back would only matter for the LIST / issue emissions.
 *
 * The `resolve` helper treats a Pg-miss as "fall back" for the high-traffic
 * collection lookups (issues + pages + reader listing + slug), guaranteeing
 * maximal content availability during the migration window.
 */
export class CompositeMagazineReadStore implements MagazineReadStore {
  constructor(
    private readonly primary: MagazineReadStore,
    private readonly fallback: MagazineReadStore = new FirestoreMagazineReadStore(),
  ) {}

  async getMagazineIssues(): Promise<MagazineIssue[]> {
    const fromPg = await this.primary.getMagazineIssues();
    if (fromPg && fromPg.length > 0) return fromPg;
    return this.fallback.getMagazineIssues();
  }

  async getMagazineIssue(issueId: string): Promise<MagazineIssue | null> {
    const fromPg = await this.primary.getMagazineIssue(issueId);
    if (fromPg) return fromPg;
    return this.fallback.getMagazineIssue(issueId);
  }

  async getLatestIssue(): Promise<MagazineIssue | null> {
    const fromPg = await this.primary.getLatestIssue();
    if (fromPg) return fromPg;
    return this.fallback.getLatestIssue();
  }

  async getMagazinePages(issueId: string): Promise<MagazinePage[]> {
    const fromPg = await this.primary.getMagazinePages(issueId);
    if (fromPg && fromPg.length > 0) return fromPg;
    return this.fallback.getMagazinePages(issueId);
  }

  async getReaderEditionByIssueId(issueId: string): Promise<ReaderEdition | null> {
    return (await this.primary.getReaderEditionByIssueId(issueId)) ?? this.fallback.getReaderEditionByIssueId(issueId);
  }

  async getReaderEditionById(id: string): Promise<ReaderEdition | null> {
    return (await this.primary.getReaderEditionById(id)) ?? this.fallback.getReaderEditionById(id);
  }

  async listReaderEditions(limit?: number): Promise<ReaderEdition[]> {
    const fromPg = await this.primary.listReaderEditions(limit);
    if (fromPg && fromPg.length > 0) return fromPg;
    return this.fallback.listReaderEditions(limit);
  }

  async getReaderEditionBySlug(slug: string): Promise<ReaderEdition | null> {
    return (await this.primary.getReaderEditionBySlug(slug)) ?? this.fallback.getReaderEditionBySlug(slug);
  }
}