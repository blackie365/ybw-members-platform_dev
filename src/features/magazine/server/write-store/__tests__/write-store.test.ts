import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgMagazineWriteStore } from '../pg-write-store';
import { CompositeMagazineWriteStore } from '../composite-write-store';
import type { MagazineWriteStore } from '../interface';

vi.mock('../../read-store/pg-client', () => ({ getMagazinePgPool: vi.fn() }));
vi.mock('../../read-store/pg-schema', () => ({
  initMagazinePgSchema: vi.fn().mockResolvedValue(undefined),
  toPgDate: (d: unknown) => (d ? String(d) : null),
}));

import { getMagazinePgPool } from '../../read-store/pg-client';

const fakePool = {
  query: vi.fn(),
  connect: vi.fn(),
};

function fakeClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getMagazinePgPool as any).mockReturnValue(fakePool);
  fakePool.connect.mockReturnValue(fakeClient());
});

describe('PgMagazineWriteStore — issues', () => {
  it('createIssue inserts the full issue as JSONB plus publish_date helper', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    const id = await new PgMagazineWriteStore().createIssue({ id: 'abc', title: 'T', publishDate: '2026-01-01' });
    expect(id).toBe('abc');
    expect(fakePool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO magazine_issues'),
      ['abc', JSON.stringify({ id: 'abc', title: 'T', publishDate: '2026-01-01' }), '2026-01-01'],
    );
  });

  it('updateIssue merges incoming patch over the existing data row', async () => {
    fakePool.query
      .mockResolvedValueOnce({ rows: [{ data: { id: 'abc', title: 'Old' } }] })
      .mockResolvedValueOnce({ rows: [] });
    await new PgMagazineWriteStore().updateIssue('abc', { title: 'New' });
    const [, payload] = fakePool.query.mock.calls[1];
    const parsed = JSON.parse(payload[1]);
    expect(parsed).toMatchObject({ id: 'abc', title: 'New' });
  });

  it('setLatestIssue clears isLatest on others inside a transaction', async () => {
    const client = fakeClient();
    client.query.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT data FROM magazine_issues')) {
        return Promise.resolve({ rows: [{ data: { id: 'a', isLatest: true } }, { data: { id: 'b' } }] });
      }
      return Promise.resolve({ rows: [] });
    });
    fakePool.connect.mockReturnValue(client);
    await new PgMagazineWriteStore().setLatestIssue('b');
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    // a was cleared (UPDATE with id 'a' and isLatest:false in the payload)
    const updateCall = client.query.mock.calls.find(
      (c: any[]) => String(c[0]).includes('UPDATE magazine_issues') && c[1]?.[0] === 'a',
    );
    expect(updateCall).toBeTruthy();
    expect(JSON.parse(updateCall![1][1]).isLatest).toBe(false);
  });
});

describe('PgMagazineWriteStore — reader editions & pages', () => {
  it('upsertReaderEdition writes data + data_light and helper columns', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    await new PgMagazineWriteStore().upsertReaderEdition({ id: 'ed', slug: 's', issueId: 'iss' } as any);
    expect(fakePool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO magazine_reader_editions'),
      ['ed', JSON.stringify({ id: 'ed', slug: 's', issueId: 'iss' }), 's', 'iss', null],
    );
  });

  it('upsertPage inserts page keyed by numeric id', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    await new PgMagazineWriteStore().upsertPage('iss', { id: 7, type: 'feature-full' } as any);
    expect(fakePool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO magazine_pages'),
      ['iss', '7', 7, JSON.stringify({ id: 7, type: 'feature-full' })],
    );
  });

  it('persistStoryLibrary projects the library onto the issue row in a txn', async () => {
    const client = fakeClient();
    client.query.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT data FROM magazine_issues')) {
        return Promise.resolve({ rows: [{ data: { id: 'iss', title: 'Old' } }] });
      }
      return Promise.resolve({ rows: [] });
    });
    fakePool.connect.mockReturnValue(client);
    await new PgMagazineWriteStore().persistStoryLibrary('iss', [
      { id: 's1', title: 'A' } as any,
    ]);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    const issueUpsert = client.query.mock.calls.find((c: any[]) =>
      String(c[0]).startsWith('INSERT INTO magazine_issues'),
    );
    expect(issueUpsert).toBeTruthy();
    const parsed = JSON.parse(issueUpsert![1][1]);
    expect(parsed.storyLibraryCount).toBe(1);
    expect(parsed.storyLibrary[0]).toMatchObject({ id: 's1', title: 'A' });
  });
});

describe('CompositeMagazineWriteStore — PG primary + Firestore mirror', () => {
  const makeStub = (overrides: Partial<MagazineWriteStore>): MagazineWriteStore => {
    const base: MagazineWriteStore = {
      createIssue: vi.fn().mockResolvedValue('id'),
      updateIssue: vi.fn().mockResolvedValue(undefined),
      deleteIssue: vi.fn().mockResolvedValue(undefined),
      setLatestIssue: vi.fn().mockResolvedValue(undefined),
      setFeaturedFlipbookIssue: vi.fn().mockResolvedValue(undefined),
      upsertPage: vi.fn().mockResolvedValue(undefined),
      addPage: vi.fn().mockResolvedValue('pageid'),
      deletePage: vi.fn().mockResolvedValue(undefined),
      bulkUpsertPages: vi.fn().mockResolvedValue(undefined),
      bulkDeletePages: vi.fn().mockResolvedValue(undefined),
      upsertReaderEdition: vi.fn().mockResolvedValue(undefined),
      deleteReaderEdition: vi.fn().mockResolvedValue(undefined),
      persistStoryLibrary: vi.fn().mockResolvedValue(undefined),
      saveIdmlDraft: vi.fn().mockResolvedValue(undefined),
      deleteIdmlDraft: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    return base;
  };

  it('writes to PG primary and mirrors to Firestore', async () => {
    const pg = makeStub({ upsertReaderEdition: vi.fn().mockResolvedValue(undefined) });
    const fs = makeStub({ upsertReaderEdition: vi.fn().mockResolvedValue(undefined) });
    const store = new CompositeMagazineWriteStore(pg, fs);
    await store.upsertReaderEdition({ id: 'ed' } as any);
    expect(pg.upsertReaderEdition).toHaveBeenCalledTimes(1);
    expect(fs.upsertReaderEdition).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the Firestore mirror fails', async () => {
    const pg = makeStub({ upsertReaderEdition: vi.fn().mockResolvedValue(undefined) });
    const fs = makeStub({ upsertReaderEdition: vi.fn().mockRejectedValue(new Error('fs down')) });
    const store = new CompositeMagazineWriteStore(pg, fs);
    await expect(store.upsertReaderEdition({ id: 'ed' } as any)).resolves.toBeUndefined();
  });

  it('createIssue returns the PG id and mirrors the same id for Firestore', async () => {
    const pg = makeStub({ createIssue: vi.fn().mockResolvedValue('abc') });
    const fs = makeStub({ createIssue: vi.fn().mockResolvedValue('abc') });
    const store = new CompositeMagazineWriteStore(pg, fs);
    await expect(store.createIssue({ title: 'T' } as any)).resolves.toBe('abc');
    expect(pg.createIssue).toHaveBeenCalledWith({ title: 'T' });
    expect(fs.createIssue).toHaveBeenCalledWith({ title: 'T', id: 'abc' });
  });
});
