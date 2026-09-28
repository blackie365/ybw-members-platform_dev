#!/usr/bin/env npx tsx
import { Pool } from "pg";
import { spawnSync } from "child_process";
import * as fs from "fs";

(async () => {
  const VPS_HOST = "vps725503.ovh.net";
  const VPS_USER = "topix";

  // Step 1: Get every UNIQUE Postgres-referenced /uploads/ path (all 6 image fields combined)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const refs = await pool.query(`
    SELECT DISTINCT u, email_lower, data->>'firstName' as fn, data->>'lastName' as ln, source_field
    FROM (
      SELECT data->>'image' AS u, email_lower, data, 'image' AS source_field
        FROM member_profiles WHERE visibility='visible' AND is_active=true AND NULLIF(data->>'image','') LIKE '/uploads/%'
      UNION ALL SELECT data->>'avatarUrl' AS u, email_lower, data, 'avatarUrl'
        FROM member_profiles WHERE visibility='visible' AND is_active=true AND NULLIF(data->>'avatarUrl','') LIKE '/uploads/%'
      UNION ALL SELECT data->>'profileImage' AS u, email_lower, data, 'profileImage'
        FROM member_profiles WHERE visibility='visible' AND is_active=true AND NULLIF(data->>'profileImage','') LIKE '/uploads/%'
      UNION ALL SELECT data->>'profileImageSource' AS u, email_lower, data, 'profileImageSource'
        FROM member_profiles WHERE visibility='visible' AND is_active=true AND NULLIF(data->>'profileImageSource','') LIKE '/uploads/%'
      UNION ALL SELECT data->>'photoURL' AS u, email_lower, data, 'photoURL'
        FROM member_profiles WHERE visibility='visible' AND is_active=true AND NULLIF(data->>'photoURL','') LIKE '/uploads/%'
      UNION ALL SELECT data->>'gravatarUrl' AS u, email_lower, data, 'gravatarUrl'
        FROM member_profiles WHERE visibility='visible' AND is_active=true AND NULLIF(data->>'gravatarUrl','') LIKE '/uploads/%'
    ) x;
  `);
  const pgRefs: any[] = refs.rows;
  const uniquePaths = [...new Set(pgRefs.map(r => r.u))].sort();
  console.log("========== PART 1: Postgres /uploads/ references (unique paths):", uniquePaths.length, "unique, from", pgRefs.length, "rows ==========");
  console.log("");

  // Step 2: VPS file list pre-pulled via `ssh topix@vps725503.ovh.net find ... > /tmp/vps_uploads_files.txt` then scp to /tmp/
  const vpsListPath = "/tmp/vps_uploads_files.txt";
  if (!fs.existsSync(vpsListPath)) { console.error("Run: ssh topix@vps725503.ovh.net  \"find /srv/ybw-frontend/uploads/ -type f | sed 's#^/srv/ybw-frontend##' | sort > /tmp/vps_uploads_files.txt\"  && scp topix@vps725503.ovh.net:/tmp/vps_uploads_files.txt /tmp/"); process.exit(2); }
  const raw = fs.readFileSync(vpsListPath, "utf8");
  const vpsFileSet = new Set(raw.split(/\r?\n/).filter(l => l.startsWith("/uploads/") && l.trim().length > 0));
  console.log("========== PART 2: VPS filesystem under /srv/ybw-frontend/uploads/ — files on-disk as /uploads/... paths: size=", vpsFileSet.size, "==========");

  // Step 3: Cross-check: every unique PG ref — does it exist on disk?
  const found: string[] = [];
  const missing: string[] = [];
  for (const p of uniquePaths) {
    if (vpsFileSet.has(p)) found.push(p);
    else missing.push(p);
  }

  console.log("");
  console.log("========== PART 3: CROSS-CHECK results ==========");
  console.log("  PG references found ON DISK   :", found.length, "/", uniquePaths.length, " = ", Math.round(1000*found.length/Math.max(1,uniquePaths.length))/10, "%  ✅ OK");
  console.log("  PG references MISSING ON DISK :", missing.length, "/", uniquePaths.length, " = ", Math.round(1000*missing.length/Math.max(1,uniquePaths.length))/10, "%  ❌ THESE ARE THE DISAPPEARED FILES — PG still references them but actual JPEG/PNG is gone from VPS");
  console.log("");
  if (missing.length > 0) {
    console.log("========== LIST OF DISAPPEARED (PG ref but NO file on VPS disk) ==========");
    console.log("");
    console.log("PG path                                          FirstSeenEmail                    CustName           Fields_used_in");
    console.log("----------------------------------------------------------------------------------------------------------------------------");
    for (const p of missing) {
      const whoUsedIt = pgRefs.filter(r => r.u === p).slice(0, 3);
      const first = whoUsedIt[0];
      const fields = [...new Set(whoUsedIt.map(r => r.source_field))].join(",");
      console.log(String(p).padEnd(55, " ") + " " + String(first?.email_lower || "(none)").padEnd(40, " ") + " " + ((first?.fn||"") + " " + (first?.ln||"")).padEnd(26, " ") + "  " + fields);
    }
    console.log("");
  }

  // Step 4: Full distribution of missing-by-member (count disappeared per member email, rank)
  if (missing.length > 0) {
    const missingByEmail: Record<string, {paths: string[], name: string, fields: string[]}> = {};
    for (const r of pgRefs) {
      if (!missing.includes(r.u)) continue;
      const email = r.email_lower;
      if (!missingByEmail[email]) missingByEmail[email] = { paths: [], name: ((r.fn||"") + " " + (r.ln||"")).trim(), fields: [] };
      if (!missingByEmail[email].paths.includes(r.u)) missingByEmail[email].paths.push(r.u);
      if (!missingByEmail[email].fields.includes(r.source_field)) missingByEmail[email].fields.push(r.source_field);
    }
    const byMissing = Object.entries(missingByEmail).sort((a,b) => b[1].paths.length - a[1].paths.length);
    console.log("========== MISSING grouped by MEMBER email (worst hit first):", Object.keys(missingByEmail).length, "members affected ==========");
    for (const [email, info] of byMissing) {
      console.log("  missing_images=" + info.paths.length + " email=" + email.padEnd(44, " ") + "  name=" + info.name.padEnd(28, " ") + " fields=" + info.fields.join(",") + "  paths=" + info.paths.join(", "));
    }
    console.log("");
  }

  // Step 5: The inverse: VPS has files but PG does NOT reference them (orphaned storage, can be cleaned up but NOT the disappeared)
  const referencedSet = new Set(uniquePaths);
  const diskOrphans: string[] = [];
  for (const p of [...vpsFileSet].sort()) {
    // Only check /uploads/members/... and /uploads/profile-images/... (member images specifically — exclude ads/partners/magazine etc.)
    if (!p.startsWith("/uploads/members/") && !p.startsWith("/uploads/profile-images/")) continue;
    if (!referencedSet.has(p)) diskOrphans.push(p);
  }
  console.log("========== PART 4: INVERSE — VPS disk has member images but PG does NOT reference them (orphans, safe to archive): count=", diskOrphans.length, "==========");
  console.log("(These are not disappeared — they are simply stored/uploaded but PG never referenced them).");
  for (const p of diskOrphans.slice(0, 30)) console.log("   disk-only:", p);
  if (diskOrphans.length > 30) console.log("   ...", diskOrphans.length - 30, "more.");

  await pool.end();
})().catch(e => { console.error("SCRIPT ERROR:", e); process.exit(1); });
