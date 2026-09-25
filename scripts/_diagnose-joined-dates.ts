import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(process.cwd(), ".env.local"), override: false });
import { Pool } from "pg";

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Shape 1: pgts returns when helper col is NULL vs JSONB typeof
    const shape = await pool.query(`
      SELECT
        COUNT(*)::int AS total_visible,
        SUM(CASE WHEN created_at IS NOT NULL THEN 1 ELSE 0 END)::int AS sql_helper_created_at_nonnull,
        SUM(CASE WHEN jsonb_typeof(data->'createdAt') = 'object' THEN 1 ELSE 0 END)::int AS jsonb_createdat_object_type,
        SUM(CASE WHEN jsonb_typeof(data->'createdAt') = 'string' THEN 1 ELSE 0 END)::int AS jsonb_createdat_string_type,
        SUM(CASE WHEN jsonb_typeof(data->'createdAt') = 'number' THEN 1 ELSE 0 END)::int AS jsonb_createdat_number_type,
        SUM(CASE WHEN data->>'createdAt' IS NULL THEN 1 ELSE 0 END)::int AS jsonb_createdat_null,
        SUM(CASE WHEN data->'createdAt' ? '_seconds' THEN 1 ELSE 0 END)::int AS firestore_shape_seconds_nanos,
        SUM(CASE WHEN data->'createdAt' ? 'seconds' THEN 1 ELSE 0 END)::int AS firestore_shape_seconds,
        SUM(CASE WHEN data ? 'memberSince' AND data->>'memberSince' <> '' THEN 1 ELSE 0 END)::int AS has_memberSince,
        SUM(CASE WHEN data ? 'joinDate' AND data->>'joinDate' <> '' THEN 1 ELSE 0 END)::int AS has_joinDate
      FROM member_profiles
      WHERE visibility='visible'
    `);
    console.log("=== Visible rows createdAt-shape breakdown ===\n");
    console.table(shape.rows);

    // Show up to 6 concrete examples of each non-string shape
    const samples = await pool.query(`
      SELECT clerk_id,
             email_lower,
             jsonb_typeof(data->'createdAt') as jsonb_createdat_type,
             data->'createdAt' as jsonb_createdat_raw,
             created_at::text as sql_created_at,
             data->>'memberSince' as memberSince,
             data->>'joinDate' as joinDate
      FROM member_profiles
      WHERE visibility='visible'
        AND jsonb_typeof(data->'createdAt') <> 'string'
      ORDER BY clerk_id
      LIMIT 12
    `);
    console.log("\n=== Sample rows where data.createdAt is NOT a plain ISO string ===\n");
    console.table(samples.rows.map(r => ({
      clerk_id: r.clerk_id.slice(0,12),
      email: String(r.email_lower||'').slice(0,28),
      jsonb_type: r.jsonb_createdat_type,
      jsonb_createdAt_preview: typeof r.jsonb_createdat_raw === 'object'
        ? (r.jsonb_createdat_raw === null ? 'null' : JSON.stringify(r.jsonb_createdat_raw).slice(0,60))
        : String(r.jsonb_createdat_raw??'').slice(0,60),
      sql_helper_created_at: String(r.sql_created_at||'').slice(0,25),
      memberSince: String(r.memberSince||'').slice(0,25),
      joinDate: String(r.joinDate||'').slice(0,25),
    })));
  } finally {
    await pool.end();
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
