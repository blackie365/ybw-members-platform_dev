import { MagazineWriteStore } from './interface';
import { PgMagazineWriteStore } from './pg-write-store';

/**
 * Storage-engine selector for the magazine write layer.
 *
 * Postgres-only (Phase 5 complete): all magazine writes land in Postgres.
 * Firestore is no longer used for magazine data.
 */
export function getMagazineWriteStore(): MagazineWriteStore {
  return new PgMagazineWriteStore();
}

export type { MagazineWriteStore } from './interface';
export type { IdmlDraftRecord } from './interface';
