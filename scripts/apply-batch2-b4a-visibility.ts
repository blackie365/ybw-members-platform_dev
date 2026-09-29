#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });

const B4a = [
  { email: "vicki.watt@arcinspirations.com", clerk_id: "user_3E3MjnjzaMmiiFieytcxUQRwFy4", expected_tier: "premium_monthly", amount: 20, note: "B4a missing member (paid_monthly £20/mo renew 2026-10-17)" },
  { email: "roopa.chopra@kirklees.gov.uk", clerk_id: "user_3E3Mq9QE9NwCWZYB2dfq20EnUab", expected_tier: "complimentary", amount: 0, note: "B4a missing member kirklees council comp" },
  { email: "steph.bartle@kirklees.gov.uk", clerk_id: "user_3E3MkeuwLkh7bbkqPXsTBV8wgX7", expected_tier: "complimentary", amount: 0, note: "B4a missing member kirklees council comp" },
  { email: "sarah.shackleton-ward@kirklees.gov.uk", clerk_id: "user_3E3MkErJSo1r4JqNUuXua6NfgpV", expected_tier: "complimentary", amount: 0, note: "B4a missing member kirklees council comp" },
  { email: "rebecca@youbeemedia.co.uk", clerk_id: "user_3E3MiKpxV8gGLutnkngvNHOWZhs", expected_tier: "complimentary", amount: 0, note: "B4a missing member ghost comp" },
  { email: "emma@one-community.org.uk", clerk_id: "user_3E3MotnLxJeMIoy7Tx67Wol1Ins", expected_tier: "complimentary", amount: 0, note: "B4a missing member ghost comp" },
];

async function main() {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  console.log("=== BATCH#2 DRYRUN: B4a 6 rows visibility invisible → visible + tier = premium_monthly/complimentary ===\n");

  const plan: any[] = [];
  for (const m of B4a) {
    const r = await pool.query(`SELECT clerk_id,email_lower,visibility,is_active,data->>'tier' tier FROM member_profiles WHERE clerk_id=$1`, [m.clerk_id]);
    if (r.rowCount !== 1) { console.log(`  ✖️ ${m.email}: clerk_id ${m.clerk_id} NOT FOUND IN PG (expected existing row)! Skip`); continue; }
    const row = r.rows[0];
    const before = JSON.parse(JSON.stringify(row));
    if (row.visibility === 'visible') { console.log(`  ⚠️ ${m.email} already visible — no change`); continue; }
    const target_tier = m.expected_tier;
    const after = { ...row, visibility: 'visible', tier: target_tier };
    console.log(`  [DIFF] ${m.email} clerk=${m.clerk_id.slice(0,18)}… vis=(${row.visibility} → visible), tier=(${row.tier || '<empty>'} → ${target_tier}), is_active=${row.is_active}`);
    plan.push({ m, before, after });
  }
  console.log(`\nTotal DRYRUN will-UPDATE count = ${plan.length} / ${B4a.length}`);

  const DRYRUN = false;
  if (DRYRUN) { console.log("\n🔒 DRYRUN true. Flip flag to apply. Exiting."); await pool.end(); return; }

  console.log("\n=== APPLYING WRITES (DRYRUN=false) ===");
  for (const p of plan) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO member_audit_log(action,target_type,target_id,email_lower,operator,visibility_before,visibility_after,fields_changed,note)
        VALUES('b4a_visibility_unhide','member',$1,$2,'system-audit-b4',$3,$4,$5::jsonb,$6)
      `, [p.m.clerk_id, p.m.email, p.before.visibility, 'visible', JSON.stringify(["visibility","data.tier"]), p.m.note]);
      const upd = await client.query(`
        UPDATE member_profiles
           SET visibility='visible',
               is_active=CASE WHEN NOT is_active THEN true ELSE is_active END,
               data = data || $1::jsonb
         WHERE clerk_id=$2
         RETURNING clerk_id,visibility,is_active,data->>'tier' tier
      `, [JSON.stringify({ tier: p.m.expected_tier }), p.m.clerk_id]);
      await client.query("COMMIT");
      console.log(`  ✅ ${p.m.email}: visibility now ${upd.rows[0].visibility}, tier=${upd.rows[0].tier}, active=${upd.rows[0].is_active}`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  ROLLBACK", p.m.email, e);
      process.exit(2);
    } finally {
      client.release();
    }
  }
  await pool.end();
  console.log("\nBATCH#2 DONE. 6 members now visible.");
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
