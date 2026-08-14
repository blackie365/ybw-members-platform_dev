/**
 * Aggressively strip surrounding delimiters that sometimes leak into CMS
 * fields and Story Library records: backticks, quotes, angle brackets,
 * whitespace, curly braces and Markdown link wrappers.
 *
 * Rejects sentinel values like "undefined", "null", "none", "n/a" that
 * String(undefined) etc. accidentally produced in earlier builds.
 *
 * Converts gs:// Firebase storage admin URIs to the equivalent public
 * storage.googleapis.com HTTPS URL so browsers can render the asset.
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
      const safeSegmentEncodedPath = rawPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      if (!bucket || !rawPath) return '';

      // --- Modern Firebase Storage default buckets -----------------------
      //
      // In late 2024+ Firebase creates projects with a default storage bucket
      // at `<projectId>.firebasestorage.app` (NOT the classic
      // `<projectId>.appspot.com`). Admin SDK writes gs:// URIs with that
      // domain as the "bucket" part directly. If you feed that alias domain
      // into the legacy REST API path:
      //   firebasestorage.googleapis.com/v0/b/<alias>.firebasestorage.app/o/…
      // older GCS regions / projects can return 404 "bucket not found" even
      // though the bucket clearly exists when viewed in the Firebase console
      // Storage browser, and direct HTTPS fetch works.
      //
      // For these aliased buckets, Firebase actually serves public objects
      // directly from:
      //   https://<alias>.firebasestorage.app/<pathWithEncodedSpacesOnly>
      // which is the canonical URL printed in the Firebase console Storage
      // file inspector under "HTTPS URL". Use THAT as the primary URL we
      // generate for firebasestorage.app buckets.
      //
      // Otherwise fall back to:
      //   firebasestorage.googleapis.com/v0/b/<bucket>/o/<fullUriEnc>?alt=media
      // for classic .appspot.com / named legacy buckets, which is the prior
      // behaviour and still works for them.
      const bucketLower = bucket.toLowerCase();
      const pathSpacesEncoded = rawPath.replace(/ /g, '%20');
      if (bucketLower.endsWith('.firebasestorage.app')) {
        // Primary: modern direct CDN URL (matches Firebase console output
        // exactly).  We only encode SPACE characters in the path here — the
        // direct bucket-domain CDN endpoint accepts bare slashes, dots,
        // colons, dashes, underscores, @ signs etc. in path names.  Too much
        // encoding (e.g. slashes encoded to %2F) breaks the route because
        // the domain is itself a bucket and wants an actual file path.
        return `https://${bucket}/${pathSpacesEncoded}`;
      }

      // Non-alias bucket: legacy behaviour.
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${safeSegmentEncodedPath}?alt=media`;
    } catch {
      return '';
    }
  }

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
  if (/^data:/i.test(raw)) return raw;
  return '';
}

/**
 * Utility to convert various image URL formats to browser-safe public URLs.
 * Specifically handles Firebase Storage 'gs://' links and restricted GCS links.
 */
export function fixMagazineImageUrl(url: string, version?: string | number): string {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return '';
  
  // Keep already-public Storage URLs untouched.
  // Rewriting them to the Firebase API can trigger auth/rules checks and
  // produce "Anonymous caller does not have storage.objects.get" errors.
  // normalizeImageUrl has already done:
  //   - stripping of backticks/quotes/brackets/spaces
  //   - gs:// → public HTTPS conversion (modern direct CDN for
  //     firebasestorage.app aliased buckets, legacy v0 API for classic
  //     .appspot.com / named buckets)
  //   - rejection of "undefined"/null/none sentinels.
  //
  // One more rewrite is needed at this layer, though: sometimes a PRIOR
  // write-time version of normalizeImageUrl (the pre-fix one that didn't
  // know about firebasestorage.app aliases) already converted a
  // `gs://<proj>.firebasestorage.app/<path>` URI into the BROKEN legacy
  // v0 API URL. Because those URLs got written into Firestore docs
  // (ReaderEdition.content / StoryLibrary / MagazinePage) we have to
  // read-side correct them at render time, not just fix the write path.
  let finalUrl = normalized;
  {
    // Pattern 1: broken firebasestorage.app → v0 REST API rewrite.
    // Example (bad):
    //   https://firebasestorage.googleapis.com/v0/b/<PROJ>.firebasestorage.app/o/<path>?alt=media
    // Correct modern URL for the same object:
    //   https://<PROJ>.firebasestorage.app/<path-with-spaces-encoded>
    const badFirebaseAliasRe =
      /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+?\.firebasestorage\.app)\/o\/([^?#]+)(?:\?[^#]*)?$/i;
    const badMatch = finalUrl.match(badFirebaseAliasRe);
    if (badMatch) {
      const [, aliasBucket, encObjPath] = badMatch;
      // The v0 API path /o/<enc> uses encodeURIComponent on every path
      // segment, which means slashes become %2F.  The modern direct CDN
      // endpoint wants real slashes + only spaces encoded (same as the
      // modern normalizeImageUrl output). So decode fully, then re-encode
      // only spaces.
      try {
        const decodedPath = decodeURIComponent(encObjPath.replace(/\+/g, ' '));
        const modernPath = decodedPath.replace(/ /g, '%20');
        finalUrl = `https://${aliasBucket}/${modernPath}`;
      } catch {
        // Decode failed (malformed percent-encoding) — keep original URL.
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

/**
 * Converts a standard Issuu URL to a robust embed URL.
 * Handles formats like:
 * - https://issuu.com/blackie365/docs/ybw_feb_2026
 * - https://e.issuu.com/embed.html?d=ybw_feb_2026&u=blackie365
 */
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
