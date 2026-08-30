import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgMagazineReadStore } from '../pg-store';
import { CompositeMagazineReadStore } from '../composite-store';
import type { MagazineReadStore } from '../interface';

vi.mock('../pg-client', () => ({ getMagazinePgPool: vi.fn() }));
vi.mock('../pg-schema', () => ({ initMagazinePgSchema: vi.fn().mockResolvedValue(undefined) }));

import { getMagazinePgPool } from '../pg-client';

const fakePool = {
  query: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (getMagazinePgPool as any).mockReturnValue(fakePool);
});

describe('PgMagazineReadStore — simple JSONB lookups', () => {
  it('getMagazineIssues maps data rows ordered by publish_date desc', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ data: { id: 'a' } }, { data: { id: 'b' } }] });
    const out = await new PgMagazineReadStore().getMagazineIssues();
    expect(fakePool.query).toHaveBeenCalledWith(
      'SELECT data FROM magazine_issues ORDER BY publish_date DESC NULLS LAST, id DESC',
    );
    expect(out).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('getMagazineIssue returns row data or null', async () => {
    fakePool.query.mockResolvedValueOnce({ rows: [{ data: { id: 'x', title: 'T' } }] });
    expect(await new PgMagazineReadStore().getMagazineIssue('x')).toEqual({ id: 'x', title: 'T' });

    fakePool.query.mockResolvedValueOnce({ rows: [] });
    expect(await new PgMagazineReadStore().getMagazineIssue('missing')).toBeNull();
  });

  it('getLatestIssue returns first ordered row or null', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    expect(await new PgMagazineReadStore().getLatestIssue()).toBeNull();
  });

  it('getMagazinePages orders by sort_key asc, selects id+data, and injects docId', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ id: 1, data: { id: 1 } }, { id: 2, data: { id: 2 } }] });
    const out = await new PgMagazineReadStore().getMagazinePages('iss');
    expect(fakePool.query).toHaveBeenCalledWith(
      'SELECT id, data FROM magazine_pages WHERE issue_id = $1 ORDER BY sort_key ASC, id ASC',
      ['iss'],
    );
    expect(out).toEqual([{ id: 1, docId: '1' }, { id: 2, docId: '2' }]);
  });

  it('getReaderEditionBySlug queries by slug and returns data', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ data: { slug: 'ed', pages: [] } }] });
    const out = await new PgMagazineReadStore().getReaderEditionBySlug('ed');
    expect(fakePool.query).toHaveBeenCalledWith(
      'SELECT data FROM magazine_reader_editions WHERE slug = $1 LIMIT 1',
      ['ed'],
    );
    expect(out).toEqual({ slug: 'ed', pages: [] });
  });

  it('listReaderEditions passes limit and returns data_light rows (preferring it over data)', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ data_light: { id: '1' }, data: { id: 'X' } }] });
    const out = await new PgMagazineReadStore().listReaderEditions(5);
    expect(fakePool.query).toHaveBeenCalledWith(
      'SELECT data_light, data FROM magazine_reader_editions ORDER BY publish_date DESC NULLS LAST LIMIT $1',
      [5],
    );
    expect(out).toEqual([{ id: '1' }]);
  });

  it('listReaderEditions falls back to data when data_light is null', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ data_light: null, data: { id: 'X' } }] });
    expect(await new PgMagazineReadStore().listReaderEditions()).toEqual([{ id: 'X' }]);
  });

  it('getReaderEditionById returns data_light, falling back to data', async () => {
    fakePool.query.mockResolvedValueOnce({ rows: [{ data_light: { id: 'L' }, data: { id: 'F' } }] });
    expect(await new PgMagazineReadStore().getReaderEditionById('ed')).toEqual({ id: 'L' });

    fakePool.query.mockResolvedValueOnce({ rows: [{ data_light: null, data: { id: 'F' } }] });
    expect(await new PgMagazineReadStore().getReaderEditionById('ed')).toEqual({ id: 'F' });

    fakePool.query.mockResolvedValueOnce({ rows: [] });
    expect(await new PgMagazineReadStore().getReaderEditionById('missing')).toBeNull();
  });

  it('returns [] / null when no pool is configured', async () => {
    (getMagazinePgPool as any).mockReturnValue(null);
    expect(await new PgMagazineReadStore().getMagazineIssues()).toEqual([]);
    expect(await new PgMagazineReadStore().getReaderEditionBySlug('x')).toBeNull();
  });
});

describe('CompositeMagazineReadStore — Firestore fallback on Pg miss/error', () => {
  const makeStub = (overrides: Partial<MagazineReadStore>): MagazineReadStore => {
    const base: MagazineReadStore = {
      getMagazineIssues: vi.fn().mockResolvedValue([]),
      getMagazineIssue: vi.fn().mockResolvedValue(null),
      getLatestIssue: vi.fn().mockResolvedValue(null),
      getMagazinePages: vi.fn().mockResolvedValue([]),
      getReaderEditionByIssueId: vi.fn().mockResolvedValue(null),
      getReaderEditionById: vi.fn().mockResolvedValue(null),
      listReaderEditions: vi.fn().mockResolvedValue([]),
      getReaderEditionBySlug: vi.fn().mockResolvedValue(null),
      getStoryLibrary: vi.fn().mockResolvedValue([]),
      listIdmlDrafts: vi.fn().mockResolvedValue([]),
      getIdmlDraft: vi.fn().mockResolvedValue(null),
      ...overrides,
    };
    return base;
  };

  it('falls back to Firestore when Pg returns empty issues list', async () => {
    const pg = makeStub({ getMagazineIssues: vi.fn().mockResolvedValue([]) });
    const fs = makeStub({ getMagazineIssues: vi.fn().mockResolvedValue([{ id: 'fs' }] as any) });
    const store = new CompositeMagazineReadStore(pg, fs);
    expect(await store.getMagazineIssues()).toEqual([{ id: 'fs' }]);
    expect((fs as any).getMagazineIssues).toHaveBeenCalledTimes(1);
  });

  it('returns Pg data when Pg has issues (no fallback)', async () => {
    const pg = makeStub({ getMagazineIssues: vi.fn().mockResolvedValue([{ id: 'pg' }] as any) });
    const fs = makeStub({ getMagazineIssues: vi.fn().mockResolvedValue([{ id: 'fs' }] as any) });
    const store = new CompositeMagazineReadStore(pg, fs);
    expect(await store.getMagazineIssues()).toEqual([{ id: 'pg' }]);
    expect((fs as any).getMagazineIssues).not.toHaveBeenCalled();
  });

  it('falls back to Firestore when Pg reader edition by issueId is null', async () => {
    const pg = makeStub({ getReaderEditionByIssueId: vi.fn().mockResolvedValue(null) });
    const fs = makeStub({
      getReaderEditionByIssueId: vi.fn().mockResolvedValue({ id: 'ed', pages: [] } as any),
    });
    const store = new CompositeMagazineReadStore(pg, fs);
    expect(await store.getReaderEditionByIssueId('iss')).toEqual({ id: 'ed', pages: [] });
  });

  it('returns Pg edition when Pg finds one (no fallback)', async () => {
    const pg = makeStub({
      getReaderEditionBySlug: vi.fn().mockResolvedValue({ id: 'ed', pages: [] } as any),
    });
    const fs = makeStub({ getReaderEditionBySlug: vi.fn().mockResolvedValue({ id: 'other' } as any) });
    const store = new CompositeMagazineReadStore(pg, fs);
    expect(await store.getReaderEditionBySlug('ed')).toEqual({ id: 'ed', pages: [] });
    expect((fs as any).getReaderEditionBySlug).not.toHaveBeenCalled();
  });

  it('falls back to Firestore when Pg listReaderEditions is empty', async () => {
    const pg = makeStub({ listReaderEditions: vi.fn().mockResolvedValue([]) });
    const fs = makeStub({ listReaderEditions: vi.fn().mockResolvedValue([{ id: 'fs' }] as any) });
    const store = new CompositeMagazineReadStore(pg, fs);
    expect(await store.listReaderEditions(3)).toEqual([{ id: 'fs' }]);
  });
});
