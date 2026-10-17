#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
import { execSync } from "child_process";

async function main() {
  // STEP A: Verify Featured image on VPS disk + HTTP (Amanda Owen, clerk QUNvyEkmGlbOGxBVsLiX93naKzC2, photo path references 5D6 folderKey)
  console.log("=== A. VPS Disk & HTTP verify — Featured Amanda Owen photo path ===");
  const paths = [
    "/srv/ybw-frontend/uploads/members/5D6hUgLsWsQpVPlxd9Qp/avatar-1770214137806-thumb.jpg",
    "/srv/ybw-frontend/uploads/members/QUNvyEkmGlbOGxBVsLiX93naKzC2/",
    "/srv/ybw-frontend/uploads/profile-images/user_3E3MiKpxV8gGLutnkngvNHOWZhs-1782228685560.jpg" // Rebecca
  ];
  const SSH_OPTS = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=error -o ConnectTimeout=30";
  function runVps(cmd: string) { try { return execSync(`ssh ${SSH_OPTS} root@vps725503.ovh.net "${cmd}"`, { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }); }
  catch (e: any) { return "ERR " + (e?.stderr?.toString() || e.message || String(e)); } }
  function runRetry(cmd: string, retries=4, backoff=7000) {
    let attempts = 0, lastErr=null;
    while (attempts++ < retries) {
      try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }); }
      catch (e: any) { lastErr = e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0, backoff*attempts); }
    }
    return "ERR " + (lastErr?.stderr?.toString() || lastErr?.message || String(lastErr));
  }
  for (const p of paths) {
    const out = runRetry(`ssh ${SSH_OPTS} root@vps725503.ovh.net "ls -la '${p}' 2>&1 || echo MISSING"`);
    console.log(`  ${p}:\n    ${out.split("\n").slice(0,5).join("\n    ")}`);
  }
  console.log("\n=== HTTP HEAD sweep ===");
  const urls = [
    "https://yorkshirebusinesswoman.co.uk/uploads/members/5D6hUgLsWsQpVPlxd9Qp/avatar-1770214137806-thumb.jpg",
    "https://yorkshirebusinesswoman.co.uk/uploads/profile-images/user_3E3MiKpxV8gGLutnkngvNHOWZhs-1782228685560.jpg",
  ];
  for (const u of urls) {
    const code = execSync(`curl -sS -o /dev/null -w "%{http_code}" "${u}"`, { encoding: "utf8" });
    console.log(`  HTTP ${code} ${u}`);
  }

  // STEP B: Firestore lookup for Rebecca's folderKey A7IuSwmuuB24BQABKzEs — what bio/name was stored in Legacy?
  console.log("\n=== B. Firestore Legacy pull for Rebecca (folder A7IuSwmuuB24BQABKzEs, rebecca@youbeemedia) — get her old bio/name ===");
  const mod = require("firebase-admin");
  let pk = process.env.FIREBASE_PRIVATE_KEY || "";
  pk = pk.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  const certFn = mod.credential?.cert ?? mod.cert;
  const app = mod.getApps().length ? mod.getApp() : mod.initializeApp({
    credential: certFn({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  const firestore = require("firebase-admin/firestore").getFirestore(app);
  // All 3 collections, look for docId/email or ANY value containing A7Iu OR rebecca@youbeemedia.co.uk
  const pulls: Record<string, any[]> = {};
  for (const col of ["memberImageBackup","newMemberCollection","members_v2"]) {
    const q = firestore.collection(col);
    const snap = await q.limit(400).get();
    const matches: any[] = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      const flat = JSON.stringify(d).toLowerCase();
      if (doc.id.toLowerCase().includes("rebecca@youbeemedia") || flat.includes("rebecca@youbeemedia") || flat.includes("a7iuswmuub24bqabkz") || flat.includes("hopwood")) matches.push({ id: doc.id, data: d });
    }
    pulls[col] = matches;
    console.log(`  ${col}: ${matches.length} matches`);
    for (const m of matches.slice(0, 3)) {
      const d = m.data;
      console.log(`    id=${m.id.slice(0,30)}… bio=${String(d.bio || d.about || d.description || '').slice(0, 300) || '<empty>'} name=${d.firstName||''} ${d.lastName||''} displayName=${d.displayName||''} title=${d.jobTitle||d.role||''} company=${d.companyName||d.company||''}`);
    }
  }

  // STEP C: List the top 10 visible+active members with real photo + long bio, to propose a better Featured candidate if Amanda's photo is broken
  console.log("\n=== C. Top 10 Featured candidates (real photo, bio>200 chars, visible+active) — pick default fallback ===");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const cand = await pool.query(`
    SELECT clerk_id,data->>'displayName' name, length(data->>'bio') biolen,data->>'companyName' co,data->>'jobTitle' jt,data->>'profileImage' pi
     FROM member_profiles
     WHERE visibility='visible' AND is_active=true
       AND (COALESCE(data->>'profileImage','') LIKE '/uploads/%' OR COALESCE(data->>'image','') LIKE '/uploads/%' OR COALESCE(data->>'avatarUrl','') LIKE '/uploads/%')
       AND length(data->>'bio')>140
     ORDER BY random()
     LIMIT 10
  `);
  for (const r of cand.rows) console.log(`  ${r.name?.slice(0,30).padEnd(30)} | bio=${String(r.biolen).padEnd(5)} | pi_ok=${String(r.pi || '').startsWith('/uploads/')} pi=${String(r.pi||'').slice(0,60)}…`);
  console.log(`Count ${cand.rowCount}`);
  await pool.end();
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
