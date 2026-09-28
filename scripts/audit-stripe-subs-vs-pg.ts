#!/usr/bin/env npx tsx
import { Pool } from "pg";
import * as fs from "fs";

(async () => {
  const stripeSubsJson = JSON.parse(fs.readFileSync("/tmp/stripe_audit_active_subs.20260928.json", "utf8"));
  const allSubs = (stripeSubsJson.data || []).map((s: any) => {
    const cust: any = typeof s.customer === "object" ? s.customer : { id: s.customer };
    const email = cust.email ? cust.email.toLowerCase().trim() : null;
    const item = (s.items?.data || [])[0] as any;
    const priceId = item?.price?.id || "";
    const amountUnit = item?.price?.unit_amount ?? 0;
    const currency = item?.price?.currency || "";
    const interval = item?.price?.recurring?.interval || "";
    const planProduct: any = s.plan?.product;
    const productIdRaw = (typeof planProduct === "object" ? planProduct.id : planProduct) || (item?.price?.product) || "";
    const productNameRaw = (typeof planProduct === "object" ? planProduct.name || "" : "") || (item?.price?.nickname || "") || "";
    const start = new Date(s.current_period_start * 1000).toISOString().slice(0, 10);
    const renew = new Date(s.current_period_end * 1000).toISOString().slice(0, 10);
    const daysLeft = Math.round((s.current_period_end * 1000 - Date.now()) / 86400000);
    const mrrMonthly = interval === "year" ? amountUnit / 12 : interval === "month" ? amountUnit : 0;
    return {
      subId: s.id,
      email,
      custId: cust.id,
      custName: cust.name || null,
      priceId,
      amountGbp: amountUnit / 100,
      currency,
      interval,
      productIdRaw,
      productNameRaw,
      tier: s.metadata?.plan || null,
      cycle: s.metadata?.cycle || null,
      clerkUserId: s.metadata?.userId || null,
      current_period_start: start,
      renew_date: renew,
      days_left: daysLeft,
      cancel_at_period_end: !!s.cancel_at_period_end,
      mrr_gbp_pm: mrrMonthly / 100,
    };
  });

  const YBW_CANON_PRICES = new Set([
    "price_1L5nUkLZwCrAHQYPunyiI5hx",
    "price_1L5nUkLZwCrAHQYPQT8GTdZk",
  ]);
  const YBW_CANON_PROD = "cfdc56e2b444d4c173d8d80101e0a8f947237e0aac9071e42f2b5e85a90f9c98";
  const YBW_LEGACY_YR = "prod_UVcZIVukS4Dgjc";
  const YBW_LEGACY_MO = "prod_UUGFLx3JPj62g9";

  function classify(s: any): string {
    if (YBW_CANON_PRICES.has(s.priceId) || s.productIdRaw === YBW_CANON_PROD) return "YBW PREMIUM (CANONICAL)";
    if (s.priceId === "price_1TWbKFLZwCrAHQYP9gKzdpvx" || s.productIdRaw === YBW_LEGACY_YR) return "YBW PREMIUM (LEGACY ANNUAL)";
    if (s.priceId === "price_1TVHicLZwCrAHQYPLXqio8Bi" || s.productIdRaw === YBW_LEGACY_MO) return "YBW PREMIUM (LEGACY MONTHLY)";
    if (["prod_Jnrpfj8ebnnq3O", "prod_OcjUPLp6xtBwkZ", "prod_NR2JHMNyTo0MeE", "prod_N9KSxx34rUT2C6"].includes(s.productIdRaw)) return "YBW PRINT-ONLY (NON-MEMBER)";
    if (s.productIdRaw === "prod_NUj8wsQAijU68w") return "YBW MEMBERPLUS";
    if (s.productIdRaw === "prod_JvkufLuXMRokYT") return "TOPIC-ONLY (TopicUK print subscriber - separate pub)";
    const name = (s.productNameRaw || "") as string;
    if (s.amountGbp < 20 || /Event|Tickets?|networking|BBQ|Lunch|Garden Party|Christmas|Awards|Dakota|John Lewis|Fashion|Masala|Show|Party|Guest|Wars|Chanel|Diamond|winner|Pinot|Picasso|Grantley|Goldborough|Ilkley|tennis|Banyan|Crowned House|Crowded House|Arena|Mahe|Coastal|January|February|March|April|May|June|July|August|September|October|November|December|special offer|advert|editorial|Northern|Toyota|Phillip Stoner/i.test(name)) return "EVENT / AD-HOC (one-off ticket/advert)";
    if (s.interval === "year" && s.amountGbp >= 80) return "YBW/UNCLASSIFIED MEMBERSHIP - NEEDS REVIEW";
    if (s.interval === "month" && s.amountGbp >= 10) return "YBW/UNCLASSIFIED MEMBERSHIP - NEEDS REVIEW";
    if (s.amountGbp === 0) return "TEST / COMPED ZERO-VALUE";
    return "UNCLASSIFIED - NEEDS REVIEW";
  }

  const classified = allSubs.map((s: any) => ({ ...s, bucket: classify(s) }));
  const byBucket: Record<string, number> = {};
  for (const s of classified) byBucket[s.bucket] = (byBucket[s.bucket] || 0) + 1;
  const mrrByBucket: Record<string, number> = {};
  for (const s of classified) mrrByBucket[s.bucket] = (mrrByBucket[s.bucket] || 0) + (s.mrr_gbp_pm || 0);

  console.log("\n========== PART A: Stripe Active Subscriptions (" + allSubs.length + " total) by Publication Bucket  ==========");
  console.log("");
  console.log("bucket                                            count   MRR/mo(£)  %subs");
  console.log("---------------------------------------------------------------------------------");
  const sortedBuckets = Object.entries(byBucket).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sortedBuckets) {
    const m = Math.round((mrrByBucket[k] || 0) * 100) / 100;
    const pct = Math.round(1000 * v / allSubs.length) / 10;
    console.log(k.padEnd(50, " ") + String(v).padStart(4, " ") + ("   £" + m).padEnd(13, " ") + ("  " + pct + "%").padStart(8, " "));
  }
  const ybwCanon = classified.filter((s: any) => s.bucket === "YBW PREMIUM (CANONICAL)");
  const ybwLeg = classified.filter((s: any) => s.bucket.startsWith("YBW PREMIUM (LEGACY"));
  const ybwPlus = classified.filter((s: any) => s.bucket === "YBW MEMBERPLUS");
  const ybwPrint = classified.filter((s: any) => s.bucket.startsWith("YBW PRINT"));
  const ybwAllMember = [...ybwCanon, ...ybwLeg, ...ybwPlus];
  console.log("");
  console.log("YBW total member premium subs (canon + legacy + memberPlus):", ybwAllMember.length, "/", allSubs.length, " = ", Math.round(1000 * ybwAllMember.length / allSubs.length) / 10, "%");
  console.log("YBW print-only subs (non-members):", ybwPrint.length);
  console.log("TopicUK subs (separate publication):", classified.filter((s: any) => s.bucket.startsWith("TOPIC")).length);
  console.log("Events/Ad-hoc (one-off tickets/adverts):", classified.filter((s: any) => s.bucket.startsWith("EVENT")).length);
  console.log("Unclassified NEEDS REVIEW:", classified.filter((s: any) => s.bucket.includes("UNCLASSIFIED") || s.bucket.includes("NEEDS REVIEW")).length);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pgRows = (await pool.query("SELECT clerk_id, email_lower, (data->>'ghostMemberId') AS ghost_member_id, (data->>'membershipTier') AS membership_tier, (data->>'complimentary') AS complimentary, (data->>'tierStripePriceId') AS tier_price_id FROM member_profiles WHERE visibility = 'visible' AND is_active = true")).rows;
  const pgByEmail = new Map(pgRows.map((r: any) => [r.email_lower, r]));

  console.log("\n========== PART B: YBW PREMIUM Stripe subs (" + ybwAllMember.length + " total) vs Postgres visible members ==========");
  const inPgMissingPaid: any[] = [];
  const inPgPaidButStripeCancelled: any[] = [];
  const missingFromPg: any[] = [];
  const okAligned: any[] = [];
  for (const s of ybwAllMember) {
    const pg: any = pgByEmail.get(s.email);
    if (!pg) { missingFromPg.push(s); continue; }
    const tier = (pg.membership_tier || "").toLowerCase();
    const isPaidTier = ["paid_annual", "paid_monthly", "premium", "paid", "comped", "complimentary"].includes(tier);
    const isFree = !isPaidTier || tier === "free";
    if (isFree) inPgMissingPaid.push({ sub: s, pg });
    else if (s.cancel_at_period_end) inPgPaidButStripeCancelled.push({ sub: s, pg });
    else okAligned.push({ sub: s, pg });
  }

  console.log("B1 OK Aligned (Stripe paid & PG paid):", okAligned.length, "/", ybwAllMember.length);
  console.log("B2 CRITICAL MISMATCH: Stripe ACTIVE Premium sub but PG tier=free/null:", inPgMissingPaid.length);
  if (inPgMissingPaid.length) {
    console.log("   Email                     cust_name             tier_pg    stripe_sub              £    int    renew");
    for (const m of inPgMissingPaid) console.log("   " + String(m.sub.email).padEnd(38, " ") + String(m.sub.custName || "").padEnd(22, " ") + String(m.pg.membership_tier || "NULL").padEnd(12, " ") + String(m.sub.subId).padEnd(26, " ") + "£" + String(m.sub.amountGbp).padEnd(6, " ") + String(m.sub.interval).padEnd(7, " ") + m.sub.renew_date);
  }
  console.log("B3 UPCOMING CHURN (cancel_at_period_end):", inPgPaidButStripeCancelled.length);
  if (inPgPaidButStripeCancelled.length) for (const m of inPgPaidButStripeCancelled) console.log("   " + m.sub.email, m.sub.custName, "cancel_on=", m.sub.renew_date, "days_left=", m.sub.days_left);
  console.log("B4 MISSING FROM PG (Stripe Premium sub but NO visible member row):", missingFromPg.length);
  if (missingFromPg.length) for (const s of missingFromPg) console.log("   " + String(s.email).padEnd(38, " ") + String(s.custName || "").padEnd(22, " ") + " sub=" + String(s.subId).padEnd(26, " ") + "£" + String(s.amountGbp).padEnd(6, " ") + String(s.interval).padEnd(7, " ") + "renew=" + s.renew_date + " clerk_meta=" + (s.clerkUserId || "(none)"));

  const allStripeEmails = new Set(classified.map((s: any) => s.email).filter(Boolean));
  const paidTierList = ["paid_annual", "paid_monthly", "premium", "paid", "comped", "complimentary"];
  const pgPaidsCount = pgRows.filter((r: any) => paidTierList.includes((r.membership_tier || "").toLowerCase())).length;
  console.log("\n========== PART C: Postgres visible PAID members (" + pgPaidsCount + " rows) vs " + allStripeEmails.size + " unique Stripe subscriber emails =========");
  const pgPaids = pgRows.filter((r: any) => paidTierList.includes((r.membership_tier || "").toLowerCase()));
  const pgPaidNoStripe = pgPaids.filter((r: any) => !allStripeEmails.has(r.email_lower));
  const compedOnly: any[] = [];
  console.log("C1 PG paid-tier rows with NO active stripe email match (may be Ghost compeds/migrated legacy):", pgPaidNoStripe.length);
  if (pgPaidNoStripe.length) {
    console.log("   email                         tier_pg           clerk_id                         ghost_id");
    for (const r of pgPaidNoStripe) {
      console.log("   " + String(r.email_lower).padEnd(32, " ") + String(r.membership_tier || "NULL").padEnd(18, " ") + String(r.clerk_id || "").padEnd(34, " ") + " " + (r.ghost_member_id || "(none)"));
      if ((r.membership_tier || "").toLowerCase() === "complimentary" || r.complimentary === "true") compedOnly.push(r);
    }
  }
  console.log("\nOf " + pgPaidNoStripe.length + " paid-no-stripe rows, " + compedOnly.length + " are marked COMPLIMENTARY (plausible Ghost comp). Non-complimentary no-stripe PG paid rows NEED REVIEW: " + (pgPaidNoStripe.length - compedOnly.length));

  console.log("\n========== PART D: BIZARRE / SUSPICIOUS DATA FINDINGS ==========");
  const maleNamedOnYbw = classified.filter((s: any) => s.bucket.startsWith("YBW PREMIUM") && (s.custName || "").toLowerCase().trim().startsWith("mr "));
  if (maleNamedOnYbw.length) {
    console.log("D1 Male-titled names on YBW Premium (YBW = female-targeted audience): count=", maleNamedOnYbw.length);
    for (const s of maleNamedOnYbw) console.log("   ", s.email, s.custName, " £" + s.amountGbp, s.interval);
  } else console.log("D1 No Mr.-titled names in YBW Premium.");
  const byEmail: Record<string, any[]> = {};
  for (const s of classified) if (s.email) (byEmail[s.email] = byEmail[s.email] || []).push(s);
  const dupEmails = Object.entries(byEmail).filter(([e, arr]) => arr.length > 1);
  if (dupEmails.length) {
    console.log("D2 Multiple active subs same email (DUPLICATE RISK): emails=", dupEmails.length);
    for (const [e, arr] of dupEmails) console.log("   ", e, "buckets:", [...new Set(arr.map(s => s.bucket))].join(" | "), " sub_ids=", arr.map(s => s.subId).join(","));
  } else console.log("D2 No duplicate-active-subscription emails.");
  const missingClerk = ybwAllMember.filter((s: any) => !s.clerkUserId);
  console.log("D3 YBW PREMIUM subs missing clerk userId in metadata (paid through GHOST PORTAL, not Next.js checkout):", missingClerk.length, "/", ybwAllMember.length, " = ", Math.round(1000 * missingClerk.length / ybwAllMember.length) / 10, "% (vast majority still pays via Ghost native portal)");

  console.log("\n========== END OF AUDIT");
  await pool.end();
})().catch((e) => { console.error("SCRIPT ERROR:", e); process.exit(1); });
