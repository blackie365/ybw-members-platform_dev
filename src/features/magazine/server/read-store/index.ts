import { MagazineReadStore } from './interface';
import { FirestoreMagazineReadStore } from './firestore-store';
import { PgMagazineReadStore } from './pg-store';
import { CompositeMagazineReadStore } from './composite-store';

/**
 * Storage-engine selector for the magazine read layer.
 *
 * Env-driven:
 *   - (unset) or MAGAZINE_STORE=firestore  -> FirestoreMagazineReadStore (default)
 *   - MAGAZINE_STORE=pg                     -> CompositeMagazineReadStore(Pg primary,
 *                                              Firestore fallback). Reads resolve from
 *                                              Postgres first and fall back to Firestore
 *                                              on any miss/error, so the reader never breaks
 *                                              before the full backfill is complete.
 *
 * Defaulting to `firestore` means prod keeps current behaviour until Phase 4
 * cutover flips MAGAZINE_STORE=pg — no call-site change required.
 */
export function getMagazineReadStore(): MagazineReadStore {
  const engine = (process.env.MAGAZINE_STORE || 'firestore').toLowerCase();
  switch (engine) {
    case 'pg':
    case 'postgres':
      return new CompositeMagazineReadStore(new PgMagazineReadStore());
    case 'firestore':
    default:
      return new FirestoreMagazineReadStore();
  }
}

export type { MagazineReadStore } from './interface';
