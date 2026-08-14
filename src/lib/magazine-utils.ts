/**
 * Aggressively strip surrounding delimiters that sometimes leak into CMS
 * fields and Story Library records: backticks, quotes, angle brackets,
 * whitespace, curly braces and Markdown link wrappers.
 *
 * Rejects sentinel values like "undefined", "null", "none", "n/a" that
 * String(undefined) etc. accidentally produced in earlier builds.
 *
 * Converts gs:// Firebase storage admin URIs to the equivalent public
 * direct-CDN path URL.
 *
 * CRITICAL ORB / 2026-08-14:
 *   The legacy REST v0 API pattern `firebasestorage.googleapis.com/v0/b/<bucket>/o/<enc>?alt=media`
 *   returns HTTP 400 for modern `.firebasestorage.app` alias buckets when a
 *   real browser `Origin:` header is present, which triggers Chromium's
 *   Opaque Response Blocker (net::ERR_BLOCKED_BY_ORB) and ZERO images
 *   visually paint. The direct-CDN path pattern
 *   `storage.googleapis.com/<EXACT_BUCKET>/<safeSegmentEncodedPath>`
 *   returns HTTP 200 image/jpeg with Access-Control-Allow-Origin: * and
 *   NO `Cross-Origin-Resource-Policy:` response header, which defeats
 *   ORB and renders correctly on every Chromium/Firefox/Safari.
 *
 * Projects created after mid-2024 have NO physical .appspot.com bucket,
 * so rewriting to that spelling results in HTTP 404. The alias spelling
 * `.firebasestorage.app` IS the real bucket name; keep it verbatim.
 *
 * Output format:
 *   https://storage.googleapis.com/<EXACT_BUCKET>/<safeSegmentEncodedPath>
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
      // This removes double-encoding and produces the exact form the
      // direct-CDN path parameter expects.
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
      return `https://storage.googleapis.com/${bucket}/${safe}`;
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
 * CANONICAL OUTPUT FORMAT (confirmed on production 2026-08-14 for
 * newmembersdirectory130325.firebasestorage.app with Origin header):
 *   https://storage.googleapis.com/<EXACT_BUCKET_NAME>/<safeSegmentEncodedPath>
 *
 * Why NOT the v0 REST API URL? Because for alias buckets the REST v0 endpoint
 * returns HTTP 400 when a real browser Origin header is present, which
 * triggers Chromium ORB (net::ERR_BLOCKED_BY_ORB). The direct-CDN path
 * above returns HTTP 200 image/jpeg with ACAO=* and no CORP header,
 * which ORB does not block.
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
    // Pass-through: already-canonical direct-CDN path URLs (correct bucket + format).
    const alreadyCanonical = /^https:\/\/storage\.googleapis\.com\/[^\/]+\/[^?#]+/i;
    if (!alreadyCanonical.test(finalUrl)) {
      // --- Pattern A: REST v0 API URL (ORB-blocking).
      //   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<enc>?alt=media
      // Rewrite to canonical direct-CDN path URL.
      const restV0Re = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/([^?#]+)(?:\?[^#]*)?$/i;
      const restV0Match = finalUrl.match(restV0Re);
      if (restV0Match) {
        const [, bucket, encObjPath] = restV0Match;
        try {
          const safe = safeSegmentEncode(encObjPath);
          finalUrl = `https://storage.googleapis.com/${bucket}/${safe}`;
        } catch {
          // keep original
        }
      } else {
          // --- Pattern B: virtual-host alias bucket URL.
          //   https://<proj>.firebasestorage.app/<path-in-any-encoding>
          // Rewrite to canonical direct-CDN path URL.
          const aliasDirectRe = /^https:\/\/([^\/]+?\.firebasestorage\.app)\/([^?#]+)(?:\?[^#]*)?$/i;
          const aliasDirect = finalUrl.match(aliasDirectRe);
          if (aliasDirect) {
            const [, bucket, rawPathEncoded] = aliasDirect;
            try {
              const safe = safeSegmentEncode(rawPathEncoded);
              finalUrl = `https://storage.googleapis.com/${bucket}/${safe}`;
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
