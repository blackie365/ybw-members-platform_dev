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
      const path = rest.slice(slash + 1)
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      if (!bucket || !path) return '';
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${path}?alt=media`;
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
  //   - gs:// → public HTTPS firebasestorage.googleapis.com conversion
  //   - rejection of "undefined"/null/none sentinels.
  // Nothing more to rewrite here.
  let finalUrl = normalized;

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
