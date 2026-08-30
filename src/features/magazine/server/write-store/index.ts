import { MagazineWriteStore } from './interface';
import { FirestoreMagazineWriteStore } from './firestore-write-store';
import { PgMagazineWriteStore } from './pg-write-store';
import { CompositeMagazineWriteStore } from './composite-write-store';

/**
 * Storage-engine selector for the magazine write layer (Phase 5).
 *
 * Env-driven, mirroring the read-store selector:
 *   - (unset) or MAGAZINE_STORE=firestore -> FirestoreMagazineWriteStore (default; unchanged)
 *   - MAGAZINE_STORE=pg                    -> CompositeMagazineWriteStore(Pg primary +
 *                                             Firestore mirror). Writes land in Postgres
 *                                             (public reader source) while Firestore remains
 *                                             the admin-builder source during transition.
 *
 * Defaulting to `firestore` means prod keeps current behaviour until the Phase 5
 * cutover flips MAGAZINE_STORE=pg — no call-site change required.
 */
export function getMagazineWriteStore(): MagazineWriteStore {
  const engine = (process.env.MAGAZINE_STORE || 'firestore').toLowerCase();
  switch (engine) {
    case 'pg':
    case 'postgres':
      return new CompositeMagazineWriteStore(new PgMagazineWriteStore());
    case 'firestore':
    default:
      return new FirestoreMagazineWriteStore();
  }
}

export type { MagazineWriteStore } from './interface';
export type { IdmlDraftRecord } from './interface';
