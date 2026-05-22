'use server';

import GhostAdminAPI from '@tryghost/admin-api';

const GHOST_API_URL = (process.env.NEXT_PUBLIC_GHOST_API_URL || 'https://admin.yorkshirebusinesswoman.co.uk').replace(/\/$/, '');

function getGhostAdmin() {
  const key = process.env.GHOST_ADMIN_API_KEY;
  if (!key) {
    console.warn("GHOST_ADMIN_API_KEY is not set.");
    return null;
  }
  
  try {
    return new GhostAdminAPI({
      url: GHOST_API_URL,
      key: key,
      version: "v5.0"
    });
  } catch (error) {
    console.error("Failed to initialize Ghost Admin API:", error);
    return null;
  }
}

/**
 * Fetch members from Ghost Admin API
 * REQUIRES: GHOST_ADMIN_API_KEY to be set in .env.local
 */
export async function getGhostMembers(options?: { limit?: number | string; filter?: string; page?: number }) {
  const admin = getGhostAdmin();
  if (!admin) {
    console.warn("Ghost Admin API is not initialized. Ensure GHOST_ADMIN_API_KEY is set.");
    return [];
  }
  
  try {
    const members = await admin.members.browse(options);
    return members;
  } catch (error) {
    console.error("Error fetching ghost members:", error);
    return [];
  }
}

/**
 * Create a new draft article via Ghost Admin API
 */
export async function createDraftArticle({ title, html, customExcerpt }: { title: string, html: string, customExcerpt?: string }) {
  const admin = getGhostAdmin();
  if (!admin) {
    throw new Error("Ghost Admin API is not initialized. Please check GHOST_ADMIN_API_KEY.");
  }
  
  try {
    const response = await admin.posts.add({
      title,
      html,
      status: 'draft',
      custom_excerpt: customExcerpt,
      tags: ['Member Submission']
    }, { source: 'html' });
    
    return response;
  }
  catch (error) {
    console.error("Error creating draft article:", error);
    throw error;
  }
}

/**
 * Add a new member to Ghost via Admin API
 */
export async function addGhostMember(data: { email: string; name?: string; note?: string; labels?: string[] }) {
  const admin = getGhostAdmin();
  if (!admin) {
    console.warn("Ghost Admin API is not initialized. Cannot sync member to Ghost.");
    return null;
  }

  try {
    const member = await admin.members.add(data);
    return member;
  } catch (err: any) {
    // If the member already exists, we can safely ignore the error
    if (err.context && err.context.includes('Validation error, cannot save member. Validation failed for email.')) {
      console.log(`Ghost member ${data.email} already exists, skipping creation.`);
      return null;
    }
    console.error("Error adding Ghost member via Admin API:", err);
    throw err;
  }
}

/**
 * Update an existing member in Ghost via Admin API (e.g. to mark as paid via Stripe ID)
 */
export async function editGhostMember(id: string, data: any) {
  const admin = getGhostAdmin();
  if (!admin) {
    console.warn("Ghost Admin API is not initialized. Cannot edit member in Ghost.");
    return null;
  }

  try {
    const member = await admin.members.edit(Object.assign({}, data, { id }));
    return member;
  } catch (err) {
    console.error("Error editing Ghost member via Admin API:", err);
    return null;
  }
}
