// Ghost API configuration
import GhostAdminAPI from '@tryghost/admin-api';

const GHOST_API_URL = (process.env.NEXT_PUBLIC_GHOST_API_URL || 'https://yorkshirebusinesswoman.co.uk').replace(/\/$/, '');
const GHOST_CONTENT_API_KEY = process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || '61f6041a1f00410f9ac05a60a4';

// Initialize Admin API conditionally (only works on server-side with an Admin Key)
let ghostAdmin: any = null;
if (process.env.GHOST_ADMIN_API_KEY) {
  try {
    ghostAdmin = new GhostAdminAPI({
      url: GHOST_API_URL,
      key: process.env.GHOST_ADMIN_API_KEY,
      version: "v5.0"
    });
  } catch (error) {
    console.error("Failed to initialize Ghost Admin API:", error);
  }
}

/**
 * Fetch posts from Ghost using native fetch for better Next.js App Router support
 */
export async function getPosts(options?: { limit?: number | string; filter?: string; page?: number; order?: string }) {
  try {
    const url = new URL(`${GHOST_API_URL}/ghost/api/content/posts/`);
    url.searchParams.append('key', GHOST_CONTENT_API_KEY);
    url.searchParams.append('limit', options?.limit?.toString() || 'all');
    url.searchParams.append('include', 'tags,authors');
    
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
        revalidate: 3600, // Background rebuild every hour, but instantly purged by webhook
        tags: ['ghost-posts'] 
      }
    });

    if (!response.ok) {
      throw new Error(`Ghost API responded with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.posts || [];
  } catch (err) {
    console.error("Error fetching posts:", err);
    return [];
  }
}

/**
 * Fetch a single post by its slug
 */
export async function getSinglePost(postSlug: string) {
  try {
    const url = new URL(`${GHOST_API_URL}/ghost/api/content/posts/slug/${postSlug}/`);
    url.searchParams.append('key', GHOST_CONTENT_API_KEY);
    url.searchParams.append('include', 'tags,authors');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Version': 'v5.0'
      },
      next: { 
        revalidate: 3600,
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
    url.searchParams.append('limit', options?.limit?.toString() || 'all');
    
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
        revalidate: 3600,
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

/**
 * Fetch members from Ghost Admin API
 * REQUIRES: GHOST_ADMIN_API_KEY to be set in .env.local
 */
export async function getGhostMembers(options?: { limit?: number | string; filter?: string; page?: number }) {
  if (!ghostAdmin) {
    console.warn("Ghost Admin API is not initialized. Ensure GHOST_ADMIN_API_KEY is set in .env.local.");
    return [];
  }

  try {
    const members = await ghostAdmin.members.browse({
      limit: options?.limit || 'all',
      filter: options?.filter,
      page: options?.page
    });
    return members;
  } catch (err) {
    console.error("Error fetching Ghost members via Admin API:", err);
    return [];
  }
}

