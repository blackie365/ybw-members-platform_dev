/**
 * YBW social card renderer.
 *
 * Pure rendering + Ghost Content API helpers, shared by:
 *   - scripts/social-card-preview.ts   (local dry-run previews)
 *   - src/app/api/social/card/...      (public PNG endpoint the Graph API fetches)
 *   - src/app/api/cron/social-queue    (daily queueing job)
 *
 * Sharp renders inline SVG over a flat canvas, so no headless browser is needed.
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------- brand tokens

const INK = '#050505';
const RED = '#a3413a';
const PAPER = '#FAF9F6';
const GOLD = '#c9956a';
const MUTED = '#71717A';

const SERIF = 'Playfair Display, Times New Roman, Times, serif';
const MONO = "'Space Mono', 'Courier New', monospace";
const SANS = 'Inter, Helvetica, Arial, sans-serif';

const SITE = 'yorkshirebusinesswoman.co.uk';
const MASTHEAD = 'YORKSHIRE BUSINESSWOMAN';
const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'logo-masthead.png');

// ------------------------------------------------------------------- utilities

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clean(value: string | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

interface TextOpts {
  family?: string;
  weight?: number | string;
  anchor?: 'start' | 'middle' | 'end';
  spacing?: number;
  style?: string;
  opacity?: number;
}

function text(
  x: number,
  y: number,
  size: number,
  fill: string,
  value: string,
  opts: TextOpts = {},
): string {
  const parts = [
    `x="${x}"`,
    `y="${y}"`,
    `font-size="${size}"`,
    `fill="${fill}"`,
    `font-family="${esc(opts.family || SANS)}"`,
  ];
  if (opts.weight) parts.push(`font-weight="${opts.weight}"`);
  if (opts.anchor) parts.push(`text-anchor="${opts.anchor}"`);
  if (opts.spacing) parts.push(`letter-spacing="${opts.spacing}"`);
  if (opts.style) parts.push(`font-style="${opts.style}"`);
  if (opts.opacity !== undefined) parts.push(`opacity="${opts.opacity}"`);
  return `<text ${parts.join(' ')}>${esc(value)}</text>`;
}

function rule(x1: number, y1: number, x2: number, y2: number, stroke: string, width = 1, opacity = 1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" />`;
}

function wrap(textValue: string, maxChars: number): string[] {
  const words = clean(textValue).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Shrink the font size until the wrapped text fits within maxLines. */
function fitLines(
  value: string,
  width: number,
  maxLines: number,
  maxSize: number,
  minSize: number,
  factor = 0.5,
): { lines: string[]; size: number } {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const maxChars = Math.max(8, Math.floor(width / (size * factor)));
    const lines = wrap(value, maxChars);
    if (lines.length <= maxLines) return { lines, size };
  }
  const maxChars = Math.max(8, Math.floor(width / (minSize * factor)));
  const lines = wrap(value, maxChars);
  return { lines: lines.slice(0, maxLines), size: minSize };
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// --------------------------------------------------------------- ghost content

export interface GhostPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  custom_excerpt?: string;
  plaintext?: string;
  feature_image?: string;
  published_at?: string;
  url?: string;
  tags?: { name?: string; slug?: string }[];
  primary_author?: { name?: string };
  authors?: { name?: string }[];
}

function ghostBase(): { base: string; key: string } {
  const base = (process.env.NEXT_PUBLIC_GHOST_API_URL || process.env.GHOST_API_URL || '').replace(/\/$/, '');
  const key = process.env.GHOST_CONTENT_API_KEY || process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || '';
  if (!base || !key) {
    throw new Error('Missing NEXT_PUBLIC_GHOST_API_URL or GHOST_CONTENT_API_KEY');
  }
  return { base, key };
}

function postUrl(base: string, key: string, suffix = ''): string {
  const url = new URL(`${base}/ghost/api/content/posts/${suffix}`);
  url.searchParams.set('key', key);
  url.searchParams.set('include', 'tags,authors');
  url.searchParams.set('formats', 'plaintext');
  return url.toString();
}

async function ghostGet(url: string): Promise<GhostPost[]> {
  const res = await fetch(url, { headers: { 'Accept-Version': 'v5.0' } });
  if (!res.ok) {
    throw new Error(`Ghost Content API responded ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { posts?: GhostPost[] };
  return data.posts || [];
}

export async function fetchRecentPosts(limit: number): Promise<GhostPost[]> {
  const { base, key } = ghostBase();
  const url = new URL(postUrl(base, key));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('order', 'published_at desc');
  return ghostGet(url.toString());
}

export async function fetchPostBySlug(slug: string): Promise<GhostPost | null> {
  const { base, key } = ghostBase();
  const posts = await ghostGet(postUrl(base, key, `slug/${encodeURIComponent(slug)}/`));
  return posts[0] || null;
}

async function fetchImage(url: string | undefined, width: number, height: number): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf).resize(width, height, { fit: 'cover', position: 'attention' }).png().toBuffer();
  } catch {
    return null;
  }
}

async function loadLogo(targetWidth: number): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const meta = await sharp(LOGO_PATH).metadata();
    const height = Math.round(targetWidth * ((meta.height || 1) / (meta.width || 1)));
    const data = await sharp(LOGO_PATH)
      .resize(targetWidth, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return { data, width: targetWidth, height };
  } catch {
    return null;
  }
}

function postMeta(post: GhostPost) {
  const kicker = clean(post.tags?.[0]?.name).toUpperCase() || 'FEATURE';
  const author = clean(
    post.primary_author?.name || post.authors?.[0]?.name || 'Yorkshire Businesswoman',
  );
  const excerpt = clean(post.custom_excerpt || post.excerpt || post.plaintext).slice(0, 240);
  const date = formatDate(post.published_at);
  return { kicker, author, excerpt, date };
}

// ------------------------------------------------------------------ card layout

export interface CardLayout {
  key: string;
  W: number;
  H: number;
  M: number;
  logoWidth: number;
  logoTop: number;
  ruleOffset: number;
  kickerOffset: number;
  bandGap: number;
  bandHeight: number;
  headlineGap: number;
  headlineMax: number;
  headlineMaxLines: number;
  standfirstGap: number;
  standfirstMax: number;
  footerRuleY: number;
  footerTextY: number;
}

export const PORTRAIT: CardLayout = {
  key: 'portrait-1080x1350',
  W: 1080,
  H: 1350,
  M: 80,
  logoWidth: 520,
  logoTop: 58,
  ruleOffset: 26,
  kickerOffset: 56,
  bandGap: 30,
  bandHeight: 500,
  headlineGap: 92,
  headlineMax: 58,
  headlineMaxLines: 3,
  standfirstGap: 76,
  standfirstMax: 27,
  footerRuleY: 1256,
  footerTextY: 1300,
};

export const WHATSAPP: CardLayout = {
  key: 'whatsapp-1080x1920',
  W: 1080,
  H: 1920,
  M: 80,
  logoWidth: 620,
  logoTop: 300,
  ruleOffset: 28,
  kickerOffset: 60,
  bandGap: 34,
  bandHeight: 640,
  headlineGap: 100,
  headlineMax: 66,
  headlineMaxLines: 3,
  standfirstGap: 86,
  standfirstMax: 30,
  footerRuleY: 1680,
  footerTextY: 1720,
};

export const LAYOUTS: Record<string, CardLayout> = {
  portrait: PORTRAIT,
  whatsapp: WHATSAPP,
};

export function isFormat(value: string): value is 'portrait' | 'whatsapp' {
  return value in LAYOUTS;
}

// ------------------------------------------------------------------- the card

export async function renderCard(post: GhostPost, L: CardLayout): Promise<Buffer> {
  const { W, H, M } = L;
  const { kicker, author, excerpt, date } = postMeta(post);
  const bits: string[] = [];
  const composite: sharp.OverlayOptions[] = [];

  // Masthead: the real YBW logo, falling back to set type if the file is missing.
  const logo = await loadLogo(L.logoWidth);
  let mastheadBottom: number;
  if (logo) {
    composite.push({ input: logo.data, top: L.logoTop, left: Math.round((W - logo.width) / 2) });
    mastheadBottom = L.logoTop + logo.height;
  } else {
    bits.push(text(W / 2, L.logoTop + 34, 26, INK, MASTHEAD, { family: MONO, anchor: 'middle', spacing: 5 }));
    mastheadBottom = L.logoTop + 46;
  }

  // Broadsheet double rule: ink over a finer gold.
  const ruleY = mastheadBottom + L.ruleOffset;
  bits.push(rule(M, ruleY, W - M, ruleY, INK, 1.5, 0.75));
  bits.push(rule(M, ruleY + 5, W - M, ruleY + 5, GOLD, 1, 0.9));

  // Kicker in brick red, flanked by short gold rules.
  const kickerY = ruleY + L.kickerOffset;
  bits.push(text(W / 2, kickerY, 20, RED, kicker, { family: MONO, anchor: 'middle', spacing: 3 }));
  bits.push(rule(W / 2 - 210, kickerY + 10, W / 2 - 34, kickerY + 10, GOLD, 1, 0.7));
  bits.push(rule(W / 2 + 34, kickerY + 10, W / 2 + 210, kickerY + 10, GOLD, 1, 0.7));

  // Hero band.
  const bandTop = kickerY + L.bandGap;
  const hero = await fetchImage(post.feature_image, W, L.bandHeight);
  if (hero) {
    composite.push({ input: hero, top: bandTop, left: 0 });
    // Quiet gold monogram over the image, bottom right.
    bits.push(
      text(W - M, bandTop + L.bandHeight - 30, 38, GOLD, 'YBW', {
        family: SERIF,
        anchor: 'end',
        spacing: 4,
        opacity: 0.9,
      }),
    );
  } else {
    composite.push({
      input: { create: { width: W, height: L.bandHeight, channels: 4, background: hexToRgb(INK) } },
      top: bandTop,
      left: 0,
    });
    bits.push(
      text(W / 2, bandTop + L.bandHeight / 2 + 16, 46, GOLD, 'YBW', {
        family: SERIF,
        anchor: 'middle',
        spacing: 8,
        opacity: 0.9,
      }),
    );
  }

  // Headline.
  const headline = fitLines(post.title, W - M * 2, L.headlineMaxLines, L.headlineMax, 38);
  const lineHeight = Math.round(headline.size * 1.16);
  let y = bandTop + L.bandHeight + L.headlineGap;
  for (const line of headline.lines) {
    bits.push(text(W / 2, y, headline.size, INK, line, { family: SERIF, anchor: 'middle', weight: 600 }));
    y += lineHeight;
  }
  const headlineEnd = y - lineHeight;

  // Decorative quote glyph behind the standfirst.
  if (excerpt) {
    bits.push(text(M - 14, headlineEnd + L.standfirstGap + 2, 190, RED, '\u201C', { family: SERIF, opacity: 0.12 }));

    const standfirst = fitLines(excerpt, W - M * 3, 2, L.standfirstMax, 21);
    let sy = headlineEnd + L.standfirstGap;
    for (const line of standfirst.lines) {
      bits.push(text(W / 2, sy, standfirst.size, MUTED, line, { family: SERIF, anchor: 'middle', style: 'italic' }));
      sy += Math.round(standfirst.size * 1.42);
    }
    y = sy + 22;
  }

  // Byline.
  bits.push(text(W / 2, y + 18, 21, MUTED, `${author} · ${date}`, { family: MONO, anchor: 'middle' }));

  // Footer.
  bits.push(rule(W / 2 - 45, L.footerRuleY, W / 2 + 45, L.footerRuleY, GOLD, 2));
  bits.push(text(W / 2, L.footerTextY, 20, MUTED, SITE, { family: MONO, anchor: 'middle', spacing: 1 }));

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bits.join('')}</svg>`;
  composite.push({ input: Buffer.from(overlay), top: 0, left: 0 });

  return sharp({ create: { width: W, height: H, channels: 4, background: hexToRgb(PAPER) } })
    .composite(composite)
    .png()
    .toBuffer();
}

/** Render every configured format for a post, keyed by layout key. */
export async function renderCardFormats(post: GhostPost): Promise<Record<string, Buffer>> {
  const out: Record<string, Buffer> = {};
  for (const [format, layout] of Object.entries(LAYOUTS)) {
    out[format] = await renderCard(post, layout);
  }
  return out;
}

/** True when the renderer has a usable logo asset and Ghost credentials. */
export function rendererReady(): boolean {
  try {
    fs.accessSync(LOGO_PATH, fs.constants.R_OK);
  } catch {
    return false;
  }
  return Boolean(
    (process.env.NEXT_PUBLIC_GHOST_API_URL || process.env.GHOST_API_URL) &&
      (process.env.GHOST_CONTENT_API_KEY || process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY),
  );
}
