import { MagazineReadStore } from './interface';
import { FirestoreMagazineReadStore } from './firestore-store';

/**
 * Storage-engine selector for the magazine read layer.
 *
 * Env-driven:
 *   - (unset) or MAGAZINE_STORE=firestore  -> FirestoreMagazineReadStore (current default)
 *   - MAGAZINE_STORE=pg                     -> Postgres implementation (added in a later phase)
 *
 * Defaulting to `firestore` means this phase ships with zero runtime change:
 * call sites can start consuming the seam now, and Postgres is switched in
 * later by flipping the env var — no code change at the call sites.
 */
export function getMagazineReadStore(): MagazineReadStore {
  const engine = (process.env.MAGAZINE_STORE || 'firestore').toLowerCase();
  switch (engine) {
    case 'pg':
    case 'postgres': {
      // Postgres impl lands in a later phase. Until then, fall back to Firestore
      // so an accidentally-set MAGAZINE_STORE=pg never breaks the reader.
      return new FirestoreMagazineReadStore();
    }
    case 'firestore':
    default:
      return new FirestoreMagazineReadStore();
  }
}

export type { MagazineReadStore } from './interface';
