/**
 * Aggressively strip surrounding delimiters that sometimes leak into CMS
 * fields and Story Library records: backticks, quotes, angle brackets,
 * whitespace, curly braces and Markdown link wrappers.
 *
 * Rejects sentinel values like "undefined", "null", "none", "n/a" that
 * String(undefined) etc. accidentally produced in earlier builds.
 *
 * Converts gs:// Firebase storage admin URIs to the equivalent canonical
 * Firebase Storage v0 REST API public URL (firebasestorage.googleapis.com).
 * The direct-CDN pattern `storage.googleapis.com/<bucket>/<path>` 403s for
 * default Firebase-managed *.firebasestorage.app buckets (no allUsers GCS
 * IAM grant) so we never emit it — the v0 REST URL always serves with
 * Access-Control-Allow-Origin:* and no Cross-Origin-Resource-Policy header,
 * which defeats Chromium ORB and paints correctly on every browser.
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

  if (raw.startsWith('gs://')) {
    try {
      const rest = raw.slice(5);
      const slash = rest.indexOf('/');
      if (slash <= 0) return '';
      const bucket = rest.slice(0, slash);
      const rawPath = rest.slice(slash + 1);
      if (!bucket || !rawPath) return '';

      // Decode any double-encoded / weird encodings to get the true raw object path.
      let objectPath: string;
      try {
        objectPath = decodeURIComponent(rawPath.replace(/\+/g, ' '));
      } catch {
        objectPath = rawPath;
      }
      // Firebase v0 REST API /o/<encodedObjectPath> path segment expects the
      // entire object path (including slashes) to be URL-encoded as a single
      // value so slashes become %2F, matching what getDownloadURL returns.
      const encodedObjectPath = encodeURIComponent(objectPath);
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedObjectPath}?alt=media`;
    } catch {
      return '';
    }
  }

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
  if (/^data:/i.test(raw)) return raw;
  return '';
}

function safeSegmentEncode(pathEncodedLike: string): string {
  let dec: string;
  try {
    dec = decodeURIComponent(pathEncodedLike.replace(/\+/g, ' '));
  } catch {
    dec = pathEncodedLike;
  }
  return dec
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function safeSegmentDecode(pathEncodedLike: string): string {
  // Accepts either segment-encoded /-separated path OR fully-encoded (with
  // %2F separators) form; returns plain decoded path like "folder/image.jpg".
  const segments = pathEncodedLike.split('/');
  try {
    return segments
      .map((seg) => decodeURIComponent(seg.replace(/\+/g, ' ')))
      .join('/');
  } catch {
    return pathEncodedLike;
  }
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
 * Utility to convert various image URL formats to browser-safe public URLs.
 * Specifically handles Firebase Storage 'gs://' links and legacy broken GCS
 * link permutations stored in Firestore.
 *
 * CANONICAL OUTPUT FORMAT for Firebase-managed buckets:
 *   https://firebasestorage.googleapis.com/v0/b/<EXACT_BUCKET>/o/<safeEncodedObjectPath>?alt=media
 *
 * Why NOT the direct-CDN path pattern `storage.googleapis.com/<bucket>/<path>`?
 * Because default Firebase-managed `*.firebasestorage.app` buckets do NOT
 * grant `allUsers storage.objects.get` anonymous-read on the plain GCS IAM
 * surface; only the Firebase Storage v0 REST API endpoint applies the
 * Firebase Storage security rules (the public-read defaults), so the
 * direct-CDN path pattern returns HTTP 403 AccessDenied for ~90% of objects
 * uploaded via Firebase Admin SDK or Web SDK.
 *
 * Additionally: the Firebase Storage v0 REST URL returns HTTP 200 with
 * Access-Control-Allow-Origin: * and NO Cross-Origin-Resource-Policy
 * response header, so Chromium's Opaque Response Blocker (ORB) does not
 * block images from painting. Images therefore render correctly on every
 * Chromium / Firefox / Safari browser both locally and in production.
 *
 *   Important: For projects created after mid-2024, the EXACT bucket name is
 *   `<proj>.firebasestorage.app`. The legacy spelling `<proj>.appspot.com`
 *   does NOT exist as a GCS bucket for those projects, so any rewrite to
 *   that spelling results in HTTP 404. We therefore use the bucket name
 *   exactly as reported by the Admin SDK / as it appears in incoming URLs.
 *
 *   Legacy .appspot.com buckets that really exist pass through untouched.
 */
export function fixMagazineImageUrl(url: string, version?: string | number): string {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return '';

  let finalUrl = normalized;
  {
    // Pass-through: already-canonical Firebase Storage v0 REST API URLs
    const alreadyCanonicalFirebase = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^\/]+\/o\/[^?#]+/i;
    if (!alreadyCanonicalFirebase.test(finalUrl)) {
      // --- Pattern A: direct-CDN storage.googleapis.com path (HTTP 403).
      //   https://storage.googleapis.com/<bucket>/<path-in-any-encoding>
      // Rewrite to canonical Firebase Storage v0 REST API URL.
      const directCdnRe = /^https:\/\/storage\.googleapis\.com\/([^\/?#]+)\/([^?#]+)(?:\?[^#]*)?$/i;
      const directCdnMatch = finalUrl.match(directCdnRe);
      if (directCdnMatch) {
        const [, bucket, rawPath] = directCdnMatch;
        try {
          // Decode once to get true raw path segments (safeSegmentEncode
          // returns /-separated, each segment URI-encoded). We then
          // encode the full path INCLUDING slashes as %2F so Firebase REST
          // v0 /o/<encPath> segment matches getDownloadURL output.
          const decodedPath = safeSegmentDecode(rawPath);
          finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(decodedPath)}?alt=media`;
        } catch {
          // keep original
        }
      } else {
        // --- Pattern B: virtual-host alias bucket URL.
        //   https://<proj>.firebasestorage.app/<path-in-any-encoding>
        // Rewrite to canonical Firebase Storage v0 REST API URL.
        const aliasDirectRe = /^https:\/\/([^\/]+?\.firebasestorage\.app)\/([^?#]*)(?:\?[^#]*)?$/i;
        const aliasDirect = finalUrl.match(aliasDirectRe);
        if (aliasDirect) {
          const [, bucket, rawPathEncoded] = aliasDirect;
          try {
            const decodedPath = rawPathEncoded ? safeSegmentDecode(rawPathEncoded) : '';
            if (decodedPath) {
              finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(decodedPath)}?alt=media`;
            }
          } catch {
            // keep original
          }
        } else if (/^https?:\/\/[^\/]+?\.firebasestorage\.app\//i.test(finalUrl)) {
          // Any other *.firebasestorage.app URL variant with query params etc.
          try {
            const u = new URL(finalUrl);
            const bucket = u.hostname;
            const path = u.pathname.replace(/^\//, '');
            if (bucket && path) {
              const decodedPath = safeSegmentDecode(path);
              finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(decodedPath)}?alt=media`;
            }
          } catch {
            // keep original
          }
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

// ─────────────────────────────────────────────
// BALANCED NEWSPAPER COLUMNS
// The newspaper reader lays story text out in columns. Native CSS multicol
// equalises each column to the full (unbounded) content height, so long text
// renders as one very tall block and reads unevenly. Instead we balance the
// blocks by hand: split body paragraphs + inline gallery images into N columns
// with as-equal an estimated height as possible, so no single column is
// noticeably longer than the others.
// ─────────────────────────────────────────────

export type ColumnItem =
  | { kind: 'text'; html: string }
  | { kind: 'img'; src: string; alt: string };

// Rough height weight for a flow item: image items use a flat figure cost
// (their height dwarfs a line of text); text items are weighted by the number
// of rendered lines (~90 chars/line at newspaper column width) plus margins.
function estimateColumnItemHeight(item: ColumnItem): number {
  if (item.kind === 'img') return 24;
  const text = String(item.html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 2;
  return Math.max(2, Math.ceil(text.length / 90) + 1.2);
}

// Split a plain-text block into smaller paragraphs so the column balancer can
// distribute content at fine enough granularity to make columns genuinely even
// (a single very long paragraph otherwise forces one column much taller than
// the rest). Only <p> blocks containing pure text (no nested tags) are split —
// figures, blockquotes, lists and headings are kept whole because they can't be
// safely broken across columns.
//
// Crucially the split happens ONLY at sentence boundaries (end of sentence:
// ". ", "! ", "? ", and sentence punctuation followed by a closing quote) and
// never mid-sentence or mid-word, so the rendered paragraph breaks never look
// arbitrary or leave a one-letter orphan line on its own. A larger target keeps
// paragraphs long and natural; the trailing fragment is trimmed/merged back so
// we never emit a tiny stray chunk.
export function chunkTextBlock(html: string, targetChars = 350, minChunk = 60): string[] {
  const trimmed = String(html || '').trim();
  if (!/^<p(\s[^>]*)?>[\s\S]*<\/p>$/.test(trimmed)) return [trimmed];
  const text = trimmed.replace(/^<p(\s[^>]*)?>/, '').replace(/<\/p>$/, '');
  if (text.includes('<') || text.length <= targetChars * 1.35) return [trimmed];

  const normalized = text.replace(/\s+/g, ' ').trim();
  // Find sentence boundaries: a sentence-terminating character, optional
  // trailing quotes/parens, followed by whitespace. Keeps "Dr." / "e.g."
  // intact by only splitting on a terminal punctuation that ends a sentence.
  const sentenceEnd = /[.!?]["')\u201d\u2019]*\s+/g;
  const sentences: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(sentenceEnd.source, 'g');
  while ((m = re.exec(normalized)) !== null) {
    // Heuristic guard: only treat as a sentence end if the char before the
    // punctuation is not an uppercase single letter (abbreviations like
    // "Dr. Smith", "St. Peter's") and the next char is a capital letter or the
    // word is genuinely short. We keep it simple: skip boundaries where the
    // period follows a common abbreviation pattern.
    const preceding = normalized.slice(Math.max(0, m.index - 2), m.index);
    if (/[A-Z]\.$/.test(preceding) && m[0].length <= 3 && /^[a-z]/.test(normalized.slice(m.index + m[0].length))) {
      continue; // likely an abbreviation, not a sentence end
    }
    sentences.push(normalized.slice(last, m.index + m[0].length).trim());
    last = m.index + m[0].length;
  }
  if (last < normalized.length) sentences.push(normalized.slice(last).trim());

  if (sentences.length < 2) return [trimmed];

  // Greedily pack sentences into chunks up to targetChars.
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && (cur + ' ' + s).length > targetChars) {
      chunks.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur) {
    // Merge a tiny trailing orphan back into the previous chunk so we never
    // leave a one/two-word fragment alone on the last line.
    if (chunks.length > 0 && cur.length < minChunk) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${cur}`;
    } else {
      chunks.push(cur);
    }
  }

  const output = chunks.filter((c) => c.trim()).map((c) => `<p>${c}</p>`);
  return output.length > 1 ? output : [trimmed];
}

/**
 * Distribute body blocks + gallery images into exactly `columnCount` columns,
 * greedily placing each item into the currently-shortest column (after chunking
 * long paragraphs) so the resulting columns are as close in height as possible.
 * Gallery images are interleaved roughly evenly through the text rather than
 * clustering in one column.
 */
export function buildBalancedColumns(
  blocks: string[],
  imageItems: ColumnItem[],
  columnCount: number,
): ColumnItem[][] {
  const n = Math.max(1, columnCount);
  const cols: ColumnItem[][] = Array.from({ length: n }, () => []);
  const heights = Array.from({ length: n }, () => 0);
  const imageWeight = estimateColumnItemHeight({ kind: 'img', src: '', alt: '' });

  const textItems: { item: ColumnItem; weight: number }[] = [];
  for (const block of blocks) {
    for (const html of chunkTextBlock(block)) {
      textItems.push({
        item: { kind: 'text', html },
        weight: estimateColumnItemHeight({ kind: 'text', html }),
      });
    }
  }

  // Build a single ordered flow, interleaving images ~evenly through the text.
  const flow: { item: ColumnItem; weight: number }[] = [];
  const imageTotal = imageItems.length * imageWeight;
  const textTotal = textItems.reduce((s, { weight }) => s + weight, 0);
  let consumed = 0;
  let imgIdx = 0;
  for (let i = 0; i < textItems.length; i++) {
    flow.push(textItems[i]);
    consumed += textItems[i].weight;
    while (imgIdx < imageItems.length) {
      const want =
        imageTotal > 0
          ? (textTotal * (imgIdx + 1)) / (imageItems.length + 1)
          : Infinity;
      if (consumed < want) break;
      flow.push({ item: imageItems[imgIdx], weight: imageWeight });
      imgIdx++;
    }
  }
  while (imgIdx < imageItems.length) {
    flow.push({ item: imageItems[imgIdx], weight: imageWeight });
    imgIdx++;
  }

  const pickShortest = () => {
    let min = 0;
    for (let i = 1; i < n; i++) if (heights[i] < heights[min]) min = i;
    return min;
  };
  for (const { item, weight } of flow) {
    const col = pickShortest();
    cols[col].push(item);
    heights[col] += weight;
  }
  return cols;
}
