/**
 * Aggressively strip surrounding delimiters that sometimes leak into CMS
 * fields and Story Library records: backticks, quotes, angle brackets,
 * whitespace, curly braces and Markdown link wrappers.
 *
 * Rejects sentinel values like "undefined", "null", "none", "n/a" that
 * String(undefined) etc. accidentally produced in earlier builds.
 *
 * Converts gs:// Firebase storage admin URIs to the equivalent public
 * Firebase Storage v0 REST API URL. The v0 API accepts BOTH legacy-style
 * .appspot.com buckets AND modern alias-style .firebasestorage.app buckets
 * directly in the `/v0/b/<bucket>/` path parameter. We therefore NO LONGER
 * rewrite alias buckets to .appspot.com — projects created after mid-2024
 * have NO physical .appspot.com bucket, so that rewrite produces 404. The
 * alias spelling IS the real bucket name for these.
 *
 * Output format:
 *   https://firebasestorage.googleapis.com/v0/b/<EXACT_BUCKET>/o/<safeSegmentEncodedPath>?alt=media
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

      // Decode then re-encode each segment to safeSegmentEncodedPath form.
      // This removes double-encoding and produces the exact form the v0 REST
      // API `/o/<enc>` parameter expects.
      let decPath: string;
      try {
        decPath = decodeURIComponent(rawPath.replace(/\+/g, ' '));
      } catch {
        decPath = rawPath;
      }
      const safe = decPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${safe}?alt=media`;
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

/**
 * Utility to convert various image URL formats to browser-safe public URLs.
 * Specifically handles Firebase Storage 'gs://' links and legacy broken GCS
 * link permutations stored in Firestore.
 *
 * CANONICAL OUTPUT FORMAT (confirmed on production for
 * newmembersdirectory130325.firebasestorage.app):
 *   https://firebasestorage.googleapis.com/v0/b/<EXACT_BUCKET_NAME>/o/<safeSegmentEncodedPath>?alt=media
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
    // Pass-through: already-canonical v0 REST API URLs (correct bucket + format).
    const alreadyCanonical = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^\/]+\/o\/[^?#]+\?alt=media/i;
    if (!alreadyCanonical.test(finalUrl)) {
      // --- Pattern A: direct-CDN alias URL.
      //   https://<proj>.firebasestorage.app/<path-in-any-encoding>
      // Rewrite to canonical v0 REST API URL (works for ALL bucket types).
      const aliasDirectRe = /^https:\/\/([^\/]+?\.firebasestorage\.app)\/([^?#]+)(?:\?[^#]*)?$/i;
      const aliasDirect = finalUrl.match(aliasDirectRe);
      if (aliasDirect) {
        const [, bucket, rawPathEncoded] = aliasDirect;
        try {
          const safe = safeSegmentEncode(rawPathEncoded);
          finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${safe}?alt=media`;
        } catch {
          // keep original
        }
      } else {
        // --- Pattern B: v0 REST API URL pointing to alias bucket but missing
        // `?alt=media`, or having extra query params, or using over/under-encoded
        // object path. Normalize to canonical v0 REST form.
        const restAliasRe = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^?#]+)(?:\?[^#]*)?$/i;
        const restAlias = finalUrl.match(restAliasRe);
        if (restAlias) {
          const [, bucket, encObjPath] = restAlias;
          try {
            const safe = safeSegmentEncode(encObjPath);
            finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${safe}?alt=media`;
          } catch {
            // keep original
          }
        } else {
          // --- Pattern C: storage.googleapis.com/<bucket>/<path>
          // This format was emitted by OLD buildPublicStorageUrl for IDML
          // uploads, but `storage.googleapis.com/<proj>.firebasestorage.app/...`
          // 404s because the alias bucket name cannot be used inside the
          // storage.googleapis.com/<path>/ virtual-host style path.
          const badGcsRe = /^https:\/\/storage\.googleapis\.com\/([^\/]+)\/([^?#]+)(?:\?[^#]*)?$/i;
          const badGcs = finalUrl.match(badGcsRe);
          if (badGcs) {
            const [, bucket, rawPathEncoded] = badGcs;
            try {
              const safe = safeSegmentEncode(rawPathEncoded);
              finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${safe}?alt=media`;
            } catch {
              // keep original
            }
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
