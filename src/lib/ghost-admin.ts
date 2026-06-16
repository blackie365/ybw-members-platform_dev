'use server';

import GhostAdminAPI from '@tryghost/admin-api';

function normalizeBaseUrl(raw: string | undefined) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const withProtocol = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
  return withProtocol.replace(/\/$/, '');
}

const GHOST_API_URL = normalizeBaseUrl(
  process.env.GHOST_ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_GHOST_API_URL ||
    process.env.GHOST_API_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://yorkshirebusinesswoman.co.uk'
);

function getGhostAdmin() {
  const key = process.env.GHOST_ADMIN_API_KEY || process.env.GHOST_ADMIN_KEY;
  if (!key) {
    console.warn("Ghost Admin API key not found in GHOST_ADMIN_API_KEY or GHOST_ADMIN_KEY.");
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
export async function createDraftArticle({ title, html, customExcerpt, featureImage }: { title: string, html: string, customExcerpt?: string, featureImage?: string }) {
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
      feature_image: featureImage,
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
    // Explicitly set newsletters to empty array to prevent Ghost from sending its default newsletter
    const member = await admin.members.add({
      ...data,
      newsletters: []
    });
    return member;
  } catch (err: any) {
    // Ghost sync is non-critical, so we swallow all errors here to prevent
    // crashing the main subscription flow. We just log them for debugging.
    console.warn("Ghost member sync skipped or failed:", err.message || err);
    return null;
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

/**
 * Upgrade a member to paid status by email
 */
export async function upgradeGhostMemberByEmail(email: string, tierLabel: string) {
  const admin = getGhostAdmin();
  if (!admin) return null;

  try {
    const members = await admin.members.browse({ filter: `email:'${email}'` });
    if (members && members.length > 0) {
      const member = members[0];
      const currentLabels = member.labels.map((l: any) => l.name || l);
      const newLabels = currentLabels.filter((l: string) => !['free-member'].includes(l));
      
      if (!newLabels.includes('paid-member')) newLabels.push('paid-member');
      if (!newLabels.includes('stripe-upgrade')) newLabels.push('stripe-upgrade');
      if (!newLabels.includes(tierLabel)) newLabels.push(tierLabel);

      return await admin.members.edit({
        id: member.id,
        labels: newLabels,
        comped: true
      });
    } else {
      // If they somehow don't exist, create them as paid
      return await admin.members.add({
        email,
        labels: ['stripe-upgrade', 'paid-member', tierLabel],
        comped: true,
        newsletters: []
      });
    }
  } catch (err) {
    console.error("Error upgrading Ghost member:", err);
    return null;
  }
}
