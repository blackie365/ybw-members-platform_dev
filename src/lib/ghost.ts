// Ghost API configuration
const GHOST_API_URL = (process.env.NEXT_PUBLIC_GHOST_API_URL || 'https://admin.yorkshirebusinesswoman.co.uk').replace(/\/$/, '');
const GHOST_CONTENT_API_KEY = process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || '61f6041a1f00410f9ac05a60a4';

/**
 * Fetch posts from Ghost using native fetch for better Next.js App Router support
 */
export async function getPosts(options?: { limit?: number | string; filter?: string; page?: number; order?: string }) {
  try {
    const url = new URL(`${GHOST_API_URL}/ghost/api/content/posts/`);
    url.searchParams.append('key', GHOST_CONTENT_API_KEY);
    
    // Safety: Default to 15 posts if no limit is provided, and never exceed 100 in a single request.
    // This prevents performance issues with categories that have hundreds of articles.
    let limit = options?.limit || 15;
    if (typeof limit === 'number' && limit > 100) limit = 100;
    
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('include', 'tags,authors');
    url.searchParams.append('formats', 'html,plaintext');
    
    if (options?.filter) {
      url.searchParams.append('filter', options.filter);
    }
    if (options?.page) {
      url.searchParams.append('page', options.page.toString());
    }
    if (options?.order) {
      url.searchParams.append('order', options.order);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Version': 'v5.0'
      },
      next: { 
        revalidate: 60, // Revalidate every minute, but can also be purged by webhook
        tags: ['ghost-posts'] 
      }
    });

    if (!response.ok) {
      throw new Error(`Ghost API responded with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Attach pagination metadata to the array so we can access it without breaking existing map() calls
    const posts = data.posts || [];
    if (data.meta && data.meta.pagination) {
      posts.meta = data.meta.pagination;
    }
    
    return posts;
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
    const url = new URL(`${GHOST_API_URL}/ghost/api/content/pages/slug/${pageSlug}/`);
    url.searchParams.append('key', GHOST_CONTENT_API_KEY);

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Version': 'v5.0'
      },
      next: { 
        revalidate: 60,
        tags: ['ghost-pages', `ghost-page-${pageSlug}`]
      }
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Ghost API responded with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.pages?.[0] || null;
  } catch (err) {
    console.error("Error fetching single page:", err);
    return null;
  }
}
export async function getSinglePost(postSlug: string) {
  try {
    const url = new URL(`${GHOST_API_URL}/ghost/api/content/posts/slug/${postSlug}/`);
    url.searchParams.append('key', GHOST_CONTENT_API_KEY);
    url.searchParams.append('include', 'tags,authors');
    url.searchParams.append('formats', 'html,plaintext');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Version': 'v5.0'
      },
      next: { 
        revalidate: 60,
        tags: ['ghost-posts', `ghost-post-${postSlug}`]
      }
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Ghost API responded with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.posts?.[0] || null;
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
    const url = new URL(`${GHOST_API_URL}/ghost/api/content/tags/`);
    url.searchParams.append('key', GHOST_CONTENT_API_KEY);
    
    // Safety: Default to 20 tags and cap at 100
    let limit = options?.limit || 20;
    if (typeof limit === 'number' && limit > 100) limit = 100;
    
    url.searchParams.append('limit', limit.toString());
    
    if (options?.include) {
      url.searchParams.append('include', options.include);
    }
    if (options?.order) {
      url.searchParams.append('order', options.order);
    }
    if (options?.filter) {
      url.searchParams.append('filter', options.filter);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Version': 'v5.0'
      },
      next: { 
        revalidate: 60,
        tags: ['ghost-tags']
      }
    });

    if (!response.ok) {
      throw new Error(`Ghost API responded with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.tags || [];
  } catch (err) {
    console.error("Error fetching tags:", err);
    return [];
  }
}

