#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });

async function main() {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  const totals = await pool.query(`
    SELECT
      COUNT(*)::int total_rows,
      COUNT(*) FILTER (WHERE visibility='visible' AND is_active=true)::int visible_active,
      COUNT(*) FILTER (WHERE visibility='visible')::int visible_any,
      COUNT(*) FILTER (WHERE visibility='visible' AND is_active=true AND (
        COALESCE(data->>'profileImage','') LIKE '%/uploads/%' OR
        COALESCE(data->>'image','') LIKE '%/uploads/%' OR
        COALESCE(data->>'avatarUrl','') LIKE '%/uploads/%'))::int visible_has_real_photo,
      COUNT(*) FILTER (WHERE visibility='visible' AND is_active=true AND NOT (
        COALESCE(data->>'profileImage','') LIKE '%/uploads/%' OR
        COALESCE(data->>'image','') LIKE '%/uploads/%' OR
        COALESCE(data->>'avatarUrl','') LIKE '%/uploads/%'))::int visible_blank_no_photo
    FROM member_profiles
  `);
  console.log("=== PG VISIBLE MEMBER PHOTOS — FINAL STATE ===");
  console.log(JSON.stringify(totals.rows[0], null, 2));

  // Verify specific 6 batch1 Firebase photo backfills
  console.log("\n=== BATCH#1 VERIFY: 6 Firebase photo backfill profileImage ===");
  const b1Ids = ["60795efddb66fd6b3ed62580","669f638032f2cf273b226833","654370462d646eba794a2266","651e7b232d646eba794a117c","6478c6acab3db5b736d39579","6492f08c86cf4256bd7f3f79"];
  const b1Placeholders = b1Ids.map((_,i) => `$${i+1}`).join(",");
  const b1 = await pool.query(`SELECT email_lower, COALESCE(data->>'profileImage','') pi FROM member_profiles WHERE clerk_id IN (${b1Placeholders}) ORDER BY 1`, b1Ids);
  for (const r of b1.rows) console.log(`  ${r.email_lower.slice(0, 42)} → ${r.pi}`);

  // Verify 6 B4a
  console.log("\n=== BATCH#2 B4a VERIFY: 6 rows visibility → visible, tier set ===");
  const b4aIds = ["user_3E3MjnjzaMmiiFieytcxUQRwFy4","user_3E3Mq9QE9NwCWZYB2dfq20EnUab","user_3E3MkeuwLkh7bbkqPXsTBV8wgX7","user_3E3MkErJSo1r4JqNUuXua6NfgpV","user_3E3MiKpxV8gGLutnkngvNHOWZhs","user_3E3MotnLxJeMIoy7Tx67Wol1Ins"];
  const b4aPh = b4aIds.map((_,i) => `$${i+1}`).join(",");
  const b4a = await pool.query(`SELECT email_lower,visibility,is_active,data->>'tier' tier FROM member_profiles WHERE clerk_id IN (${b4aPh}) ORDER BY 1`, b4aIds);
  for (const r of b4a.rows) console.log(`  ${r.email_lower.slice(0, 42)} vis=${r.visibility} active=${r.is_active} tier=${r.tier || '<empty>'}`);

  // Verify B4b 7
  console.log("\n=== BATCH#3 B4b VERIFY: 7 rows visible, active, tier, stripe cache ===");
  const b4bEmails = ["vicky.lindsell@hotmail.co.uk","lucymcdonald@wakefield.gov.uk","jabrown@wakefield.gov.uk","allinsonre@hotmail.com","annette.levy@kirklees.gov.uk","info@properoats.com","caroline.pullich@btinternet.com"];
  const b4bPh = b4bEmails.map((_, i) => `$${i+1}`).join(",");
  const b4b = await pool.query(`SELECT clerk_id,email_lower,visibility,is_active,data->>'tier' tier, data->'stripe'->>'subscriptionId' sub,data->'stripe'->>'status' st FROM member_profiles WHERE email_lower IN (${b4bPh}) ORDER BY 2`, b4bEmails);
  for (const r of b4b.rows) console.log(`  ${r.email_lower.slice(0, 42)} clerk=${r.clerk_id.slice(0, 18)}… vis=${r.visibility} a=${r.is_active} tier=${r.tier||'<empty>'} sub=${r.sub?.slice(0, 14)}… status=${r.st}`);

  // Verify B2 editor/rob + pollution
  console.log("\n=== BATCH#4 VERIFY: editor/rob tier complimentary; pollution invisible ===");
  const b4c = await pool.query(`SELECT email_lower,visibility,is_active,data->>'tier' tier FROM member_profiles WHERE email_lower IN ('editor@topicuk.co.uk','rob@topicuk.co.uk','dryrun-norecip-abc999@yorkshirebusinesswoman.co.uk') ORDER BY 1`);
  for (const r of b4c.rows) console.log(`  ${r.email_lower.slice(0, 55)} vis=${r.visibility} a=${r.is_active} tier=${r.tier || '<empty>'}`);

  // Last: recent audit log count per action
  const actions = await pool.query(`SELECT action,COUNT(*) FROM member_audit_log WHERE action IN ('firebasestorage_avatar_backfill','b4a_visibility_unhide','b4b_stripe_missing_member_backfill','b2_tier_founder_to_complimentary','pollution_row_softdelete') GROUP BY 1 ORDER BY 1`);
  console.log("\n=== member_audit_log ACTION counts (today's writes) ===");
  for (const r of actions.rows) console.log(`  ${r.action.padEnd(48)}: ${r.count}`);
  await pool.end();
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
