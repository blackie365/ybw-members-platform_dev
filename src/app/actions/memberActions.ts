'use server';

import { adminDb } from "@/lib/firebase-admin";
import { addGhostMember, getGhostMembers } from "@/lib/ghost-admin";
import { revalidatePath } from "next/cache";
import { checkAdmin } from "@/lib/server/auth-utils";
import Stripe from "stripe";

export async function getMembersAction() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('newMemberCollection')
      .where('userInactive', '==', false)
      .orderBy('createdAt', 'desc')
      .get();

    const members = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, data: members };
  } catch (error: any) {
    console.error("Error in getMembersAction:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleFeaturedStatus(memberId: string, status: boolean) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const memberRef = adminDb.collection('newMemberCollection').doc(memberId);
    
    if (status) {
      const snapshot = await adminDb.collection('newMemberCollection')
        .where('isFeatured', '==', true)
        .get();
      
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isFeatured: false });
      });
      await batch.commit();
    }

    await memberRef.update({ 
      isFeatured: status,
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/directory');

    return { success: true };
  } catch (error: any) {
    console.error("Error in toggleFeaturedStatus:", error);
    return { success: false, error: error.message };
  }
}

export async function getAnalyticsData() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('newMemberCollection').get();
    const totalMembers = snapshot.docs.filter(d => !d.data().userInactive).length;
    const totalInactive = snapshot.size - totalMembers;

    const ghostMembers = await getGhostMembers({ limit: 'all' });
    const totalGhostMembers = Array.isArray(ghostMembers) ? ghostMembers.length : 0;

    // Fetch Beehiiv Stats if possible
    let beehiivStats = { totalSubscribers: 0, activeSubscribers: 0 };
    try {
      const response = await fetch(`https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}`, {
        headers: {
          'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        beehiivStats.totalSubscribers = data.data?.stats?.total_subscribers || 0;
        beehiivStats.activeSubscribers = data.data?.stats?.active_subscribers || 0;
      }
    } catch (e) {
      console.error("Failed to fetch Beehiiv stats:", e);
    }

    const eventsSnapshot = await adminDb.collection('events').get();
    const totalEvents = eventsSnapshot.size;

    const tierCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      const tier = doc.data().membershipTier || 'free';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    const industryCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      const industry = doc.data().industrySector || 'Other';
      industryCounts[industry] = (industryCounts[industry] || 0) + 1;
    });

    const locationCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      if (doc.data().userInactive) return;
      let loc = doc.data().location || doc.data().city || 'Unknown';
      
      loc = loc.toString().split(',')[0].split('/')[0].trim();
      if (loc.toLowerCase() === 'wakefield') loc = 'Wakefield';
      if (loc.toLowerCase() === 'leeds') loc = 'Leeds';
      if (loc.toLowerCase() === 'huddersfield') loc = 'Huddersfield';
      if (loc.toLowerCase() === 'harrogate') loc = 'Harrogate';
      if (loc.toLowerCase() === 'manchester') loc = 'Manchester';
      if (loc.toLowerCase() === 'york') loc = 'York';
      
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    // Calculate actual growth by month
    const now = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        platform: 0,
        ghost: 0,
        total: 0
      };
    });

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userInactive || !data.createdAt) return;
      const createdDate = new Date(data.createdAt);
      
      last6Months.forEach(m => {
        if (createdDate.getFullYear() === m.year && createdDate.getMonth() === m.month) {
          m.platform++;
        }
      });
    });

    // For Ghost members, we'll distribute them for now as we don't have historical API data easily
    // but we can at least show real platform growth
    const membersByMonth = last6Months.map(m => ({
      name: m.name,
      platform: m.platform,
      ghost: Math.floor(totalGhostMembers / 6), // still averaged for Ghost
      total: m.platform + Math.floor(totalGhostMembers / 6)
    }));

    return {
      success: true,
      data: {
        totalMembers,
        totalGhostMembers,
        totalBeehiivMembers: beehiivStats.totalSubscribers,
        activeBeehiivMembers: beehiivStats.activeSubscribers,
        totalEvents,
        totalMessages: 0,
        membersByTier: Object.entries(tierCounts).map(([name, value]) => ({ name, value })),
        membersByIndustry: Object.entries(industryCounts).map(([name, value]) => ({ name, value })).slice(0, 8),
        membersByLocation: Object.entries(locationCounts).map(([name, value]) => ({ name, value })).slice(0, 8),
        platformStatusData: [
          { name: 'Active', value: totalMembers },
          { name: 'Inactive', value: totalInactive }
        ],
        ghostStatusData: [
          { name: 'Ghost', value: totalGhostMembers },
          { name: 'Beehiiv', value: beehiivStats.totalSubscribers }
        ],
        membersByMonth,
        eventAttendance: []
      }
    };
  } catch (error: any) {
    console.error("Error in getAnalyticsData:", error);
    return { success: false, error: error.message };
  }
}

type MemberDoc = {
  membershipTier?: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  stripeSubscriptionId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  email?: string;
  emailLower?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  ghostSyncedAt?: string;
  role?: string;
  isAdmin?: boolean;
  isFeatured?: boolean;
  isNewsletterAuthorized?: boolean;
  newsletterSubscribed?: boolean;
  isNewsletterRecipient?: boolean;
  industrySector?: string;
  location?: string;
};

function tierRank(tier: string | undefined): number {
  switch (tier) {
    case 'founder':
      return 6;
    case 'premium':
      return 5;
    case 'paid_annual':
      return 4;
    case 'paid_monthly':
      return 3;
    case 'complimentary':
      return 2;
    case 'free':
    default:
      return 1;
  }
}

function hasPaidIdentity(data: MemberDoc): boolean {
  return Boolean(data?.stripeCustomerId || data?.subscriptionId || data?.stripeSubscriptionId);
}

function getDateValue(value: unknown): number {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }

  return 0;
}

function safeIso(value: unknown): string | undefined {
  const dateValue = getDateValue(value);
  return dateValue > 0 ? new Date(dateValue).toISOString() : undefined;
}

function choosePrimary(docs: Array<{ id: string; data: MemberDoc }>) {
  const scored = docs.map((d) => {
    const idIsClerk = d.id.startsWith('user_');
    const paid = hasPaidIdentity(d.data);
    const rank = tierRank(d.data.membershipTier);
    const updatedAt = safeIso(d.data.updatedAt) || safeIso(d.data.createdAt) || '';
    const score =
      (idIsClerk ? 1000 : 0) +
      (paid ? 500 : 0) +
      rank * 10 +
      (updatedAt ? 1 : 0);
    return { ...d, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

export async function repairMemberDuplicatesByEmailAction(email: string) {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");
    if (typeof email !== 'string' || !email.includes('@')) {
      return { success: false, error: 'Valid email is required' };
    }

    const emailLower = email.toLowerCase();
    const ref = adminDb.collection('newMemberCollection');

    let snap = await ref.where('emailLower', '==', emailLower).get();
    if (snap.empty) {
      snap = await ref.where('email', '==', email).get();
    }

    if (snap.empty || snap.size === 1) {
      return { success: true, repaired: false, merged: 0 };
    }

    const docs = snap.docs.map((d) => ({ id: d.id, data: (d.data() as MemberDoc) || {} }));
    const primary = choosePrimary(docs);
    const nowIso = new Date().toISOString();

    const merged: Record<string, any> = {
      email: primary.data.email || email,
      emailLower,
      updatedAt: nowIso,
    };

    let bestTier = primary.data.membershipTier;
    let earliestCreatedAt = safeIso(primary.data.createdAt);

    for (const { id, data } of docs) {
      if (tierRank(data.membershipTier) > tierRank(bestTier)) bestTier = data.membershipTier;
      const createdAt = safeIso(data.createdAt);
      if (createdAt && (!earliestCreatedAt || new Date(createdAt) < new Date(earliestCreatedAt))) {
        earliestCreatedAt = createdAt;
      }

      const fieldsToCarry: Array<keyof MemberDoc> = [
        'firstName',
        'lastName',
        'displayName',
        'industrySector',
        'location',
        'newsletterSubscribed',
        'isNewsletterRecipient',
        'isNewsletterAuthorized',
        'role',
        'isAdmin',
        'isFeatured',
        'stripeCustomerId',
        'subscriptionId',
        'stripeSubscriptionId',
        'ghostSyncedAt',
      ];

      for (const field of fieldsToCarry) {
        if (merged[field] !== undefined) continue;
        const v = (data as any)[field];
        if (v !== undefined && v !== null && v !== '') merged[field] = v;
      }
    }

    if (bestTier) merged.membershipTier = bestTier;
    if (earliestCreatedAt) merged.createdAt = earliestCreatedAt;

    const batch = adminDb.batch();
    const primaryRef = ref.doc(primary.id);
    batch.set(primaryRef, merged, { merge: true });

    for (const doc of snap.docs) {
      if (doc.id === primary.id) continue;
      batch.delete(doc.ref);
    }

    await batch.commit();

    try {
      const fresh = await primaryRef.get();
      const freshData = (fresh.data() as MemberDoc) || {};
      if (!freshData.ghostSyncedAt) {
        const firstName = typeof freshData.firstName === 'string' ? freshData.firstName : '';
        const lastName = typeof freshData.lastName === 'string' ? freshData.lastName : '';
        const displayName = typeof freshData.displayName === 'string'
          ? freshData.displayName
          : `${firstName} ${lastName}`.trim();

        const res = await addGhostMember({
          email: emailLower,
          name: displayName || undefined,
          labels: ['admin-repair'],
        });
        if (res) {
          await primaryRef.set({ ghostSyncedAt: nowIso }, { merge: true });
        }
      }
    } catch (ghostErr) {
      console.warn('Ghost sync during repair failed (non-critical):', ghostErr);
    }

    revalidatePath('/admin/members');
    return { success: true, repaired: true, primaryId: primary.id, merged: snap.size - 1 };
  } catch (error: any) {
    console.error("Error in repairMemberDuplicatesByEmailAction:", error);
    return { success: false, error: error.message };
  }
}

type GhostMemberRecord = {
  id?: string;
  uuid?: string;
  email?: string;
  name?: string;
  note?: string;
  labels?: Array<{ name?: string } | string>;
  tiers?: Array<{ id?: string; name?: string }>;
};

type AuditMemberRecord = MemberDoc & {
  status?: string;
  userInactive?: boolean;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function buildDisplayName(data: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}) {
  const displayName = typeof data.displayName === "string" ? data.displayName.trim() : "";
  if (displayName) return displayName;

  const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
  if (fullName) return fullName;

  return data.email || "Unknown member";
}

function getAppMembershipView(tier: string | undefined) {
  switch (tier) {
    case "paid_annual":
      return { status: "paid" as const, interval: "yearly" as const, label: "Paid yearly" };
    case "paid_monthly":
      return { status: "paid" as const, interval: "monthly" as const, label: "Paid monthly" };
    case "complimentary":
      return { status: "paid" as const, interval: null, label: "Paid (complimentary)" };
    case "founder":
      return { status: "paid" as const, interval: null, label: "Paid (founder)" };
    case "premium":
      return { status: "paid" as const, interval: null, label: "Paid (legacy)" };
    case "free":
    default:
      return { status: "free" as const, interval: null, label: "Free" };
  }
}

function getStripeStatusPriority(status: string | undefined) {
  switch (status) {
    case "active":
      return 6;
    case "trialing":
      return 5;
    case "past_due":
      return 4;
    case "unpaid":
      return 3;
    case "paused":
      return 2;
    case "incomplete":
      return 1;
    case "canceled":
      return 0;
    case "incomplete_expired":
    default:
      return -1;
  }
}

function pickBestSubscription(subscriptions: Stripe.Subscription[]) {
  return [...subscriptions].sort((a, b) => {
    const statusDiff = getStripeStatusPriority(b.status) - getStripeStatusPriority(a.status);
    if (statusDiff !== 0) return statusDiff;

    const bEnd = typeof (b as any).current_period_end === "number" ? (b as any).current_period_end : 0;
    const aEnd = typeof (a as any).current_period_end === "number" ? (a as any).current_period_end : 0;
    if (bEnd !== aEnd) return bEnd - aEnd;

    return (b.created || 0) - (a.created || 0);
  })[0] || null;
}

function getStripeInterval(subscription: Stripe.Subscription | null) {
  if (!subscription) return null;
  const interval =
    subscription.items.data[0]?.price?.recurring?.interval ||
    (subscription as any)?.plan?.interval ||
    null;

  if (interval === "year") return "yearly";
  if (interval === "month") return "monthly";
  return null;
}

function toIsoDateFromUnix(value: unknown) {
  if (typeof value !== "number") return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getStripePlanLabel(subscription: Stripe.Subscription | null) {
  if (!subscription) return "No Stripe subscription";

  const interval = getStripeInterval(subscription);
  if (subscription.status === "active" || subscription.status === "trialing") {
    if (interval === "yearly") return "Paid yearly";
    if (interval === "monthly") return "Paid monthly";
    return "Paid";
  }

  if (subscription.status === "canceled") return "Cancelled";
  if (subscription.status === "past_due") return "Past due";
  if (subscription.status === "unpaid") return "Unpaid";
  if (subscription.status === "paused") return "Paused";
  if (subscription.status === "incomplete") return "Incomplete";

  return subscription.status;
}

function getGhostLabels(member: GhostMemberRecord | null) {
  if (!member || !Array.isArray(member.labels)) return [];

  return member.labels
    .map((label) => (typeof label === "string" ? label : label?.name || ""))
    .map((label) => label.trim())
    .filter(Boolean);
}

function hasLiveStripeSubscription(subscription: Stripe.Subscription | null) {
  return Boolean(
    subscription &&
      ["active", "trialing", "past_due", "unpaid"].includes(subscription.status)
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

export async function getMembershipAuditAction() {
  try {
    await checkAdmin();
    if (!adminDb) throw new Error("Database not initialized");

    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
    const ghostConfigured = Boolean(process.env.GHOST_ADMIN_API_KEY || process.env.GHOST_ADMIN_KEY);

    const stripe = stripeConfigured
      ? new Stripe(process.env.STRIPE_SECRET_KEY as string, {
          apiVersion: "2023-10-16" as any,
        })
      : null;

    const membersSnapshot = await adminDb.collection("newMemberCollection").get();

    const appMembers = membersSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as AuditMemberRecord),
      }))
      .filter((member) => member.userInactive !== true)
      .sort((a, b) => {
        const aCreated = getDateValue(a.createdAt);
        const bCreated = getDateValue(b.createdAt);
        return bCreated - aCreated;
      });

    const ghostMembersRaw = ghostConfigured ? await getGhostMembers({ limit: "all" }) : [];
    const ghostMembers = Array.isArray(ghostMembersRaw)
      ? (ghostMembersRaw as GhostMemberRecord[])
      : [];

    const ghostByEmail = new Map<string, GhostMemberRecord>();
    for (const member of ghostMembers) {
      const emailLower = normalizeEmail(member.email);
      if (emailLower && !ghostByEmail.has(emailLower)) {
        ghostByEmail.set(emailLower, member);
      }
    }

    const customerCache = new Map<string, Stripe.Customer | null>();
    const subscriptionCache = new Map<string, Stripe.Subscription | null>();

    const rows = await mapWithConcurrency(appMembers, 5, async (member) => {
      const emailLower = normalizeEmail(member.email || member.emailLower);
      const displayName = buildDisplayName({
        displayName: member.displayName,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      });
      const appMembership = getAppMembershipView(member.membershipTier);
      const ghostMember = emailLower ? ghostByEmail.get(emailLower) || null : null;
      const ghostLabels = getGhostLabels(ghostMember);

      let stripeCustomerId =
        typeof member.stripeCustomerId === "string" ? member.stripeCustomerId : null;
      let stripeSubscriptionId =
        typeof member.subscriptionId === "string"
          ? member.subscriptionId
          : typeof member.stripeSubscriptionId === "string"
            ? member.stripeSubscriptionId
            : null;
      let stripeSubscription: Stripe.Subscription | null = null;

      if (stripe && emailLower) {
        if (!stripeCustomerId) {
          if (customerCache.has(emailLower)) {
            const cachedCustomer = customerCache.get(emailLower);
            stripeCustomerId = cachedCustomer?.id || null;
          } else {
            const customers = await stripe.customers.list({
              email: member.email || emailLower,
              limit: 10,
            });
            const matchedCustomer =
              customers.data.find(
                (customer) =>
                  !("deleted" in customer) &&
                  normalizeEmail(customer.email) === emailLower
              ) ||
              customers.data.find((customer) => !("deleted" in customer)) ||
              null;

            customerCache.set(emailLower, matchedCustomer);
            stripeCustomerId = matchedCustomer?.id || null;
          }
        }

        if (stripeSubscriptionId) {
          if (subscriptionCache.has(stripeSubscriptionId)) {
            stripeSubscription = subscriptionCache.get(stripeSubscriptionId) || null;
          } else {
            try {
              stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
              subscriptionCache.set(stripeSubscriptionId, stripeSubscription);
            } catch (error) {
              console.warn(`Failed to retrieve Stripe subscription ${stripeSubscriptionId}:`, error);
              subscriptionCache.set(stripeSubscriptionId, null);
            }
          }
        }

        if (!stripeSubscription && stripeCustomerId) {
          if (subscriptionCache.has(`customer:${stripeCustomerId}`)) {
            stripeSubscription = subscriptionCache.get(`customer:${stripeCustomerId}`) || null;
          } else {
            const subscriptions = await stripe.subscriptions.list({
              customer: stripeCustomerId,
              status: "all",
              limit: 20,
            });
            stripeSubscription = pickBestSubscription(subscriptions.data);
            subscriptionCache.set(`customer:${stripeCustomerId}`, stripeSubscription);
          }
        }
      }

      if (!stripeSubscriptionId && stripeSubscription?.id) {
        stripeSubscriptionId = stripeSubscription.id;
      }

      const stripeInterval = getStripeInterval(stripeSubscription);
      const renewalDate = toIsoDateFromUnix((stripeSubscription as any)?.current_period_end);
      const notes: string[] = [];

      if (!stripeConfigured) {
        notes.push("Stripe audit unavailable: STRIPE_SECRET_KEY is not configured");
      } else if (appMembership.status === "paid" && !hasLiveStripeSubscription(stripeSubscription)) {
        notes.push("App marks this member as paid but Stripe has no live subscription");
      } else if (appMembership.status === "free" && hasLiveStripeSubscription(stripeSubscription)) {
        notes.push("App marks this member as free but Stripe has a live subscription");
      }

      if (appMembership.interval && stripeInterval && appMembership.interval !== stripeInterval) {
        notes.push(`App says ${appMembership.interval} but Stripe says ${stripeInterval}`);
      }

      if (!ghostConfigured) {
        notes.push("Ghost audit unavailable: GHOST_ADMIN_API_KEY is not configured");
      } else if (!ghostMember) {
        notes.push("Missing in Ghost");
      } else if (appMembership.status === "paid" && !ghostLabels.includes("paid-member")) {
        notes.push("Ghost record is present but not labelled as paid");
      } else if (appMembership.status === "free" && ghostLabels.includes("paid-member")) {
        notes.push("Ghost still labels this member as paid");
      }

      if (stripeSubscription?.cancel_at_period_end) {
        notes.push("Stripe subscription is set to cancel at period end");
      }

      return {
        id: member.id,
        email: member.email || "",
        displayName,
        appTier: member.membershipTier || "free",
        appStatus: appMembership.status,
        appPlanLabel: appMembership.label,
        stripeStatus: stripeSubscription?.status || "none",
        stripePlanLabel: stripeConfigured ? getStripePlanLabel(stripeSubscription) : "Unavailable",
        stripeInterval,
        stripeCustomerId,
        stripeSubscriptionId,
        renewalDate,
        ghostExists: Boolean(ghostMember),
        ghostLabels,
        ghostName: ghostMember?.name || "",
        ghostNote: typeof ghostMember?.note === "string" ? ghostMember.note.trim() : "",
        hasIssues: notes.length > 0,
        notes,
      };
    });

    const appEmails = new Set(rows.map((row) => normalizeEmail(row.email)).filter(Boolean));
    const ghostOnlyMembers = ghostMembers
      .filter((member) => {
        const emailLower = normalizeEmail(member.email);
        return emailLower && !appEmails.has(emailLower);
      })
      .map((member) => ({
        email: member.email || "",
        name: member.name || "",
        labels: getGhostLabels(member),
        note: typeof member.note === "string" ? member.note.trim() : "",
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    const summary = {
      totalMembers: rows.length,
      paidMembers: rows.filter((row) => row.appStatus === "paid").length,
      freeMembers: rows.filter((row) => row.appStatus === "free").length,
      rowsWithIssues: rows.filter((row) => row.hasIssues).length,
      ghostMissing: rows.filter((row) => !row.ghostExists).length,
      ghostOnlyCount: ghostOnlyMembers.length,
      stripeConfigured,
      ghostConfigured,
    };

    return {
      success: true,
      data: {
        rows,
        summary,
        ghostOnlyMembers,
      },
    };
  } catch (error: any) {
    console.error("Error in getMembershipAuditAction:", error);
    return { success: false, error: error.message };
  }
}
