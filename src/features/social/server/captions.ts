import type { GhostPost } from './card-renderer';

/**
 * Captions for the auto-post queue.
 *
 * Deliberately editorial rather than salesy — the failure mode of automated
 * brand posting is that it reads like a bot, so each caption leads with the
 * headline and a short standfirst and keeps the hashtags to a minimum.
 */

const BRAND_TAGS = ['#YorkshireBusinesswoman', '#YorkshireBusiness', '#Yorkshire'];
const MAX_IG = 2200;

export interface Captions {
  fb: string;
  ig: string;
}

function clean(value: string | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function excerptOf(post: GhostPost, limit: number): string {
  const text = clean(post.custom_excerpt || post.excerpt || post.plaintext);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  // Prefer cutting on a word boundary; only fall back to a hard cut when the
  // last space is so early it would throw away most of the excerpt.
  const trimmed = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s.,;:!?]+$/, '')}…`;
}

function toHashtag(name: string): string {
  const stripped = clean(name).replace(/[^A-Za-z0-9]/g, '');
  return stripped ? `#${stripped}` : '';
}

export function buildCaptions(post: GhostPost): Captions {
  const title = clean(post.title);
  const link = clean(post.url) || 'https://yorkshirebusinesswoman.co.uk';

  const topicTags = (post.tags || [])
    .map((t) => toHashtag(t?.name || ''))
    .filter((t) => t && !BRAND_TAGS.includes(t))
    .slice(0, 2);

  const hashtags = Array.from(new Set([...topicTags, ...BRAND_TAGS])).slice(0, 5).join(' ');

  const fb = [title, excerptOf(post, 220), link].filter(Boolean).join('\n\n');

  const ig = [
    title,
    excerptOf(post, 200),
    'Read the full story — link in bio.',
    hashtags,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_IG);

  return { fb, ig };
}
