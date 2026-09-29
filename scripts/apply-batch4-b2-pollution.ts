#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });

async function main() {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const B2 = [
    { email: "editor@topicuk.co.uk", clerk_id: "user_3E4Sa5C9D5x8o3C54b2pI4lZ55w" },
    { email: "rob@topicuk.co.uk",    clerk_id: "user_3E4SW36wiEAPrWcGmaSxaNtoimf" },
  ];
  const POLLUTION_EMAIL = "dryrun-norecip-abc999@yorkshirebusinesswoman.co.uk";
  console.log("=== BATCH#4: B2 2x topicuk tier founder→complimentary + dryrun pollution softdelete ===");

  for (const u of B2) {
    const res = await pool.query(`SELECT clerk_id,email_lower,visibility,is_active,data->>'tier' tier FROM member_profiles WHERE email_lower=$1 OR clerk_id=$2`, [u.email.toLowerCase(), u.clerk_id]);
    if (res.rowCount !== 1) { console.log(`  SKIP ${u.email}: ${res.rowCount} rows found`); continue; }
    const row = res.rows[0];
    console.log(`  [DIFF B2] ${u.email}: tier=(${row.tier||'<empty>'} → complimentary), clerk=${row.clerk_id.slice(0,18)}…`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO member_audit_log(action,target_type,target_id,email_lower,operator,fields_changed,note)
        VALUES('b2_tier_founder_to_complimentary','member',$1,$2,'system-audit-b2',$3::jsonb,'Founder tier shows incorrectly publicly, set to complimentary (£0 subs)')
      `, [row.clerk_id, row.email_lower, JSON.stringify(["data.tier"])]);
      const upd = await client.query(`
        UPDATE member_profiles SET data = data || '{"tier":"complimentary"}'::jsonb WHERE clerk_id=$1
        RETURNING clerk_id, data->>'tier' tier
      `, [row.clerk_id]);
      await client.query("COMMIT");
      console.log(`  ✅ ${u.email}: new tier=${upd.rows[0].tier}`);
    } catch (e) { await client.query("ROLLBACK"); console.error("ROLLBACK B2", u.email, e); process.exit(2); }
    finally { client.release(); }
  }

  const DRYRUN_POL = false;
  const poll = await pool.query(`SELECT clerk_id,email_lower,visibility,is_active FROM member_profiles WHERE email_lower=$1`, [POLLUTION_EMAIL]);
  if (poll.rowCount === 1) {
    const r = poll.rows[0];
    console.log(`  [DIFF POLLUTION] ${r.email_lower}: vis=(${r.visibility} → invisible)`);
    if (DRYRUN_POL) console.log("  🔒 dryrun pollution softdelete. Flip flag.");
    else {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`
          INSERT INTO member_audit_log(action,target_type,target_id,email_lower,operator,visibility_before,visibility_after,fields_changed,note)
          VALUES('pollution_row_softdelete','member',$1,$2,'system-audit',$3,$4,$5::jsonb,'Nightly reconcile dryrun-dummy pollution row left visible; softdelete to invisible')
        `, [r.clerk_id, r.email_lower, r.visibility, 'invisible', JSON.stringify(["visibility","is_active"])]);
        await client.query(`UPDATE member_profiles SET visibility='invisible',is_active=false WHERE clerk_id=$1`, [r.clerk_id]);
        await client.query("COMMIT");
        console.log(`  ✅ pollution softdelete clerk=${r.clerk_id} done`);
      } catch (e) { await client.query("ROLLBACK"); console.error("ROLLBACK pollution", e); process.exit(3); }
      finally { client.release(); }
    }
  } else {
    console.log(`  ℹ️ pollution email ${POLLUTION_EMAIL}: no PG row (${poll.rowCount}), already deleted/invisible — ok`);
  }
  await pool.end();
  console.log("BATCH#4 DONE.");
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
