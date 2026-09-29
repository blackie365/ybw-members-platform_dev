#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });

type B4bRow = {
  email: string;
  stripe_subscription_id: string;
  amount: number;
  cycle: "month" | "year";
  renewal_date_iso: string;
  price_id?: string;
};

const B4b: B4bRow[] = [
  { email: "vicky.lindsell@hotmail.co.uk",
    stripe_subscription_id: "sub_1Q43I2LZwCrAHQYPQUlpHDcM",
    amount: 27500, cycle: "year", renewal_date_iso: "2026-09-28",
    price_id: "price_1L5nUkLZwCrAHQYPunyiI5hx" // annual £275
  },
  { email: "lucymcdonald@wakefield.gov.uk", stripe_subscription_id: "sub_1KYvFpLZwCrAHQYP8IUSyaIu", amount: 0, cycle: "year", renewal_date_iso: "2027-03-02" },
  { email: "jabrown@wakefield.gov.uk",      stripe_subscription_id: "sub_1KYvEmLZwCrAHQYPYCqiZZfp", amount: 0, cycle: "year", renewal_date_iso: "2027-03-02" },
  { email: "allinsonre@hotmail.com",        stripe_subscription_id: "sub_1KM9vtLZwCrAHQYPQ8WMbq9p", amount: 0, cycle: "year", renewal_date_iso: "2027-01-26" },
  { email: "annette.levy@kirklees.gov.uk",  stripe_subscription_id: "sub_1K4puhLZwCrAHQYPZXAf4ouc", amount: 0, cycle: "year", renewal_date_iso: "2026-12-09" },
  { email: "info@properoats.com",           stripe_subscription_id: "sub_1K4pV5LZwCrAHQYPwN6LSJBx", amount: 0, cycle: "year", renewal_date_iso: "2026-12-09" },
  { email: "caroline.pullich@btinternet.com", stripe_subscription_id: "sub_JSnXJmrHmIF8Gl",        amount: 0, cycle: "year", renewal_date_iso: "2027-05-11" },
];

async function main() {
  // 1. Clerk: find users by email list
  const CLERK_SK = process.env.CLERK_SECRET_KEY!;
  console.log("=== STEP 1: Clerk user lookup for B4b emails ===");
  const byEmailMap: Record<string, { id: string; email: string; firstName?: string; lastName?: string; } | null> = {};
  for (const r of B4b) {
    try {
      const url = `https://api.clerk.com/v1/users?limit=25&order_by=-created_at&email_address=${encodeURIComponent(r.email)}`;
      const usersRes = await fetch(url, { headers: { Authorization: `Bearer ${CLERK_SK}` } });
      const usersArr: any[] = (await usersRes.json()) as any[];
      const u = usersArr.find((x: any) => (x.email_addresses || []).some((ea: any) => ea.email_address?.toLowerCase() === r.email.toLowerCase()));
      if (!u) { byEmailMap[r.email] = null; console.log(`  ❌ ${r.email}: NO CLERK USER FOUND (need synthetic clerk_id)`); continue; }
      const primary = (u.email_addresses || []).find((ea: any) => ea.id === u.primary_email_address_id)?.email_address ?? r.email;
      byEmailMap[r.email] = { id: u.id, email: primary, firstName: u.first_name, lastName: u.last_name };
      console.log(`  ✅ ${r.email}: clerk_id=${u.id} name="${u.first_name ?? ''} ${u.last_name ?? ''}"`);
    } catch (e: any) {
      console.log(`  ⚠️ ${r.email}: Clerk fetch fail`, e?.message || e);
      byEmailMap[r.email] = null;
    }
  }

  // 2. Stripe: pull subscription objects for B4b, get customerId + currentPeriodEnd + status + price.id
  console.log("\n=== STEP 2: Stripe REST lookup subscription + customer objects ===");
  const stripe_subs: Record<string, any> = {};
  const stripe_cust: Record<string, any> = {};
  const SK = process.env.STRIPE_SECRET_KEY!;
  for (const r of B4b) {
    try {
      const sub = await (await fetch(`https://api.stripe.com/v1/subscriptions/${r.stripe_subscription_id}?expand[]=customer`, {
        headers: { Authorization: `Bearer ${SK}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      })).json();
      if (sub.error) { console.log(`  ❌ ${r.email}: Stripe sub ${r.stripe_subscription_id} error:`, sub.error.message); stripe_subs[r.email] = null; continue; }
      stripe_subs[r.email] = sub;
      stripe_cust[r.email] = sub.customer;
      const price = sub.items?.data?.[0]?.price;
      console.log(`  ✅ ${r.email}: sub_status=${sub.status}, period_end=${new Date((sub.current_period_end)*1000).toISOString().slice(0,10)}, custId=${typeof sub.customer==='string'?sub.customer:sub.customer?.id}, price_id=${price?.id ?? 'N/A'}`);
    } catch (e: any) {
      console.log(`  ⚠️ ${r.email}: Stripe fetch fail`, e?.message || e);
      stripe_subs[r.email] = null;
    }
  }

  // 3. PG check existence
  console.log("\n=== STEP 3: Postgres check existing rows (confirm truely NEW rows, no dup) ===");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const planRows: any[] = [];
  for (const r of B4b) {
    const byEmail = await pool.query(`SELECT clerk_id,email_lower,visibility,is_active,data->>'tier' tier FROM member_profiles WHERE email_lower=$1`, [r.email.toLowerCase()]);
    const clerk_user = byEmailMap[r.email];
    const byClerk = clerk_user ? await pool.query(`SELECT clerk_id,email_lower,visibility,is_active FROM member_profiles WHERE clerk_id=$1`, [clerk_user.id]) : { rows: [] };
    const dup = byEmail.rows.length > 0 ? 'dup-by-email' : (byClerk.rows.length > 0 ? 'dup-by-clerk-id' : null);
    if (dup) console.log(`  ⚠️ ${r.email}: ALREADY EXISTS (${dup}) PG! ${JSON.stringify(byEmail.rows[0] ?? byClerk.rows[0])} — will skip insert.`);
    else console.log(`  ✅ ${r.email}: truely new row, INSERT needed.`);
    planRows.push({
      stripe_row: r, clerk_user: clerk_user ?? undefined,
      dup,
      pg_before: dup === 'dup-by-email' ? byEmail.rows[0] : (dup === 'dup-by-clerk-id' ? byClerk.rows[0] : null),
      stripe_sub: stripe_subs[r.email] ? {
        status: stripe_subs[r.email].status,
        current_period_end: new Date((stripe_subs[r.email].current_period_end)*1000).toISOString(),
        priceId: stripe_subs[r.email].items?.data?.[0]?.price?.id ?? r.price_id,
        customerId: typeof stripe_subs[r.email].customer === 'string' ? stripe_subs[r.email].customer : stripe_subs[r.email].customer?.id,
      } : null,
      stripe_customer_name: stripe_cust[r.email] ? ((typeof stripe_cust[r.email] === 'string' ? undefined : stripe_cust[r.email]?.name) ?? undefined) : undefined,
    });
  }
  await pool.end();

  // 4. Print DRYRUN table for user YES
  console.log("\n=== DRYRUN PG INSERT skeleton (BATCH#3 — NEW rows) ===");
  console.log(JSON.stringify(planRows.map(x => ({
    email: x.stripe_row.email,
    clerk_id: x.clerk_user?.id || x.dup ? 'SYNTHETIC-FROM-STRIPE (use topix dashboard)' : 'NEEDS-CLERK-USER-CREATE',
    clerk_user_exists: !!x.clerk_user,
    stripe_sub_id: x.stripe_row.stripe_subscription_id,
    tier: x.stripe_row.amount > 0 ? 'premium_annual' : 'complimentary',
    amount_pence: x.stripe_row.amount,
    stripe_sub_status: x.stripe_sub?.status,
    stripe_current_period_end: x.stripe_sub?.current_period_end,
    stripe_customer_id: x.stripe_sub?.customerId,
    stripe_price_id: x.stripe_sub?.priceId,
    display_name: x.stripe_customer_name || (x.clerk_user ? (x.clerk_user.firstName + ' ' + x.clerk_user.lastName).trim() : x.stripe_row.email.split('@')[0]),
    dup_status: x.dup || 'NONE (new)',
  })), null, 2));
  console.log("\n==> REQUIRES EXPLICIT USER YES BEFORE PG INSERTS. This will add NEW paid member rows (including vicky.lindsell £275 renew TODAY). Respond YES for vicky.lindsell first (URGENT — renew 2026-09-28 yesterday). Other 6 council comps can follow afterwards in same batch or separate.");
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
