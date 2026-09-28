#!/usr/bin/env npx tsx
import { Pool } from "pg";

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(`
    SELECT clerk_id, email_lower,
      data->>'firstName' as fn, data->>'lastName' as ln,
      CASE
        WHEN NULLIF(data->>'image', '') LIKE '/uploads/%' THEN data->>'image'
        WHEN NULLIF(data->>'avatarUrl', '') LIKE '/uploads/%' THEN data->>'avatarUrl'
        WHEN NULLIF(data->>'profileImage', '') LIKE '/uploads/%' THEN data->>'profileImage'
        ELSE '(no-local-ref)'
      END AS sample_local_ref
    FROM member_profiles WHERE visibility='visible' AND is_active=true
    ORDER BY LENGTH(clerk_id) DESC, clerk_id
    LIMIT 30;
  `);
  console.log("clerk_id format sample: length, clerk_id, sample local /uploads/ ref, email");
  console.log("--------------------------------------------------------------------------------------------------------");
  for (const row of r.rows as any[]) {
    console.log("  len=" + String(row.clerk_id.length).padStart(3, " ") + "  clerk_id=" + String(row.clerk_id).padEnd(40, " ") + "  email=" + String(row.email_lower).padEnd(42, " ") + "  ref=" + row.sample_local_ref);
  }

  const fmt = await pool.query(`
    SELECT CASE
      WHEN clerk_id LIKE 'user_%' AND LENGTH(clerk_id) = 31 THEN 'CLERK-v1 user_ len=31'
      WHEN clerk_id LIKE 'user_%' AND LENGTH(clerk_id) > 4 THEN 'CLERK user_ len=' || LENGTH(clerk_id)
      WHEN LENGTH(clerk_id) = 28 THEN 'FIREBASE/LEGACY len=28'
      WHEN LENGTH(clerk_id) BETWEEN 15 AND 22 THEN 'FIREBASE/LEGACY short len=' || LENGTH(clerk_id)
      ELSE 'UNKNOWN len=' || LENGTH(clerk_id)
    END AS id_format,
    COUNT(*)::int AS c,
    COUNT(CASE WHEN NULLIF(data->>'profileImage', '') IS NOT NULL THEN 1 END)::int AS pi_has,
    COUNT(CASE WHEN NULLIF(data->>'image', '') LIKE '/uploads/%' OR NULLIF(data->>'avatarUrl', '') LIKE '/uploads/%' OR NULLIF(data->>'profileImage', '') LIKE '/uploads/%' THEN 1 END)::int AS has_any_local_ref,
    COUNT(CASE WHEN NULLIF(data->>'profileImage', '') NOT LIKE '%gravatar.com/%' AND NULLIF(data->>'profileImage', '') IS NOT NULL THEN 1 END)::int AS pi_real_upload
    FROM member_profiles WHERE visibility='visible' AND is_active=true
    GROUP BY 1
    ORDER BY c DESC;
  `);
  console.log("");
  console.log("clerk_id FORMAT distribution across 157 visible members:");
  console.log("");
  for (const row of fmt.rows as any[]) {
    console.log("  rows=" + String(row.c).padStart(3, " ") + "  format=" + String(row.id_format).padEnd(50, " ") + "  has_profileImage_nonempty=" + String(row.pi_has).padStart(3, " ") + "  has_any_local_upload_ref=" + String(row.has_any_local_ref).padStart(3, " ") + "  pi_real_nonGrav=" + row.pi_real_upload);
  }

  const userOnes = await pool.query(`SELECT clerk_id, email_lower FROM member_profiles WHERE visibility='visible' AND is_active=true AND clerk_id LIKE 'user_%' ORDER BY clerk_id`);
  console.log("");
  console.log("CLERK user_* clerk_ids (post-migration members — these are members who signed up AFTER Clerk migration):");
  for (const row of userOnes.rows as any[]) console.log("   ", row.clerk_id, "   email=", row.email_lower);

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
