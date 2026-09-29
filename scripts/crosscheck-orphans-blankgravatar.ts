#!/usr/bin/env npx tsx
import { Pool } from "pg";
import * as fs from "fs";

async function main() {
  const piPrefixes = new Set(
    fs.readFileSync("/tmp/pi-user-clerks.txt", "utf8").trim().split("\n").filter(Boolean)
  );
  const membersFolderKeys = new Set(
    fs.readFileSync("/tmp/members-folder-keys.txt", "utf8").trim().split("\n").filter(Boolean)
  );
  console.log("profile-images orphan user_* clerk prefixes on disk:", piPrefixes.size);
  console.log("members/ folder Firebase-shortuid keys on disk:", membersFolderKeys.size);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  const blanks = (await pool.query(`
    SELECT clerk_id, email_lower, char_length(clerk_id) AS clen
    FROM member_profiles
    WHERE visibility='visible' AND is_active=true
    AND COALESCE(data->>'avatarUrl','') LIKE '%gravatar.com%'
    AND COALESCE(data->>'avatarUrl','') LIKE '%d=blank%'
    AND (COALESCE(data->>'profileImage','') = '' OR COALESCE(data->>'profileImage','') NOT LIKE '%/uploads/%')
    AND (COALESCE(data->>'image','')        = '' OR COALESCE(data->>'image','')        NOT LIKE '%/uploads/%')
  `)).rows;

  const matchesPi = blanks.filter(r => piPrefixes.has(r.clerk_id));
  console.log(`\n=== (B1) BLANK-GRAVATAR members w/ /uploads/profile-images/<user_*>-<ts>.[jpg|jpeg|png] orphan file on disk ==="`);
  console.log(`Count = ${matchesPi.length} / ${blanks.length}`);
  if (matchesPi.length) console.table(matchesPi.map(r => ({ email: r.email_lower, clerk: r.clerk_id })));

  const matchesFolder = blanks.filter(r => membersFolderKeys.has(r.clerk_id));
  console.log(`\n=== (B2) BLANK-GRAVATAR members w/ /uploads/members/<clerk_id>/ avatar-folder on disk (Firebase orphan == real photos lost from PG ref only!) ===`);
  console.log(`Count = ${matchesFolder.length} / ${blanks.length}`);
  if (matchesFolder.length) console.table(matchesFolder.map(r => ({ email: r.email_lower, clerk: r.clerk_id })));

  console.log("\n=== (C) ALL 14 user_* prefixes from profile-images orphans vs visible PG ===");
  const allvis = (await pool.query("SELECT clerk_id, email_lower, data->>'profileImage' AS pi FROM member_profiles WHERE visibility=$1 AND is_active=$2", ["visible", true])).rows;
  const m = new Map(allvis.map(r => [r.clerk_id, r]));
  console.table([...piPrefixes].map(cid => {
    const r = m.get(cid);
    return {
      clerk_prefix: cid,
      email: r ? r.email_lower : "*** PG_ROW_MISSING ***",
      current_pg_profileimage: r ? ((r.pi || "").substring(0, 60) || "(EMPTY)") : "N/A",
      orphan_on_disk_matches: !!r
    };
  }));

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
