'use server';

import { getGhostMembers } from "@/lib/ghost-admin";

export async function getGhostStatsAction() {
  try {
    const members = await getGhostMembers({ limit: 'all' });
    
    if (!members || !Array.isArray(members)) {
      return { total: 0, newsletter: 0 };
    }

    // Total Ghost members (includes newsletter signups + full members)
    const total = members.length;
    
    // Specifically count newsletter subscribers (those with 'newsletter-signup' label or just anyone in Ghost since Ghost is our newsletter source)
    const newsletter = total; 

    return {
      total,
      newsletter
    };
  } catch (error) {
    console.error("Error in getGhostStatsAction:", error);
    return { total: 0, newsletter: 0 };
  }
}
