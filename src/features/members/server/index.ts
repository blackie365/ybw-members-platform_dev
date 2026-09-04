import { PgMemberStore } from './member-store';

/**
 * Member store selector.
 *
 * Currently returns the Postgres-backed store unconditionally (PG is the
 * migration target that replaces the Firestore `newMemberCollection`
 * pseudo-DB). Individual methods return null/[] when Postgres isn't configured
 * (mirroring the magazine read-store behaviour).
 */
export function getMemberStore() {
  return new PgMemberStore();
}
