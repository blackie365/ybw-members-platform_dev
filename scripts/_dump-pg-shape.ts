import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: false });
import { Pool } from "pg";

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const cols = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'member_profiles' ORDER BY ordinal_position",
  );
  for (const r of cols.rows) {
    console.log(String(r.column_name).padEnd(30) + r.data_type);
  }
  const row = await pool.query(
    "SELECT * FROM member_profiles WHERE visibility='visible' LIMIT 1",
  );
  if (row.rows.length) {
    console.log("\n=== Sample visible row values (truncated) ===");
    for (const [k, v] of Object.entries(row.rows[0])) {
      const s = v === null ? "NULL" : JSON.stringify(v);
      console.log(
        "  " + String(k).padEnd(28) + " : " + (s.length > 180 ? s.slice(0, 180) + "..." : s),
      );
    }
  }
  console.log("\n=== VISIBLE count + visibility/shape ===");
  const cc = await pool.query(
    "SELECT visibility, COUNT(*) AS n FROM member_profiles GROUP BY 1 ORDER BY 1",
  );
  for (const r of cc.rows) console.log("  visibility=" + r.visibility + " count=" + r.n);
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
