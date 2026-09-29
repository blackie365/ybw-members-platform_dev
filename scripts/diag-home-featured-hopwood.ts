#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });

async function main() {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  // 1. Who is the currently flagged is_featured=true member
  console.log("=== CURRENT is_featured=true MEMBER(s) === (that renders in home page FeaturedInterview slot)");
  const featured = await pool.query(`
    SELECT clerk_id,email_lower,visibility,is_active,data->>'profileImage' pi,data->>'image' im,data->>'avatarUrl' av,
      data->>'displayName' name,data->>'companyName' co,data->>'jobTitle' jt,
      (btrim(coalesce(data->>'bio',''),'"'))::varchar(240) bio240,length(data->>'bio') biolen,
      data->>'tier' tier,is_featured
     FROM member_profiles
     WHERE is_featured=true
     ORDER BY updated_at DESC LIMIT 5
  `);
  for (const r of featured.rows) console.log(JSON.stringify(r, null, 2));
  console.log(`Count = ${featured.rowCount}`);

  // 2. Diagnose Rebecca Hopwood (PG search case-insensitive name + email)
  console.log("\n=== REBECCA HOPWOOD — PG row lookup === (name/regex or email)");
  const rh = await pool.query(`
    SELECT clerk_id,email_lower,visibility,is_active,is_featured,member_slug,data->>'tier' tier,
      data->>'displayName' name,data->>'firstName' fn,data->>'lastName' ln,data->>'companyName' co,data->>'jobTitle' jt,
      data->>'profileImage' pi,data->>'image' im,data->>'avatarUrl' av,length(data->>'bio') biolen,
      (btrim(coalesce(data->>'bio',''),'"'))::varchar(240) bio
     FROM member_profiles
     WHERE (
      lower(coalesce(data->>'displayName','') || ' ' || coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')) LIKE '%rebecca%'
      AND lower(coalesce(data->>'displayName','') || ' ' || coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')) LIKE '%hopwood%'
     ) OR lower(email_lower) LIKE '%hopwood%' OR lower(email_lower) LIKE '%rebecca%hopwood%'
  `);
  console.log(`Rows: ${rh.rowCount}`);
  for (const r of rh.rows) console.log(JSON.stringify(r, null, 2));

  // 3. Fallback: scan ALL rows where data.name fields CONTAIN Rebecca (case insens)
  if (rh.rowCount === 0) {
    console.log("\n=== BROADER NAME SCAN for Rebecca + no-image + no-info profiles ===");
    const all = await pool.query(`
      SELECT clerk_id,email_lower,visibility,is_active,data->>'displayName' name,data->>'firstName' fn,data->>'lastName' ln,
             data->>'profileImage' pi,data->>'image' im,data->>'avatarUrl' av,length(data->>'bio') biolen
       FROM member_profiles
       WHERE (
         lower(coalesce(data->>'displayName','') || ' ' || coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','') || ' ' || coalesce(data->>'name','')) LIKE '%rebecca%'
       )
       ORDER BY updated_at DESC LIMIT 20
    `);
    console.log(`Broad match count = ${all.rowCount}`);
    for (const r of all.rows) console.log(JSON.stringify(r, null, 2));
  }

  await pool.end();
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
