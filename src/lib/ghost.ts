import Parser from 'rss-parser';

// Ghost API configuration
function normalizeBaseUrl(raw: string | undefined) {
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

type RssItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  categories?: string[];
  creator?: string;
  'dc:creator'?: string;
  'content:encoded'?: string;
  enclosure?: { url?: string };
};

function extractSlugFromUrl(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return decodeURIComponent(last);
  } catch {
    const parts = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }
}

function extractFirstImageUrl(html: string) {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || '';
}

function mapRssItemToGhostPostLike(item: RssItem) {
  const html = String(item['content:encoded'] || item.content || '').trim();
  const link = String(item.link || '').trim();
  const slug = link ? extractSlugFromUrl(link) : '';
  const categories = Array.isArray(item.categories) ? item.categories : [];
  const primaryTagName = String(categories[0] || '').trim();
  const creator = String(item.creator || item['dc:creator'] || '').trim();
  const featureImage = String(item.enclosure?.url || '').trim() || extractFirstImageUrl(html);
  const publishedAt = String(item.isoDate || item.pubDate || '').trim();
  const id = String(item.guid || link || slug).trim();

  return {
    id,
    title: String(item.title || '').trim(),
    slug,
    html,
    excerpt: String(item.contentSnippet || '').trim(),
    feature_image: featureImage || undefined,
    published_at: publishedAt || undefined,
    primary_tag: primaryTagName ? { name: primaryTagName, slug: primaryTagName.toLowerCase().replace(/\s+/g, '-') } : null,
    authors: creator ? [{ name: creator }] : [],
  };
}

function parseTagFilter(filter: string | undefined) {
  if (!filter) return [];
  const rawParts = filter.split(',').map(p => p.trim()).filter(Boolean);
  const tagParts = rawParts
    .filter(p => p.startsWith('tag:'))
    .map(p => p.slice('tag:'.length))
    .filter(Boolean)
    .map(t => t.replace(/^hash-/, '#'));
  return tagParts;
}

async function getPostsFromRss(options?: { limit?: number | string; filter?: string; page?: number }) {
  const siteUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk');
  const rssUrl = `${siteUrl}/rss/`;

  const parser = new Parser({
    customFields: {
      item: ['content:encoded', 'dc:creator'],
    },
  });

  const res = await fetch(rssUrl, {
    next: { revalidate: 60, tags: ['ghost-posts'] },
    headers: { 'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' },
  });
  if (!res.ok) {
    throw new Error(`Ghost RSS responded with status: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const feed = await parser.parseString(xml);

  const items = (feed.items || []) as unknown as RssItem[];
  const tagFilters = parseTagFilter(options?.filter);

  const mapped = items
    .map(mapRssItemToGhostPostLike)
    .filter(p => p.slug)
    .filter(p => {
      if (tagFilters.length === 0) return true;
      const primary = p.primary_tag?.name ? String(p.primary_tag.name).toLowerCase() : '';
      return tagFilters.some(t => primary === t.toLowerCase());
    });

  const limitRaw = options?.limit || 15;
  const limit = typeof limitRaw === 'number' ? limitRaw : Number(limitRaw);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 15;
  const page = typeof options?.page === 'number' && options.page > 0 ? options.page : 1;

  const start = (page - 1) * safeLimit;
  const slice = mapped.slice(start, start + safeLimit);

  (slice as any).meta = {
    pagination: {
      page,
      limit: safeLimit,
      pages: Math.max(1, Math.ceil(mapped.length / safeLimit)),
      total: mapped.length,
      next: start + safeLimit < mapped.length ? page + 1 : null,
      prev: page > 1 ? page - 1 : null,
    },
    next: start + safeLimit < mapped.length ? page + 1 : null,
    prev: page > 1 ? page - 1 : null,
  };

  return slice as any[];
}

/**
 * Fetch posts from Ghost using native fetch for better Next.js App Router support
 */
export async function getPosts(options?: { limit?: number | string; filter?: string; page?: number; order?: string }) {
  try {
    if (!GHOST_CONTENT_API_KEY) {
      return await getPostsFromRss(options);
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
      const posts = await getPostsFromRss({ limit: 100 });
      const match = posts.find((p: any) => String(p.slug || '').trim() === postSlug);
      return match || null;
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
