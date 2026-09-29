#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });

type B4bRow = { email: string; stripe_subscription_id: string; amount: number; cycle: "month"|"year"; renewal: string; price_id?: string; clerk_correct?: string; tier: string };
const B4b: B4bRow[] = [
  { email: "vicky.lindsell@hotmail.co.uk", stripe_subscription_id: "sub_1Q43I2LZwCrAHQYPQUlpHDcM", amount: 27500, cycle: "year", renewal: "2027-09-28",
    price_id: "price_1L5nUkLZwCrAHQYPunyiI5hx", clerk_correct: "user_3E3MgOITZRJ2u8qS3z68AJtlyST", tier: "premium_annual" },
  { email: "lucymcdonald@wakefield.gov.uk", stripe_subscription_id: "sub_1KYvFpLZwCrAHQYP8IUSyaIu", amount: 0, cycle: "year", renewal: "2027-03-02",
    clerk_correct: "user_3E3Mpyphe6usqyzv1MjQ0OqQGlx", tier: "complimentary" },
  { email: "jabrown@wakefield.gov.uk", stripe_subscription_id: "sub_1KYvEmLZwCrAHQYPYCqiZZfp", amount: 0, cycle: "year", renewal: "2027-03-02",
    clerk_correct: "user_3E3Mlqg9D7ztZmFcTLN6mnJs8vB", tier: "complimentary" },
  { email: "allinsonre@hotmail.com", stripe_subscription_id: "sub_1KM9vtLZwCrAHQYPQ8WMbq9p", amount: 0, cycle: "year", renewal: "2027-01-26",
    clerk_correct: "user_3E3MhOX236MCQ9tUgbBjfwWyXh0", tier: "complimentary" },
  { email: "annette.levy@kirklees.gov.uk", stripe_subscription_id: "sub_1K4puhLZwCrAHQYPZXAf4ouc", amount: 0, cycle: "year", renewal: "2026-12-09",
    clerk_correct: "user_3E3MnIt8DcneLV3UqIfI3CVMLma", tier: "complimentary" },
  { email: "info@properoats.com", stripe_subscription_id: "sub_1K4pV5LZwCrAHQYPwN6LSJBx", amount: 0, cycle: "year", renewal: "2026-12-09",
    clerk_correct: "user_3E3MiEJW4mfeDclclxmaxw8qVmn", tier: "complimentary" },
  { email: "caroline.pullich@btinternet.com", stripe_subscription_id: "sub_JSnXJmrHmIF8Gl", amount: 0, cycle: "year", renewal: "2027-05-11",
    clerk_correct: "user_3E3MhJQUzZ8AASm4j734mvX4kZ1", tier: "complimentary" },
];

async function main() {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  console.log("=== BATCH#3 B4b 7 rows → visibility unhide + tier + stripe cache JSONB + clerk_id align to Clerk live ===\n");

  // Stripe cache load (REST get for each sub, populate data.stripe.* fields)
  const SK = process.env.STRIPE_SECRET_KEY!;
  const subCache: Record<string, any> = {};
  for (const r of B4b) {
    const s = await (await fetch(`https://api.stripe.com/v1/subscriptions/${r.stripe_subscription_id}`, {
      headers: { Authorization: `Bearer ${SK}`, 'Content-Type':'application/x-www-form-urlencoded' },
    })).json();
    subCache[r.email] = { customerId: typeof s.customer === 'string' ? s.customer : s.customer?.id, subscriptionId: s.id, status: s.status, priceId: s.items?.data?.[0]?.price?.id ?? r.price_id, currentPeriodEnd: new Date(s.current_period_end*1000).toISOString(), startDate: new Date(s.start_date*1000).toISOString() };
  }

  const DRYRUN = false;
  for (const r of B4b) {
    const existing = await pool.query(`SELECT clerk_id,email_lower,visibility,is_active,data FROM member_profiles WHERE email_lower=$1`, [r.email.toLowerCase()]);
    if (existing.rowCount !== 1) { console.log(`  ✖ SKIP ${r.email}: no row (${existing.rowCount}) found.`); continue; }
    const row = existing.rows[0];
    const before = { visibility: row.visibility, is_active: row.is_active, clerk_id: row.clerk_id, tier: (row.data||{}).tier || null };
    const need_clerk_fix = row.clerk_id !== r.clerk_correct;
    if (need_clerk_fix) console.log(`  🛠 [CLERK_ID MISMATCH] ${r.email}: PG clerk=${row.clerk_id.slice(0,20)}… → Clerk LIVE correct=${r.clerk_correct!.slice(0,20)}… WILL FIX`);
    const merged_data = {
      ...(row.data || {}),
      tier: r.tier,
      stripe: subCache[r.email],
    };
    const after = { visibility: 'visible', is_active: true, clerk_id: r.clerk_correct, tier: r.tier };
    console.log(`  [DIFF] ${r.email}: vis(${before.visibility}→visible) active(${before.is_active}→true) tier(${before.tier ?? '<empty>'}→${r.tier}) clerk(${need_clerk_fix?'MISMATCH→FIXED':'OK'})`);

    if (DRYRUN) continue;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const newClerkId = r.clerk_correct!;
      const oldClerkId = row.clerk_id;
      // First: unlink any OTHER PG row that already uses newClerkId (shouldn't be — just safety check)
      const dup = await client.query(`SELECT clerk_id,email_lower FROM member_profiles WHERE clerk_id=$1 AND clerk_id<>$2`, [newClerkId, oldClerkId]);
      if (dup.rowCount) { console.log(`  ⚠️ ${r.email}: another PG row with clerk_id=${newClerkId.slice(0,20)}… email=${dup.rows[0].email_lower} — will leave clerk_id as PG current, no overwrite.`); }
      else if (need_clerk_fix) {
        await client.query(`UPDATE member_profiles SET clerk_id=$1 WHERE clerk_id=$2`, [newClerkId, oldClerkId]);
      }
      await client.query(`
        INSERT INTO member_audit_log(action,target_type,target_id,email_lower,operator,visibility_before,visibility_after,fields_changed,note)
        VALUES('b4b_stripe_missing_member_backfill','member',$1,$2,'system-audit-b4',$3,$4,$5::jsonb,$6)
      `, [newClerkId, r.email.toLowerCase(), before.visibility, 'visible',
          JSON.stringify(["visibility","is_active","data.tier","data.stripe", ...(need_clerk_fix ? ["clerk_id"] : [])]),
          `Stripe sub ${r.stripe_subscription_id} (${r.tier}, £${r.amount/100}) - renewed ${r.renewal} - ${r.cycle === 'year' ? 'annual' : 'monthly'}`]);
      // Final UPDATE: use newClerkId (since if fixed above, new id now matches)
      const finalClerk = (need_clerk_fix && !dup.rowCount) ? newClerkId : oldClerkId;
      await client.query(`
        UPDATE member_profiles
           SET visibility='visible', is_active=true, data=$1::jsonb
         WHERE clerk_id=$2
      `, [JSON.stringify(merged_data), finalClerk]);
      await client.query("COMMIT");
      console.log(`  ✅ APPLY ${r.email}: visible+active, tier=${r.tier}, stripe cache written`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  ROLLBACK", r.email, e);
      process.exit(2);
    } finally {
      client.release();
    }
  }
  await pool.end();
  console.log(`\nBATCH#3 DONE (DRYRUN=${DRYRUN}).`);
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
