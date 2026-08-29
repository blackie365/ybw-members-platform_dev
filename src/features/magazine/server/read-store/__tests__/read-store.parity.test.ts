import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import { FirestoreMagazineReadStore } from '@/features/magazine/server/read-store/firestore-store';

import * as magazineServiceServer from '@/lib/magazine-service-server';
import * as simpleReader from '@/features/magazine/server/simple-reader';

/**
 * Phase 2 parity guard — the magazine read store seam must be a pure
 * delegation over the existing Firestore read functions (zero behaviour
 * change). Each store method must route through exactly the function it wraps,
 * so swapping in a Postgres store later cannot silently change what readers
 * see.
 */
describe('FirestoreMagazineReadStore — pure delegation parity', () => {
  const originalEnv = process.env.MAGAZINE_STORE;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.MAGAZINE_STORE;
    else process.env.MAGAZINE_STORE = originalEnv;
    vi.restoreAllMocks();
  });

  it('getMagazineReadStore() defaults to the Firestore store when MAGAZINE_STORE is unset', () => {
    delete process.env.MAGAZINE_STORE;
    expect(getMagazineReadStore()).toBeInstanceOf(FirestoreMagazineReadStore);
  });

  it('getMagazineReadStore() uses the Firestore store when MAGAZINE_STORE=firestore', () => {
    process.env.MAGAZINE_STORE = 'firestore';
    expect(getMagazineReadStore()).toBeInstanceOf(FirestoreMagazineReadStore);
  });

  it('getMagazineReadStore() falls back to Firestore store when MAGAZINE_STORE=pg (Pg store not yet landed)', () => {
    process.env.MAGAZINE_STORE = 'pg';
    expect(getMagazineReadStore()).toBeInstanceOf(FirestoreMagazineReadStore);
  });

  it('getMagazineIssues() delegates to getMagazineIssuesServer()', async () => {
    const spy = vi.spyOn(magazineServiceServer, 'getMagazineIssuesServer').mockResolvedValue([] as any);
    const result = await new FirestoreMagazineReadStore().getMagazineIssues();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('getMagazineIssue() delegates to getMagazineIssueServer() with the same id', async () => {
    const spy = vi.spyOn(magazineServiceServer, 'getMagazineIssueServer').mockResolvedValue(null);
    const result = await new FirestoreMagazineReadStore().getMagazineIssue('abc');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('abc');
    expect(result).toBeNull();
  });

  it('getLatestIssue() delegates to getLatestIssueServer()', async () => {
    const spy = vi.spyOn(magazineServiceServer, 'getLatestIssueServer').mockResolvedValue(null);
    const result = await new FirestoreMagazineReadStore().getLatestIssue();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it('getMagazinePages() delegates to getMagazinePagesServer() with the same id', async () => {
    const spy = vi.spyOn(magazineServiceServer, 'getMagazinePagesServer').mockResolvedValue([] as any);
    const result = await new FirestoreMagazineReadStore().getMagazinePages('xyz');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('xyz');
    expect(result).toEqual([]);
  });

  it('getReaderEditionByIssueId() delegates to getReaderEditionByIssueId() from simple-reader', async () => {
    const spy = vi.spyOn(simpleReader, 'getReaderEditionByIssueId').mockResolvedValue(null);
    const result = await new FirestoreMagazineReadStore().getReaderEditionByIssueId('iss1');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('iss1');
    expect(result).toBeNull();
  });

  it('getReaderEditionById() delegates to simple-reader.getReaderEditionById()', async () => {
    const spy = vi.spyOn(simpleReader, 'getReaderEditionById').mockResolvedValue(null);
    const result = await new FirestoreMagazineReadStore().getReaderEditionById('ed1');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('ed1');
    expect(result).toBeNull();
  });

  it('listReaderEditions() delegates to simple-reader.listReaderEditions() with the same limit', async () => {
    const spy = vi.spyOn(simpleReader, 'listReaderEditions').mockResolvedValue([] as any);
    const result = await new FirestoreMagazineReadStore().listReaderEditions(7);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(7);
    expect(result).toEqual([]);
  });

  it('listReaderEditions() passes undefined limit through unchanged', async () => {
    const spy = vi.spyOn(simpleReader, 'listReaderEditions').mockResolvedValue([] as any);
    await new FirestoreMagazineReadStore().listReaderEditions();
    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('getReaderEditionBySlug() delegates to simple-reader.getReaderEditionBySlug()', async () => {
    const spy = vi.spyOn(simpleReader, 'getReaderEditionBySlug').mockResolvedValue(null);
    const result = await new FirestoreMagazineReadStore().getReaderEditionBySlug('my-edition');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('my-edition');
    expect(result).toBeNull();
  });
});
