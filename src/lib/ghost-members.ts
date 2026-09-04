/**
 * Pure (non-server-action) helpers for interpreting Ghost member state.
 *
 * This module deliberately does NOT carry a `'use server'` directive so it can
 * export synchronous, dependency-free functions. Anything with `'use server'`
 * may only export async functions (a Next.js build rule), which is why
 * `isPaidGhostMember` lives here rather than in `ghost-admin.ts`.
 */
export type GhostMemberLike = { status?: string } | null | undefined;

/**
 * Determine paid-state from a Ghost member object.
 *
 * Ghost members expose a `status` of 'free' | 'paid' | 'comped'. We treat
 * 'paid' and 'comped' as non-free (premium access). The flag defaults to false
 * when the member cannot be resolved so a missing/broken Ghost lookup never
 * accidentally grants premium.
 */
export function isPaidGhostMember(member: GhostMemberLike): boolean {
  if (!member) return false;
  const status = String(member.status || '').toLowerCase();
  return status === 'paid' || status === 'comped';
}
