import { MagazineReadStore } from './interface';
import { PgMagazineReadStore } from './pg-store';

/**
 * Storage-engine selector for the magazine read layer.
 *
 * Postgres-only (Phase 5 complete): all magazine reads resolve from Postgres.
 * Firestore is no longer used for magazine data.
 */
export function getMagazineReadStore(): MagazineReadStore {
  return new PgMagazineReadStore();
}

export type { MagazineReadStore } from './interface';
