import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(process.cwd(), ".env.local"), override: false });
import { Pool } from "pg";

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Audit log schema
  const cols = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='member_audit_log' ORDER BY ordinal_position",
  );
  console.log("=== member_audit_log columns ===");
  for (const r of cols.rows) console.log("  " + String(r.column_name).padEnd(22) + r.data_type);

  // How many visible rows now have the NEW Ghost backfill markers? Use a marker that we know was blank
  // before (memberSince was filled for all 158) and data.ghostMemberUuid
  const q = await pool.query(`
    SELECT
      COUNT(*) AS total_visible,
      COUNT(*) FILTER (WHERE data->>'memberSince' IS NOT NULL) AS has_memberSince,
      COUNT(*) FILTER (WHERE data->>'ghostMemberUuid' IS NOT NULL) AS has_ghostMemberUuid,
      COUNT(*) FILTER (WHERE data->>'joinDate' IS NOT NULL) AS has_joinDate,
      COUNT(*) FILTER (WHERE created_at IS NOT NULL) AS has_pg_created_at,
      COUNT(*) FILTER (WHERE data->>'stripeSubscriptions' IS NOT NULL) AS has_stripeSubs,
      COUNT(*) FILTER (WHERE data->>'newsletterSubscriptions' IS NOT NULL) AS has_newsletterSubs
    FROM member_profiles WHERE visibility='visible'
  `);
  console.log("\n=== Visible rows filled backfill markers (post-apply crash) ===");
  for (const [k, v] of Object.entries(q.rows[0])) console.log("  " + String(k).padEnd(28) + v);

  await pool.end();
  console.log("DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
