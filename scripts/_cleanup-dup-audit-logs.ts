import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(process.cwd(), ".env.local"), override: false });
import { Pool } from "pg";

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lo = 543;
  const hi = 700;
  // 1. Confirm 158 rows in range, all action=ghost_backfill_fill, and each has EXACTLY 1 key in fields_changed = "PG.created_at"
  //    (the duplicate idempotency no-op entries from 2nd pass)
  const countCheck = await pool.query(
    `SELECT COUNT(*)::int AS n,
            SUM(CASE WHEN action = 'ghost_backfill_fill' THEN 1 ELSE 0 END)::int AS action_ok,
            SUM(CASE WHEN (fields_changed ? 'PG.created_at')
                      AND (SELECT COUNT(*) FROM jsonb_object_keys(fields_changed)) = 1
                 THEN 1 ELSE 0 END)::int AS keys_ok
     FROM member_audit_log
     WHERE id BETWEEN $1 AND $2`,
    [lo, hi],
  );
  const { n, action_ok, keys_ok } = countCheck.rows[0];
  console.log(
    `Safety check range [${lo}-${hi}]: total=${n} action_ok=${action_ok} keys_only_PG.created_at=${keys_ok}`,
  );
  if (n === 158 && action_ok === 158 && keys_ok === 158) {
    const del = await pool.query(
      `DELETE FROM member_audit_log WHERE id BETWEEN $1 AND $2 RETURNING id`,
      [lo, hi],
    );
    console.log(`✅ DELETED ${del.rowCount} duplicate no-op audit logs in range [${lo}-${hi}]`);
  } else {
    console.log("❌ SAFETY CHECK FAILED — NOT deleting. Diagnostics (first 20 bad):");
    const wrong = await pool.query(
      `SELECT id,
              action,
              (SELECT COUNT(*) FROM jsonb_object_keys(fields_changed)) AS key_count,
              fields_changed ? 'PG.created_at' AS has_pg_created_at
       FROM member_audit_log
       WHERE id BETWEEN $1 AND $2
         AND (action <> 'ghost_backfill_fill'
              OR (fields_changed ? 'PG.created_at') IS NOT TRUE
              OR (SELECT COUNT(*) FROM jsonb_object_keys(fields_changed)) <> 1)
       ORDER BY id LIMIT 20`,
      [lo, hi],
    );
    for (const r of wrong.rows) console.log("  ", r);
  }
  const final = await pool.query(`SELECT COUNT(*)::int AS total, MIN(id) lo, MAX(id) hi FROM member_audit_log`);
  console.log(`Final audit_log: ${final.rows[0].total} rows (ids ${final.rows[0].lo}—${final.rows[0].hi})`);
  await pool.end();
  console.log("DONE");
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
