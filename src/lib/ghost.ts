// Ghost API configuration
export function normalizeBaseUrl(raw: string | undefined) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const withProtocol = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
  return withProtocol.replace(/\/$/, '');
}

const GHOST_CONTENT_API_KEY = process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || process.env.GHOST_CONTENT_API_KEY;

function requireGhostContentKey() {
  const trimmed = String(GHOST_CONTENT_API_KEY || '').trim();
  if (!trimmed) {
    throw new Error('Missing Ghost Content API key (NEXT_PUBLIC_GHOST_CONTENT_API_KEY or GHOST_CONTENT_API_KEY)');
  }
  return trimmed;
}

function getGhostBaseCandidates() {
  const candidates = new Set<string>();

  const explicit = normalizeBaseUrl(process.env.NEXT_PUBLIC_GHOST_API_URL || process.env.GHOST_API_URL);
  if (explicit) candidates.add(explicit);

  const site = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk');
  if (site) candidates.add(site);

  for (const base of [explicit, site, 'https://yorkshirebusinesswoman.co.uk', 'https://admin.yorkshirebusinesswoman.co.uk']) {
    if (!base) continue;
    candidates.add(base);
    try {
      const u = new URL(base);
      if (u.hostname.startsWith('admin.')) {
        u.hostname = u.hostname.replace(/^admin\./, '');
        candidates.add(normalizeBaseUrl(u.toString()));
      } else {
        u.hostname = `admin.${u.hostname}`;
        candidates.add(normalizeBaseUrl(u.toString()));
      }
    } catch {}
  }

  return Array.from(candidates).filter(Boolean);
}

/**
 * Fetch posts from Ghost using native fetch for better Next.js App Router support
 */
export async function getPosts(options?: { limit?: number | string; filter?: string; page?: number; order?: string }) {
  try {
    if (!GHOST_CONTENT_API_KEY) {
      console.warn('[Ghost] Content API key not configured — returning empty posts');
      return [];
    }

    let lastError: unknown;
    for (const base of getGhostBaseCandidates()) {
      try {
        const url = new URL(`${base}/ghost/api/content/posts/`);
        url.searchParams.append('key', requireGhostContentKey());

        let limit = options?.limit || 15;
        if (typeof limit === 'number' && limit > 100) limit = 100;

        url.searchParams.append('limit', limit.toString());
        url.searchParams.append('include', 'tags,authors');
        url.searchParams.append('formats', 'html,plaintext');

        if (options?.filter) url.searchParams.append('filter', options.filter);
        if (options?.page) url.searchParams.append('page', options.page.toString());
        if (options?.order) url.searchParams.append('order', options.order);

        const response = await fetch(url.toString(), {
          headers: { 'Accept-Version': 'v5.0' },
          next: { revalidate: 60, tags: ['ghost-posts'] },
        });

        if (!response.ok) {
          lastError = new Error(`Ghost API responded with status: ${response.status} ${response.statusText} (${base})`);
          continue;
        }

        const data = await response.json();
        const posts = data.posts || [];
        if (data.meta && data.meta.pagination) posts.meta = data.meta.pagination;
        return posts;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to fetch Ghost posts');
  } catch (err) {
    console.error("Error fetching posts:", err);
    return [];
  }
}

/**
 * Fetch a single page by its slug
 */
export async function getPage(pageSlug: string) {
  try {
    if (!GHOST_CONTENT_API_KEY) return null;

    let lastError: unknown;
    for (const base of getGhostBaseCandidates()) {
      try {
        const url = new URL(`${base}/ghost/api/content/pages/slug/${pageSlug}/`);
        url.searchParams.append('key', requireGhostContentKey());

        const response = await fetch(url.toString(), {
          headers: { 'Accept-Version': 'v5.0' },
          next: { revalidate: 60, tags: ['ghost-pages', `ghost-page-${pageSlug}`] },
        });

        if (!response.ok) {
          if (response.status === 404) return null;
          lastError = new Error(`Ghost API responded with status: ${response.status} ${response.statusText} (${base})`);
          continue;
        }

        const data = await response.json();
        return data.pages?.[0] || null;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to fetch Ghost page');
  } catch (err) {
    console.error("Error fetching single page:", err);
    return null;
  }
}
export async function getSinglePost(postSlug: string) {
  try {
    if (!GHOST_CONTENT_API_KEY) {
      console.warn('[Ghost] Content API key not configured — returning null for single post');
      return null;
    }

    let lastError: unknown;
    for (const base of getGhostBaseCandidates()) {
      try {
        const url = new URL(`${base}/ghost/api/content/posts/slug/${postSlug}/`);
        url.searchParams.append('key', requireGhostContentKey());
        url.searchParams.append('include', 'tags,authors');
        url.searchParams.append('formats', 'html,plaintext');

        const response = await fetch(url.toString(), {
          headers: { 'Accept-Version': 'v5.0' },
          next: { revalidate: 60, tags: ['ghost-posts', `ghost-post-${postSlug}`] },
        });

        if (!response.ok) {
          if (response.status === 404) return null;
          lastError = new Error(`Ghost API responded with status: ${response.status} ${response.statusText} (${base})`);
          continue;
        }

        const data = await response.json();
        return data.posts?.[0] || null;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to fetch Ghost post');
  } catch (err) {
    console.error("Error fetching single post:", err);
    return null;
  }
}

/**
 * Fetch public tags from Ghost, optionally ordered by post count
 */
export async function getTags(options?: { limit?: number | string; include?: string; order?: string; filter?: string }) {
  try {
    if (!GHOST_CONTENT_API_KEY) return [];

    let lastError: unknown;
    for (const base of getGhostBaseCandidates()) {
      try {
        const url = new URL(`${base}/ghost/api/content/tags/`);
        url.searchParams.append('key', requireGhostContentKey());

        let limit = options?.limit || 20;
        if (typeof limit === 'number' && limit > 100) limit = 100;
        url.searchParams.append('limit', limit.toString());

        if (options?.include) url.searchParams.append('include', options.include);
        if (options?.order) url.searchParams.append('order', options.order);
        if (options?.filter) url.searchParams.append('filter', options.filter);

        const response = await fetch(url.toString(), {
          headers: { 'Accept-Version': 'v5.0' },
          next: { revalidate: 60, tags: ['ghost-tags'] },
        });

        if (!response.ok) {
          lastError = new Error(`Ghost API responded with status: ${response.status} ${response.statusText} (${base})`);
          continue;
        }

        const data = await response.json();
        return data.tags || [];
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to fetch Ghost tags');
  } catch (err) {
    console.error("Error fetching tags:", err);
    return [];
  }
}
