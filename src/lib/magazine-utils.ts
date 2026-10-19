/**
 * Collapse a duplicated `uploads/` segment.
 *
 * Rows written by the storage migration carry paths like
 * `/uploads/uploads/photo.jpg`, because the object path itself already began
 * with `uploads/` when `/uploads/` was prefixed onto it. Nothing downstream
 * repairs it — the storage backend deliberately refuses to re-prefix, so the
 * URL simply 404s. Collapsing here is idempotent and sits in the one funnel
 * every magazine image passes through on its way to the browser.
 */
const DUPLICATED_UPLOADS_SEGMENT = /^((?:https?:\/\/[^\/]+)?\/uploads\/)(?:uploads\/)+/i;

function stripUploadsPrefixes(value: string): string {
  return value.replace(/^\/+/, '').replace(/^(?:uploads\/)+/i, '');
}

/**
 * Aggressively strip surrounding delimiters that sometimes leak into CMS
 * fields and Story Library records: backticks, quotes, angle brackets,
 * whitespace, curly braces and Markdown link wrappers.
 *
 * Rejects sentinel values like "undefined", "null", "none", "n/a" that
 * String(undefined) etc. accidentally produced in earlier builds.
 *
 * Converts legacy gs:// Firebase storage admin URIs to the equivalent
 * self-hosted `/uploads/...` path. The Firebase/GCS bucket has been retired —
 * every object it held was copied onto the VPS mirroring the bucket layout —
 * so no bucket URL is ever emitted again.
 *
 * Returns '' for anything that cannot be salvaged.
 */
export function normalizeImageUrl(value: unknown): string {
  if (value === undefined || value === null) return '';
  let raw = String(value);
  if (!raw) return '';

  for (let i = 0; i < 12; i += 1) {
    const before = raw;
    raw = raw.trim();
    if (raw.startsWith('`') && raw.endsWith('`')) {
      raw = raw.slice(1, -1);
    } else if (raw.startsWith('"') && raw.endsWith('"')) {
      raw = raw.slice(1, -1);
    } else if (raw.startsWith("'") && raw.endsWith("'")) {
      raw = raw.slice(1, -1);
    } else if (raw.startsWith('<') && raw.endsWith('>')) {
      raw = raw.slice(1, -1);
    } else if (raw.startsWith('{') && raw.endsWith('}')) {
      raw = raw.slice(1, -1);
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      raw = raw.slice(1, -1);
    } else if (raw.startsWith('(') && raw.endsWith(')')) {
      raw = raw.slice(1, -1);
    } else {
      const mdLinkMatch = raw.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
      if (mdLinkMatch) {
        raw = mdLinkMatch[2];
      }
    }
    if (raw === before) break;
  }

  raw = raw.trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'undefined' || lower === 'null' || lower === 'none' || lower === 'n/a' || lower === 'na') return '';

  raw = raw.replace(DUPLICATED_UPLOADS_SEGMENT, '$1');

  if (raw.startsWith('gs://')) {
    // The bucket is retired: its objects live on the VPS, mirroring the bucket
    // layout under the uploads root, so a gs:// URI now resolves to the
    // equivalent self-hosted path. The bucket name is discarded on purpose.
    const rest = raw.slice(5);
    const slash = rest.indexOf('/');
    if (slash <= 0) return '';
    const rawPath = rest.slice(slash + 1);
    if (!rawPath) return '';
    const objectPath = stripUploadsPrefixes(rawPath);
    if (!objectPath) return '';
    return `/uploads/${objectPath}`;
  }

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
  if (/^data:/i.test(raw)) return raw;
  return '';
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment.replace(/\+/g, ' '));
  } catch {
    return segment;
  }
}

/**
 * Extract the object path from a legacy GCS / Firebase Storage URL. The result
 * is relative to the on-disk uploads root, so a leading `uploads/` segment is
 * stripped and the caller can prefix `/uploads/` exactly once.
 *
 * Recognised shapes:
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>
 *   https://<bucket>.firebasestorage.app/<path>
 *   https://storage.googleapis.com/<bucket>/<path>
 *
 * Returns '' for anything that is not a bucket URL.
 */
function bucketObjectPathFromUrl(rawUrl: string): string {
  const stripUploadsPrefix = stripUploadsPrefixes;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return '';
  }
  const host = parsed.hostname.toLowerCase();

  // v0 REST API — the object path is a single URL-encoded path segment.
  if (host === 'firebasestorage.googleapis.com' || host === 'www.firebasestorage.googleapis.com') {
    const m = parsed.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
    if (!m) return '';
    let decoded: string;
    try {
      decoded = decodeURIComponent(m[1]);
    } catch {
      decoded = m[1];
    }
    return stripUploadsPrefix(decoded.replace(/\+/g, ' '));
  }

  // Virtual-host alias bucket URL.
  if (host.endsWith('.firebasestorage.app')) {
    const segments = parsed.pathname.split('/').filter(Boolean).map(decodeSegment);
    return segments.length > 0 ? stripUploadsPrefix(segments.join('/')) : '';
  }

  // Direct CDN: /<bucket>/<object path>.
  if (host === 'storage.googleapis.com' || host === 'www.storage.googleapis.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    return stripUploadsPrefix(parts.slice(1).map(decodeSegment).join('/'));
  }

  return '';
}

export function isPlaceholderImageUrl(url: unknown): boolean {
  if (url === undefined || url === null) return true;
  const raw = typeof url === 'string' ? url.trim() : String(url || '').trim();
  if (!raw) return true;

  if (/data-ybw-placeholder(?:=|%3D|")?\s*"?\s*1/i.test(raw)) return true;
  if (
    /viewBox\s*=\s*"0\s*0\s*1\s*1"[^>]*aria-hidden\s*=\s*"true"/i.test(raw) ||
    /viewBox\s*=\s*'0\s*0\s*1\s*1'[^>]*aria-hidden\s*=\s*'true'/i.test(raw)
  ) {
    return true;
  }
  if (/Image\s*asset\s*\(\s*linked/i.test(raw) || /embed\s*in\s*indesign/i.test(raw)) return true;
  if (/viewBox\s*=\s*"0\s*0\s*1200\s*1600"/i.test(raw) || /viewBox\s*=\s*'0\s*0\s*1200\s*1600'/i.test(raw)) {
    if (/<text\b/i.test(raw) && /font-size\s*[:=]\s*["']?\s*56/i.test(raw)) return true;
  }
  if (/^data:image\/svg\+xml/i.test(raw)) {
    try {
      const ascii = raw.length < 2000 ? raw : raw.slice(0, 2000);
      if (/ybw-placeholder|linked\s*[—–-]\s*embed/i.test(ascii)) return true;
      const sizeMatch = ascii.match(/viewBox\s*=\s*["']0\s+0\s+(\d+)\s+(\d+)["']/i);
      if (sizeMatch) {
        const w = Number(sizeMatch[1]);
        const h = Number(sizeMatch[2]);
        if (w === 1 && h === 1) return true;
        if ((w === 1200 && h === 1600) || (w === 1600 && h === 1200)) {
          if (/<text\b/i.test(ascii) && /font-size/i.test(ascii)) return true;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return false;
}

export function filterNonPlaceholderUrls<T extends unknown = string>(
  urls: readonly T[],
  coerce?: (item: T) => string,
): T[] {
  const get = coerce || ((item: any): string => String(item ?? ''));
  return (urls || []).filter((item) => {
    try {
      return !isPlaceholderImageUrl(get(item));
    } catch {
      return true;
    }
  });
}

export function firstNonPlaceholderImage<T extends unknown = string>(
  urls: readonly T[] | undefined | null,
  coerce?: (item: T) => string,
): T | undefined {
  if (!urls || urls.length === 0) return undefined;
  const cleaned = filterNonPlaceholderUrls(urls as readonly T[], coerce);
  return cleaned[0];
}

/**
 * Normalise an image URL for rendering.
 *
 * Legacy bucket URLs — gs://, firebasestorage.googleapis.com/v0, the
 * <bucket>.firebasestorage.app virtual host and storage.googleapis.com — are
 * converted to the equivalent self-hosted `/uploads/...` path. Self-hosted
 * paths and ordinary http(s) URLs pass through unchanged.
 */
export function fixMagazineImageUrl(url: string, version?: string | number): string {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return '';

  let finalUrl = normalized;
  {
    // The Firebase/GCS bucket is retired: its objects were copied onto the VPS
    // mirroring the bucket layout. Any bucket URL still lingering in a database
    // row or a hard-coded constant is rewritten to the on-disk equivalent, so
    // the browser never reaches for the bucket again.
    const bucketObjectPath = bucketObjectPathFromUrl(finalUrl);
    if (bucketObjectPath) finalUrl = `/uploads/${bucketObjectPath}`;

    // --- VPS self-hosted storage migration safety-net.
    //
    // After copying objects out of the Firebase Storage bucket onto the VPS
    // local filesystem, gcloud flattens directory paths whose basename
    // matches an existing object *path* (e.g. a spread folder named
    // `issue.idml/` next to an unrelated object named `issue.idml` ends up
    // as just the file, so images originally stored at
    //   /uploads/magazine-import/issue.idml/img.jpg
    // end up physically on disk at
    //   /uploads/magazine-import/img.jpg
    //
    // We rewrite the URL at render time to that flat layout. This happens
    // AFTER any DB rewrite passes so it also protects against stale /
    // partially-migrated rows and rows re-imported from old data.
    //
    // Applied to both relative `/uploads/...` and absolute
    // `https://yorkshirebusinesswoman.co.uk/uploads/...` paths.
    const upPrefixMatch = finalUrl.match(/^((?:https?:\/\/[^\/]+)?\/uploads\/)((?:[^?#\/]+\/)*)([^?#\/]*)([?#].*)?$/);
    if (upPrefixMatch) {
      const scheme = upPrefixMatch[1];
      const mid = upPrefixMatch[2] ?? '';
      const last = upPrefixMatch[3] ?? '';
      const tail = upPrefixMatch[4] ?? '';
      const fullRel = `${mid}${last}`;
      // Rule 1: magazine-import/<name>.idml/<rest> → basename of <rest>.
      const idmlFlat = fullRel.match(/^magazine-import\/[^\/]+\.idml\/(.+)$/);
      if (idmlFlat) {
        const rest = idmlFlat[1];
        const base = rest.includes('/') ? rest.slice(rest.lastIndexOf('/') + 1) : rest;
        if (base) {
          finalUrl = `${scheme}magazine-import/${base}${tail}`;
        }
      }
    }
  }

  // Append versioning if provided
  if (version) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${separator}v=${version}`;
  }

  return finalUrl;
}


export function fixIssuuEmbedUrl(url: string): string {
  if (!url) return "https://e.issuu.com/embed.html?d=ybw_april-may_2026&u=blackie365";
  
  try {
    // If it's already an embed URL, just ensure it uses e.issuu.com
    if (url.includes('e.issuu.com/embed.html')) {
      return url.replace('issuu.com', 'e.issuu.com');
    }

    // Parse standard Issuu URLs: https://issuu.com/{user}/docs/{doc}
    const issuuMatch = url.match(/issuu\.com\/([^\/]+)\/docs\/([^\/?#]+)/);
    if (issuuMatch) {
      const user = issuuMatch[1];
      const doc = issuuMatch[2];
      return `https://e.issuu.com/embed.html?d=${doc}&u=${user}`;
    }

    // Fallback: just try to swap the domain if it looks like it might work
    return url.replace('issuu.com', 'e.issuu.com');
  } catch (e) {
    return url;
  }
}

const IMAGE_FIELD_SPECS: Array<{ key: string; array?: boolean }> = [
  { key: 'image' }, { key: 'imageUrl' }, { key: 'coverImage' },
  { key: 'featureImage' }, { key: 'heroImage' }, { key: 'mainImage' },
  { key: 'backgroundImage' }, { key: 'logoImage' }, { key: 'partnerLogo' },
  { key: 'pdfUrl' }, { key: 'videoUrl' },
  { key: 'imageUrls', array: true }, { key: 'images', array: true },
  { key: 'gallery', array: true }, { key: 'additionalImages', array: true },
  { key: 'logoImages', array: true },
];

/**
 * Bidirectional normalisation of MagazinePage.content — makes the editor
 * UI "just work" regardless of whether content was populated from the
 * legacy editor's own field names (text/intro/quote), the IDML import's
 * extracted fields (body/standfirst), or any other hybrid source.
 *
 * Also runs fixMagazineImageUrl() over every known image / PDF / video
 * URL field so broken storage.googleapis.com URLs get rewritten to the
 * working firebasestorage.googleapis.com v0 REST form.
 *
 * Idempotent: calling this twice on the same object is a no-op after the
 * first normalisation pass.
 */
export function normalizeMagazinePageContent(contentIn: any): any {
  if (!contentIn || typeof contentIn !== 'object') return {};
  const out = { ...contentIn };

  // 1) text ↔ body (PageEditor reads "Main Text" from .text; IDML imports
  //    populate .body). Keep both populated and always equal. The editor
  //    onChange writes .text (new edits) while legacy IDML imports write
  //    .body equal to .text at import time. `.text` is the editor-primary
  //    field and therefore the source of truth on save: when the two
  //    diverge, always prefer `.text` — a stale `.body` must never clobber a
  //    freshly edited (possibly shorter) `.text`.
  const textRaw = typeof out.text === 'string' ? out.text : '';
  const bodyRaw = typeof out.body === 'string' ? out.body : '';
  const textTrimmed = textRaw.trim();
  const bodyTrimmed = bodyRaw.trim();
  let chosenBodyText = '';
  if (textTrimmed && !bodyTrimmed) chosenBodyText = textTrimmed;
  else if (bodyTrimmed && !textTrimmed) chosenBodyText = bodyTrimmed;
  else if (textTrimmed && bodyTrimmed) {
    chosenBodyText = textTrimmed;
  }
  out.text = chosenBodyText;
  out.body = chosenBodyText;

  // 2) intro ↔ standfirst (PageEditor reads .intro; IDML imports populate
  //    .standfirst). Keep both populated and always equal. `.intro` is the
  //    editor-primary field so, like text/body, it is the source of truth
  //    when the two diverge — a stale `.standfirst` must never clobber a
  //    freshly edited `.intro`.
  const introRaw = typeof out.intro === 'string' ? out.intro : '';
  const standfirstRaw = typeof out.standfirst === 'string' ? out.standfirst : '';
  const introTrimmed = introRaw.trim();
  const standfirstTrimmed = standfirstRaw.trim();
  let chosenIntro = '';
  if (introTrimmed && !standfirstTrimmed) chosenIntro = introTrimmed;
  else if (standfirstTrimmed && !introTrimmed) chosenIntro = standfirstTrimmed;
  else if (introTrimmed && standfirstTrimmed) {
    chosenIntro = introTrimmed;
  }
  out.intro = chosenIntro;
  out.standfirst = chosenIntro;

  // 2b) author ↔ name: often both populated, some templates read author
  //     while others print name. Keep them in sync.
  const authorRaw = typeof out.author === 'string' ? out.author : '';
  const nameRaw = typeof out.name === 'string' ? out.name : '';
  const authorTrim = authorRaw.trim();
  const nameTrim = nameRaw.trim();
  let chosenAuthor = '';
  if (authorTrim && !nameTrim) chosenAuthor = authorTrim;
  else if (nameTrim && !authorTrim) chosenAuthor = nameTrim;
  else if (authorTrim && nameTrim) {
    chosenAuthor = authorTrim.length >= nameTrim.length ? authorTrim : nameTrim;
  }
  if (chosenAuthor) {
    out.author = chosenAuthor;
    out.name = chosenAuthor;
  }

  // 2c) headline ↔ title. Some old importers used 'headline' as title,
  //     some new sections use 'title' as headline. Keep them consistent so
  //     either change propagates both ways.
  const titleRaw = typeof out.title === 'string' ? out.title : '';
  const headlineRaw = typeof out.headline === 'string' ? out.headline : '';
  const titleTrim = titleRaw.trim();
  const headlineTrim = headlineRaw.trim();
  if (titleTrim && !headlineTrim) out.headline = titleTrim;
  else if (headlineTrim && !titleTrim) out.title = headlineTrim;

  // 3) image URL fields → rewrite broken storage.googleapis.com URLs.
  for (const spec of IMAGE_FIELD_SPECS) {
    const raw = out[spec.key];
    if (spec.array) {
      if (Array.isArray(raw)) {
        out[spec.key] = raw.map((item: any) => {
          if (typeof item === 'string') return fixMagazineImageUrl(item);
          if (item && typeof item.url === 'string') {
            const fixed = fixMagazineImageUrl(item.url);
            return fixed === item.url ? item : { ...item, url: fixed };
          }
          return item;
        });
      }
    } else if (typeof raw === 'string') {
      out[spec.key] = fixMagazineImageUrl(raw);
    }
  }

  // 3b) Social embeds — merge socialEmbeds/social/socialPosts aliases,
  //     validate shape, fix post/image URLs, dedupe. Mirrors how
  //     intro↔standfirst / text↔body keep both field names in sync.
  {
    const SOCIAL_ALIASES = ['socialEmbeds', 'social', 'socialPosts'] as const;
    const SOCIAL_PLATFORMS = new Set<string>([
      'twitter',
      'instagram',
      'facebook',
      'linkedin',
      'tiktok',
      'youtube',
    ]);
    const LAYOUTS = new Set<string>(['rail', 'column-half', 'column-full']);
    const seed: any[] = [];
    for (const key of SOCIAL_ALIASES) {
      const r = (out as any)[key];
      if (Array.isArray(r)) seed.push(...r);
    }
    const seen = new Set<string>();
    const normalized: any[] = [];
    for (const entry of seed) {
      if (!entry || typeof entry !== 'object') continue;
      const platform =
        typeof entry.platform === 'string'
          ? entry.platform.trim().toLowerCase()
          : '';
      const handle =
        typeof entry.handle === 'string' ? entry.handle.trim() : '';
      const accountName =
        typeof entry.accountName === 'string' ? entry.accountName.trim() : '';
      const date =
        typeof entry.date === 'string' ? entry.date.trim() : '';
      const body =
        typeof entry.body === 'string' ? entry.body.trim() : '';
      const caption =
        typeof entry.caption === 'string' && entry.caption.trim().length > 0
          ? entry.caption.trim()
          : undefined;
      const layoutRaw =
        typeof entry.layout === 'string'
          ? entry.layout.trim().toLowerCase()
          : '';
      const layout = LAYOUTS.has(layoutRaw) ? layoutRaw : undefined;
      if (!SOCIAL_PLATFORMS.has(platform)) continue;
      if (!handle || !accountName || !date || !body) continue;
      const postUrlRaw =
        typeof entry.postUrl === 'string' ? entry.postUrl.trim() : '';
      const postUrl =
        postUrlRaw &&
        (postUrlRaw.startsWith('https://') ||
          postUrlRaw.startsWith('http://') ||
          postUrlRaw.startsWith('/'))
          ? fixMagazineImageUrl(postUrlRaw)
          : '';
      if (!postUrl) continue;
      const imageUrlRaw =
        typeof entry.imageUrl === 'string' ? entry.imageUrl.trim() : '';
      const imageUrl = imageUrlRaw ? fixMagazineImageUrl(imageUrlRaw) : '';
      const dedup = `${platform}|${handle}|${postUrl}|${date}|${body.slice(
        0,
        80,
      )}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const item: any = {
        platform,
        handle,
        accountName,
        date,
        body,
        postUrl,
        ...(imageUrl ? { imageUrl } : {}),
        ...(caption ? { caption } : {}),
        ...(layout ? { layout } : {}),
      };
      normalized.push(item);
    }
    (out as any).socialEmbeds = normalized;
    (out as any).social = normalized;
    (out as any).socialPosts = normalized;
  }

  // 4) Canonical image fields. Every importer (IDML, Ghost, manual, Story
  //    Library) and every template still reads/writes a different subset of
  //    ~15 aliased image fields (image/featureImage/heroImage/mainImage/
  //    coverImage/photo/headshot/portrait + images[]/gallery[]/
  //    additionalImages[]). Rather than rewriting every renderer at once
  //    (risky without live verification), we derive TWO canonical fields
  //    here at write time — heroImage (the one image) and gallery (the
  //    ordered list of every known image) — so new/simplified code can
  //    target just these two, while every existing alias keeps being
  //    populated for renderers that still read the old names. Idempotent
  //    and non-destructive: never removes an existing alias field.
  const heroCandidates = [
    out.heroImage, out.imageUrl, out.featureImage, out.image,
    out.mainImage, out.coverImage, out.photo, out.headshot, out.portrait,
  ].map((v) => (typeof v === 'string' ? v.trim() : ''));
  const resolvedHero = firstNonPlaceholderImage(heroCandidates) || '';
  if (resolvedHero) out.heroImage = resolvedHero;

  const seenGallery = new Set<string>();
  const galleryOut: string[] = [];
  const galleryPools: unknown[] = [out.gallery, out.imageUrls, out.images, out.additionalImages];
  for (const pool of galleryPools) {
    if (!Array.isArray(pool)) continue;
    for (const entry of pool) {
      const s = typeof entry === 'string'
        ? entry.trim()
        : String((entry as any)?.src || (entry as any)?.url || (entry as any)?.image || '').trim();
      if (!s || isPlaceholderImageUrl(s) || seenGallery.has(s)) continue;
      seenGallery.add(s);
      galleryOut.push(s);
    }
  }
  if (resolvedHero && !seenGallery.has(resolvedHero)) {
    galleryOut.unshift(resolvedHero);
    seenGallery.add(resolvedHero);
  }
  if (galleryOut.length > 0) out.gallery = galleryOut;

  return out;
}

/**
 * Same normalisation as normalizeMagazinePageContent, but applied to a
 * StoryLibraryItem shape. Keeps story text + imageUrl fields in sync on
 * the Story Library panel (which also reads .text and the image picker
 * writes .imageUrl).
 */
export function normalizeStoryLibraryItem(itemIn: any): any {
  if (!itemIn || typeof itemIn !== 'object') return {};
  const out = { ...itemIn };
  const textRaw = typeof out.text === 'string' ? out.text : '';
  const bodyRaw = typeof out.body === 'string' ? out.body : '';
  const trimmed = (s: string) => s.trim();
  if (trimmed(textRaw) && !trimmed(bodyRaw)) out.body = trimmed(textRaw);
  else if (trimmed(bodyRaw) && !trimmed(textRaw)) out.text = trimmed(bodyRaw);
  else if (trimmed(textRaw) && trimmed(bodyRaw) && trimmed(textRaw) !== trimmed(bodyRaw)) {
    const chosen = trimmed(textRaw).length >= trimmed(bodyRaw).length ? trimmed(textRaw) : trimmed(bodyRaw);
    out.text = chosen;
    out.body = chosen;
  }
  if (typeof out.imageUrl === 'string') out.imageUrl = fixMagazineImageUrl(out.imageUrl);
  const standfirst = typeof out.standfirst === 'string' ? out.standfirst : '';
  const summary = typeof out.summary === 'string' ? out.summary : '';
  const sT = trimmed(standfirst), sumT = trimmed(summary);
  if (sT && !sumT) out.summary = sT;
  else if (sumT && !sT) out.standfirst = sumT;
  else if (sT && sumT && sT !== sumT) {
    const chosen = sT.length >= sumT.length ? sT : sumT;
    out.standfirst = chosen;
    out.summary = chosen;
  }
  return out;
}

const STORY_LIBRARY_PRIM_IMAGE_KEYS = [
  'imageUrl', 'image', 'featureImage', 'heroImage', 'mainImage', 'coverImage',
  'photo', 'headshot', 'portrait', 'partnerLogo', 'logoImage', 'backgroundImage',
  'logo', 'pdfUrl',
];
const STORY_LIBRARY_ARR_IMAGE_KEYS = [
  'imageUrls', 'images', 'gallery', 'additionalImages', 'imageFileNames',
  'logoImages', 'coverImages',
];

export function normalizeStoryLibraryImageFields<T extends any>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const next: any = { ...item };
    for (const k of STORY_LIBRARY_PRIM_IMAGE_KEYS) {
      if (k in next) next[k] = normalizeImageUrl(next[k]);
    }
    for (const k of STORY_LIBRARY_ARR_IMAGE_KEYS) {
      if (Array.isArray(next[k])) {
        next[k] = next[k]
          .map((entry: any) => normalizeImageUrl(entry))
          .filter((entry: string) => entry.length > 0);
      }
    }
    if (typeof next.content === 'object' && next.content !== null) {
      const c: any = { ...next.content };
      for (const k of STORY_LIBRARY_PRIM_IMAGE_KEYS) {
        if (k in c) c[k] = normalizeImageUrl(c[k]);
      }
      for (const k of STORY_LIBRARY_ARR_IMAGE_KEYS) {
        if (Array.isArray(c[k])) {
          c[k] = c[k].map((entry: any) => normalizeImageUrl(entry)).filter((s: string) => s.length > 0);
        }
      }
      next.content = c;
    }
    return next as T;
  });
}

export interface ReaderContentsItem {
  page: number;
  category: string;
  title: string;
}

const READER_CONTENTS_CATEGORY_BY_TEMPLATE: Record<string, string> = {
  'editor-note': 'EDITORIAL',
  'letter-from-editor': 'EDITORIAL',
  masthead: 'EDITORIAL',
  editorial: 'EDITORIAL',
  'feature-full': 'FEATURE',
  'feature-left': 'FEATURE',
  'feature-right': 'FEATURE',
  'news-in-brief': 'EXPERT',
  'news-brief': 'EXPERT',
  'two-column': 'EXPERT',
  'three-column': 'EXPERT',
  column: 'EXPERT',
  gallery: 'LIFESTYLE',
  'gallery-grid': 'LIFESTYLE',
  'photo-essay': 'LIFESTYLE',
  lifestyle: 'LIFESTYLE',
  'member-profile': 'SPOTLIGHT',
  spotlight: 'SPOTLIGHT',
  'listing-directory': 'PARTNER',
  'directory-page': 'PARTNER',
  'sponsor-spotlight': 'PARTNER',
  partner: 'PARTNER',
};

const READER_STRUCTURAL_NON_ARTICLE_TEMPLATES = new Set([
  'cover',
  'contents',
  'ad',
  'advertisement',
  'full-page-ad',
  'back-cover',
]);

/**
 * Given any ReaderPage[] array (the flat pages stored in a ReaderEdition),
 * rebuild the Table of Contents items list.
 *
 * Works even for legacy IDML-published ReaderEditions where the mapper had
 * written 2 garbage rows or duplicated article rows across spread halves.
 *
 * Rules:
 *  - Skip structural non-article templates (cover/contents/ad/back cover).
 *  - Skip any rows with no readable title.
 *  - Skip templates that are not known article categories.
 *  - Extract print page number from the page.id string pattern like
 *    "page-7-west-yorkshire-law-firm-mswckjyn" → pageNumber = 7. Falls back
 *    to page.pageNumber, page.position, then (final safety) array index + 1.
 *  - De-duplicate every article by category + title (case-insensitive,
 *    whitespace collapsed) → KEEPS ONLY THE LOWEST PRINT PAGE NUMBER for
 *    each story, i.e. the FIRST spread of the article. No duplicated rows
 *    for articles that span feature-full + feature-right or left+right.
 */
export function buildReaderContentsItemsFromPages<
  P extends {
    id?: unknown;
    template?: unknown;
    pageNumber?: unknown;
    position?: unknown;
    content?: any;
    title?: unknown;
    name?: unknown;
  },
>(pages: P[]): ReaderContentsItem[] {
  if (!Array.isArray(pages) || pages.length === 0) return [];

  function titleFrom(p: P): string {
    const c: any = (p as any).content || {};
    return String(
      c.title || c.headline || c.name || c.brand || p.title || p.name || '',
    ).trim();
  }
  function pageNumFrom(p: P, slotIdx: number): number {
    if (typeof (p as any).pageNumber === 'number' && Number.isFinite((p as any).pageNumber)) {
      return (p as any).pageNumber;
    }
    const idStr = String(p.id || '');
    let m = idStr.match(/^page[-_](\d+)[-_]/);
    if (m) return Number(m[1]);
    m = idStr.match(/[-_](\d+)[-_]?[^-_]*$/);
    if (m) return Number(m[1]);
    const pos = Number((p as any).position || 0);
    if (Number.isFinite(pos) && pos > 0) return pos;
    return slotIdx + 1;
  }
  function normId(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  const withMeta = pages
    .map((p, slotIndex) => ({
      p,
      slotIndex,
      template: String((p as any).template || '').toLowerCase(),
      title: titleFrom(p),
      pageNumber: pageNumFrom(p, slotIndex),
    }))
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const seenArticleKeys = new Set<string>();
  const out: ReaderContentsItem[] = [];
  for (const entry of withMeta) {
    if (READER_STRUCTURAL_NON_ARTICLE_TEMPLATES.has(entry.template)) continue;
    if (!entry.title) continue;
    const category = READER_CONTENTS_CATEGORY_BY_TEMPLATE[entry.template];
    if (!category) continue;
    if (!Number.isFinite(entry.pageNumber) || entry.pageNumber <= 0) continue;
    const articleKey = `${category.toLowerCase()}:${normId(entry.title)}`;
    if (seenArticleKeys.has(articleKey)) continue;
    seenArticleKeys.add(articleKey);
    out.push({ page: entry.pageNumber, category, title: entry.title });
  }
  return out;
}

/**
 * Bump this version whenever you change ANY of the hydration rules below —
 *   - buildReaderContentsItemsFromPages algorithm
 *   - print-page-number extraction rules in hydrateReaderEditionContents
 *   - legacy-page merge order in hydrateEditionWithLegacyPages
 *   - template aliasing (e.g. feature-full) or content alias normalisation
 *
 * Any edition already at this version will short-circuit the entire hydration
 * pipeline so readers don't pay the Firestore-read + map cost on every visit.
 */
export const CURRENT_READER_SCHEMA_VERSION = 1;

/**
 * Idempotent ReaderEdition normaliser:
 *   1. Rebuilds Contents items and writes them to the template=='contents'
 *      page's content.items.
 *   2. Ensures every page has a crisp position/pageNumber set
 *      (print-page-number extracted from page.id when possible), so
 *      MagazineShell's findPageIndexByClickHint can resolve clicked items.
 *
 * Returns a new ReaderEdition (or input reference if nothing to fix) so
 * simple-reader.ts can apply it server-side on every fetch.
 */
export function hydrateReaderEditionContents<T extends { pages: any[] }>(editionIn: T | null | undefined): T | null {
  if (!editionIn || !Array.isArray(editionIn.pages) || editionIn.pages.length === 0) {
    return (editionIn as T | null) ?? null;
  }
  const rebuiltItems = buildReaderContentsItemsFromPages(editionIn.pages);

  function pageNumFrom(p: any, idx: number): number {
    if (typeof p.pageNumber === 'number' && Number.isFinite(p.pageNumber)) return p.pageNumber;
    const idStr = String(p.id || '');
    let m = idStr.match(/^page[-_](\d+)[-_]/);
    if (m) return Number(m[1]);
    m = idStr.match(/[-_](\d+)[-_]?[^-_]*$/);
    if (m) return Number(m[1]);
    const pos = Number(p.position || 0);
    if (Number.isFinite(pos) && pos > 0) return pos;
    return idx + 1;
  }

  let changed = false;
  const newPages = editionIn.pages.map((page, idx) => {
    const wantNum = pageNumFrom(page, idx);
    const template = String(page.template || '').toLowerCase();
    const isContents = template === 'contents';
    const contentsNeedFix =
      isContents &&
      (!page.content ||
        !Array.isArray(page.content.items) ||
        page.content.items.length !== rebuiltItems.length);
    const numNeedFix = Number(page.position) !== wantNum || Number(page.pageNumber) !== wantNum;

    if (!contentsNeedFix && !numNeedFix) return page;
    changed = true;
    const next: any = { ...page, position: wantNum, pageNumber: wantNum };
    if (isContents) {
      next.content = { ...(page.content || {}), items: rebuiltItems };
    }
    return next;
  });

  if (!changed) return editionIn as T;
  return { ...(editionIn as any), pages: newPages } as T;
}

/**
 * Returns true when the doc already carries the CURRENT schema version tag,
 * meaning all of:
 *   - Contents items rebuild (length + dedupe)
 *   - position/pageNumber crisping
 *   - legacy-pages merge (hydrateEditionWithLegacyPages)
 *   - normalizeMagazinePageContent field alias normalisation
 *   - fixMagazineImageUrl rewriting
 * have already been applied server-side and do NOT need to be re-run for
 * reader traffic.
 *
 * Returns false for documents that never had a schemaVersion (pre-backfill)
 * or carry an older version so we know to re-hydrate them once.
 */
export function isReaderSchemaCurrent(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const version = (doc as any).schemaVersion;
  return typeof version === 'number' && version >= CURRENT_READER_SCHEMA_VERSION;
}

