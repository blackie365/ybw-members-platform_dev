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
