#!/usr/bin/env npx tsx
import { Pool } from "pg";
import * as fs from "fs";

(async () => {
  // Load VPS /uploads/ file list (pre-scp'd to /tmp/vps_uploads_files.txt)
  const raw = fs.readFileSync("/tmp/vps_uploads_files.txt", "utf8").split(/\r?\n/).filter(l => l.startsWith("/uploads/") && l.trim().length);
  const vpsAll = new Set(raw);
  const vpsMemberPaths = raw.filter((p) => p.startsWith("/uploads/members/") || p.startsWith("/uploads/profile-images/"));

  // Parse clerkUserId folder for /uploads/members/{clerkUserId}/... files
  type Info = { clerk?: string; fname?: string; thumb?: boolean; orig?: boolean };
  const parsed: Record<string, Info> = {};
  for (const p of vpsMemberPaths) {
    let clerk: string | undefined;
    let fname: string | undefined;
    if (p.startsWith("/uploads/members/")) {
      const rest = p.slice("/uploads/members/".length);
      const slash = rest.indexOf("/");
      if (slash >= 0) { clerk = rest.slice(0, slash); fname = rest.slice(slash+1); }
    } else if (p.startsWith("/uploads/profile-images/")) {
      clerk = undefined;
      fname = p.slice("/uploads/profile-images/".length);
    }
    parsed[p] = { clerk, fname, thumb: !!fname?.includes("-thumb."), orig: !!fname && !fname.includes("-thumb.") };
  }

  console.log("========== PART 1: Disk /uploads/ member images breakdown ==========");
  console.log("Total member-associated files on disk:", vpsMemberPaths.length);
  const byFolder = new Map<string, Set<string>>();
  const piFnames: string[] = [];
  for (const p of vpsMemberPaths) {
    const info = parsed[p];
    if (info.clerk) {
      if (!byFolder.has(info.clerk)) byFolder.set(info.clerk, new Set());
      byFolder.get(info.clerk)!.add(p);
    } else piFnames.push(p);
  }
  console.log("Unique clerk user IDs that have files on disk (uploaded an avatar):", byFolder.size);
  console.log("Profile-images direct files (legacy):", piFnames.length);
  console.log("");

  // Now load Postgres visible members: clerk_id, all 6 image fields
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pg = await pool.query(`
    SELECT clerk_id, email_lower, data->>'firstName' AS fn, data->>'lastName' AS ln,
      NULLIF(data->>'image', '') AS img,
      NULLIF(data->>'avatarUrl', '') AS av,
      NULLIF(data->>'profileImage', '') AS pi,
      NULLIF(data->>'profileImageSource', '') AS pis,
      NULLIF(data->>'photoURL', '') AS ph,
      NULLIF(data->>'gravatarUrl', '') AS gr
    FROM member_profiles WHERE visibility='visible' AND is_active=true;
  `);
  await pool.end();

  // For every visible PG member: did they upload something?
  // Collect which refs in PG are actually WRITEABLE (non-http, non-gravatar → local /uploads/ paths that we wrote)
  const anyUpRefInPg = new Set<string>();
  type PgRow = typeof pg.rows[number];
  function rowToUploadsRefs(r: PgRow): string[] {
    return [r.img, r.av, r.pi, r.pis, r.ph, r.gr]
      .filter((x: any): x is string => typeof x === "string" && x.startsWith("/uploads/"));
  }
  for (const r of pg.rows) anyUpRefInPg.add(r.clerk_id + "|" + JSON.stringify(rowToUploadsRefs(r)));

  // Now join: for EVERY clerk folder on disk, find its PG row and determine if PG correctly has the thumb ref, OR has nothing at all (BUG)
  type BugRow = {
    clerk: string;
    email_lower: string;
    name: string;
    bestThumbOnDisk: string | null;
    bestImageOnDisk: string | null;
    allDiskPaths: string[];
    pgRefsFound: string[];
    verdict: "PG_HAS_MATCHING_THUMB_OK" | "DISK_ONLY_NO_PG_REF_MAJOR_BUG" | "DISK_ORPHAN_HAS_ORIG_BUT_PG_USES_PROFILE_IMAGES_FOLDER" | "PG_ROW_NOT_FOUND_VISIBLE";
  };
  const bugs: BugRow[] = [];
  const pgByClerk = new Map<string, PgRow>(pg.rows.map(r => [r.clerk_id, r]));
  for (const [clerk, pathsSet] of byFolder.entries()) {
    const paths = [...pathsSet].sort();
    const thumbs = paths.filter(p => parsed[p]?.thumb).sort();
    const origs = paths.filter(p => parsed[p]?.orig).sort();
    const bestThumb = thumbs[thumbs.length-1] || null;
    const bestImage = origs[origs.length-1] || thumbs[thumbs.length-1] || null;
    const pgRow = pgByClerk.get(clerk);
    if (!pgRow) {
      bugs.push({ clerk, email_lower: "", name: "", bestThumb, bestImageOnDisk: bestImage, allDiskPaths: paths, pgRefsFound: [], verdict: "PG_ROW_NOT_FOUND_VISIBLE" });
      continue;
    }
    const refs = rowToUploadsRefs(pgRow);
    // Does PG contain the latest thumb? (or any thumb in thumbs array)
    const anyThumbInPg = refs.some(r => thumbs.includes(r));
    const hasAnyMatchingUpload = refs.length > 0;
    let verdict: BugRow["verdict"];
    if (bestThumb && refs.includes(bestThumb)) verdict = "PG_HAS_MATCHING_THUMB_OK";
    else if (refs.length === 0) verdict = "DISK_ONLY_NO_PG_REF_MAJOR_BUG";
    else if (anyThumbInPg) verdict = "PG_HAS_MATCHING_THUMB_OK";
    else verdict = "DISK_ORPHAN_HAS_ORIG_BUT_PG_USES_PROFILE_IMAGES_FOLDER";
    bugs.push({ clerk, email_lower: pgRow.email_lower, name: (pgRow.fn||"") + " " + (pgRow.ln||""), bestThumb, bestImageOnDisk: bestImage, allDiskPaths: paths, pgRefsFound: refs, verdict });
  }
  // Add legacy profile-images folder paths joined by filename match in any field
  // (Skipping deep-join since we found 0% profileImageSource populated already in PG — so all 39 profile-images files are orphans if not referenced.)

  console.log("========== PART 2: For EVERY clerk userId folder ON DISK (" + byFolder.size + " total), is its thumbnail correctly saved to Postgres member_profiles.data.profileImage? ==========");
  const counts: Record<string, number> = {};
  for (const b of bugs) counts[b.verdict] = (counts[b.verdict]||0) + 1;
  console.log("");
  for (const k of Object.keys(counts)) console.log("   " + k + ":", counts[k], "/", byFolder.size, "=", Math.round(1000*counts[k]/byFolder.size)/10, "%");
  console.log("");

  const bugged = bugs.filter(b => b.verdict === "DISK_ONLY_NO_PG_REF_MAJOR_BUG");
  console.log("========== DISK_ONLY_NO_PG_REF_MAJOR_BUG count:", bugged.length, " ==========");
  console.log("These members uploaded an avatar via /dashboard/profile, upload succeeded → file on disk, but the write to member_profiles.data.profileImage NEVER HAPPENED. Their page renders blank! THE DISAPPEARED — this is the root cause.");
  console.log("");
  console.log("  Best disk file                                        clerk                          email                                name");
  console.log("--------------------------------------------------------------------------------------------------------------------------------------");
  for (const b of bugged) {
    console.log("  " + String(b.bestImageOnDisk || b.bestThumb || "").padEnd(58, " ") + " " + b.clerk.padEnd(30, " ") + " " + String(b.email_lower).padEnd(36, " ") + " " + b.name);
  }

  console.log("");
  console.log("========== PG_ROW_NOT_FOUND_VISIBLE count:", bugs.filter(b=>b.verdict==="PG_ROW_NOT_FOUND_VISIBLE").length, " (uploaded files but user NOT visible in member_profiles — maybe resigned/invisible clerks, or Ghost-only members who signed up through Ghost portal) ==========");
  for (const b of bugs.filter(b=>b.verdict==="PG_ROW_NOT_FOUND_VISIBLE").slice(0,20)) console.log("   clerk=", b.clerk, " paths=", b.allDiskPaths.length, b.allDiskPaths[0]);

  console.log("");
  console.log("========== LEGACY PROFILE-IMAGES FOLDER — 39 files on disk but Postgres profileImageSource field is 0% populated (reported in Part1 earlier). These files exist but no pointer ==========");
  console.log("Total legacy profile-images files on disk:", piFnames.length);
  const piRefsInAnyPg = pg.rows.flatMap(rowToUploadsRefs).filter(r => r.startsWith("/uploads/profile-images/"));
  console.log("Any profile-images path referenced anywhere in visible PG rows:", piRefsInAnyPg.length);
  const piDiskSet = new Set(piFnames.map(f => "/uploads/profile-images/" + (f.startsWith("/") ? "" : "") + f.split("/").pop()));
  // Correct set: just the full paths
  console.log("Unique /uploads/profile-images/ paths on disk:", piFnames.length);
  console.log("Unique /uploads/profile-images/ paths referenced in PG rows:", piRefsInAnyPg.length);
  // Legacy files without PG refs = DISAPPEARED-LEGACY
  const missingLegacy = piFnames.filter(p => !piRefsInAnyPg.includes(p));
  console.log("profile-images files MISSING from Postgres references:", missingLegacy.length);
  if (missingLegacy.length) {
    // Map each legacy file → who it could belong to? Best-effort match by user prefix in filename: user_<clerkId>-...jpeg or matching name hashes.
    console.log("These are the 39 legacy profile-images disk files:");
    for (const p of piFnames.slice(0,40)) console.log("   ", p);
  }
})().catch(e => { console.error("ERR", e); process.exit(1); });
