/**
 * Utility to convert various image URL formats to browser-safe public URLs.
 * Specifically handles Firebase Storage 'gs://' links and restricted GCS links.
 */
export function fixMagazineImageUrl(url: string): string {
  if (!url) return '';
  if (typeof url !== 'string') return '';

  // 1. Handle gs:// links
  if (url.startsWith('gs://')) {
    try {
      // Format: gs://bucket-name/path/to/file
      const parts = url.replace('gs://', '').split('/');
      const bucket = parts.shift();
      const path = parts.join('%2F'); // URL encode the path
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${path}?alt=media`;
    } catch (e) {
      console.error('Error parsing gs:// URL:', e);
      return url;
    }
  }

  // 2. Handle storage.googleapis.com links that might be restricted
  // Convert to firebasestorage.googleapis.com format which works better with Firebase auth/rules
  if (url.includes('storage.googleapis.com')) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const bucket = pathParts.shift();
      const path = pathParts.join('%2F');
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${path}?alt=media`;
    } catch (e) {
      return url;
    }
  }

  return url;
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
