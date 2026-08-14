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
      let bucket = rest.slice(0, slash);
      const rawPath = rest.slice(slash + 1);
      const safeSegmentEncodedPath = rawPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      if (!bucket || !rawPath) return '';

      // --- Firebase bucket-alias to real bucket name resolution ---------------
      //
      // PROBLEM: Since late 2023 the Firebase Admin SDK / gsutil URIs look like
      // `gs://<projectId>.firebasestorage.app/<path>`.
      // `<proj>.firebasestorage.app` is the Admin SDK bucket *alias* name. For
      // projects CREATED PRIOR to the late-2024 DNS changeover, there is NO
      // public DNS record that resolves this alias domain.  The browser
      // reports `net::ERR_NAME_NOT_RESOLVED` on URLs that try to fetch
      // `https://<alias.firebasestorage.app/…`.
      //
      // Live DevTools trace (see production ybw_frontend on
      // yorkshirebusinesswoman.co.uk confirmed this for their August 2026 issue
      // image `ybw_August_2026 23.15.05.jpg`.
      //
      // The REAL default GCS bucket id is always `<projectId>.appspot.com`
      // for every Firebase project (regardless of whether the Admin SDK
      // writes the alias spelling back in gs:// URIs). And they confirmed in
      // DevTools a *successful* image fetch of
      // `https://storage.googleapis.com/<projectId>.appspot.com/<path>`
      // worked for another image in the same bucket (`KF-Elbow Rooms Interior.jpg`).
      //
      // So we NORMALIZE all alias-style buckets in gs:// back to the REAL
      // `.<projectId>.appspot.com` spelling.
      //
      // Example rewrite:
      //   gs://newmembersdirectory130325.firebasestorage.app/path/file.jpg
      //   → bucket = newmembersdirectory130325.appspot.com
      const bucketLower = bucket.toLowerCase();
      if (bucketLower.endsWith('.firebasestorage.app')) {
        const projectIdPart = bucketLower.slice(0, -'.firebasestorage.app'.length);
        if (projectIdPart) bucket = `${projectIdPart}.appspot.com`;
      }

      // URL output: canonical Firebase Storage v0 REST API. Note: `storage.googleapis.com`
      // CDN URLs require the object to be publicly readable via IAM/storage rules,
      // which is the default for the default storage bucket on Firebase projects
      // with Blaze plan, but for rules-protected buckets the v0 API is
      // authoritative. So we emit the v0 API URL format, using the REAL bucket
      // name we derived above:
      //   https://firebasestorage.googleapis.com/v0/b/<REAL_BUCKET/o/<URL_ENCODED_OBJECT_PATH>?alt=media
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
  //   - gs:// → public HTTPS conversion (alias → real bucket name rewrite
  //     for *.firebasestorage.app Admin-SDK bucket aliases, then v0 REST API
  //     URL format with real bucket name)
  //   - rejection of "undefined"/null/none sentinels.
  //
  // One more read-side repair is needed: prior versions of
  // normalizeImageUrl (before this fix) already converted gs:// URIs to HTTPS
  // URLs in BROKEN form — for *.firebasestorage.app alias buckets they
  // emitted either (a) the unroutable direct-CDN form:
  //   https://<proj>.firebasestorage.app/<path>
  // or (b) the v0 REST API form but with the ALIAS bucket name (which 404s on
  // projects created before the DNS alias existed):
  //   https://firebasestorage.googleapis.com/v0/b/<proj>.firebasestorage.app/o/<enc>?alt=media
  //
  // Both of these URL forms are already stored in 100s of legacy Firestore
  // docs (StoryLibrary items, MagazinePage spread content, and ReaderEdition
  // published pages). We normalize them to the correct canonical URL at
  // render time so the admin doesn't need to re-publish / re-import:
  //   https://firebasestorage.googleapis.com/v0/b/<proj>.appspot.com/o/<enc>?alt=media
  let finalUrl = normalized;
  {
    // Pattern A: broken direct-CDN URL from PR #326.
    //   https://<proj>.firebasestorage.app/<path (spaces %20-encoded)>
    // Convert to canonical v0 REST API URL using real .appspot.com bucket.
    const badDirectRe =
      /^https:\/\/([^\/]+?\.firebasestorage\.app)\/([^?#]+)(?:\?[^#]*)?$/i;
    const badDirect = finalUrl.match(badDirectRe);
    if (badDirect) {
      const [, aliasBucket, rawPathEncoded] = badDirect;
      const bucketLower = aliasBucket.toLowerCase();
      const projectIdPart = bucketLower.endsWith('.firebasestorage.app')
        ? bucketLower.slice(0, -'.firebasestorage.app'.length)
        : null;
      if (projectIdPart) {
        try {
          const realBucket = `${projectIdPart}.appspot.com`;
          // Raw path has spaces encoded to %20; decode fully then re-encode
          // every segment (safeSegmentEncodedPath form) for the v0 API /o/.
          const decPath = decodeURIComponent(rawPathEncoded.replace(/\+/g, ' '));
          const safe = decPath.split('/').map(s => encodeURIComponent(s)).join('/');
          finalUrl = `https://firebasestorage.googleapis.com/v0/b/${realBucket}/o/${safe}?alt=media`;
        } catch {
          // keep original
        }
      }
    }

    // Pattern B: broken v0 REST API URL using the ALIAS bucket name.
    //   https://firebasestorage.googleapis.com/v0/b/<proj>.firebasestorage.app/o/<enc>[?alt=media]
    // Rewrite the bucket name to real .appspot.com spelling.
    const badRestAliasRe =
      /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+?\.firebasestorage\.app)\/o\/([^?#]+)(?:\?[^#]*)?$/i;
    const badRest = finalUrl.match(badRestAliasRe);
    if (badRest) {
      const [, aliasBucket, encObjPath] = badRest;
      const bucketLower = aliasBucket.toLowerCase();
      if (bucketLower.endsWith('.firebasestorage.app')) {
        const projectIdPart = bucketLower.slice(0, -'.firebasestorage.app'.length);
        if (projectIdPart) {
          const realBucket = `${projectIdPart}.appspot.com`;
          // Preserve the existing object-path encoding (already correct).
          finalUrl = `https://firebasestorage.googleapis.com/v0/b/${realBucket}/o/${encObjPath}?alt=media`;
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
