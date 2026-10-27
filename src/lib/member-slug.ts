import slugify from '@sindresorhus/slugify';

/**
 * Build a stable, collision-resistant member slug.
 *
 * The slug previously fell back to the email local-part when a member had no
 * name, so everyone signing up from a shared inbox (hello@…, info@…) ended up
 * with the same slug and profile lookups became ambiguous (one member's card
 * could open a different person). When there is no name we append a short,
 * stable suffix derived from the Clerk id so the slug is unique per member.
 *
 * Callers should still keep an existing slug when one is already stored, so
 * member URLs do not change under people's feet.
 */
export function buildMemberSlug(opts: {
  fullName?: string | null;
  email?: string | null;
  clerkId?: string | null;
}): string {
  const name = (opts.fullName || '').trim();
  const emailLocal = (opts.email || '').split('@')[0] || '';
  const base = slugify(name || emailLocal || 'member') || 'member';

  // Real names are distinctive enough on their own; only the shared-inbox
  // fallback needs disambiguating.
  if (name) return base;

  const idPart = (opts.clerkId || '').replace(/^user_/, '').toLowerCase();
  const suffix = idPart ? idPart.slice(-6) : Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
