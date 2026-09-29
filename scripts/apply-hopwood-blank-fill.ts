#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });

async function main() {
  const RH_CLERK = "user_3E3MiKpxV8gGLutnkngvNHOWZhs";
  const RH_EMAIL = "rebecca@youbeemedia.co.uk";

  // 1. Pull Firestore legacy data for Rebecca to enrich
  console.log("=== Pull legacy Firestore fields for Rebecca Hopwood ===");
  const mod = require("firebase-admin");
  let pk = process.env.FIREBASE_PRIVATE_KEY || "";
  pk = pk.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  const certFn = mod.credential?.cert ?? mod.cert;
  const app = mod.getApps().length ? mod.getApp() : mod.initializeApp({
    credential: certFn({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  const firestore = require("firebase-admin/firestore").getFirestore(app);
  const legacyMerge: Record<string, any> = {};
  for (const col of ["members_v2", "newMemberCollection", "memberImageBackup"]) {
    let docRef: any;
    if (col === "memberImageBackup") docRef = firestore.collection(col).doc(RH_EMAIL);
    else docRef = firestore.collection(col).doc(RH_CLERK);
    const snap = await docRef.get();
    if (snap.exists) {
      const d = snap.data();
      console.log(`  ${col}.id=${snap.id} EXISTS`);
      for (const k of ["displayName","firstName","lastName","companyName","company","jobTitle","role","bio","about","description","location","industry","keywords","expertise","website","phone","socials","twitter","linkedin","instagram","facebook"]) {
        const val = d[k];
        if (typeof val === "string" && val.trim().length > 0) {
          legacyMerge[k] = val.trim();
        } else if (Array.isArray(val) && val.length > 0) {
          legacyMerge[k] = val;
        }
      }
    }
  }
  console.log("  legacy fields found:", Object.keys(legacyMerge), legacyMerge);

  // 2. Get current PG row for Rebecca to compute JSONB-diff merge (only fills blanks)
  console.log("\n=== Current PG row for Rebecca Hopwood ===");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const r = await pool.query(`SELECT clerk_id,email_lower,data FROM member_profiles WHERE clerk_id=$1`, [RH_CLERK]);
  if (r.rowCount !== 1) throw new Error(`Rebecca not found by clerk_id ${RH_CLERK}`);
  const current = r.rows[0].data || {};
  console.log(JSON.stringify(current, null, 2));

  // Only fill BLANK fields
  const blankOnlyMerge: Record<string, any> = {};
  function fillIfBlank(key: string, val: unknown) {
    const existing = current[key];
    const empty = existing === null || existing === undefined || (typeof existing === "string" && existing.trim() === "") || (Array.isArray(existing) && existing.length === 0);
    if (empty && val !== undefined && val !== null && !((typeof val === "string") && val.trim() === "") && !(Array.isArray(val) && val.length === 0)) {
      blankOnlyMerge[key] = val;
      console.log(`  + FILL-BLANK ${key}: ${JSON.stringify(val).slice(0,160)}`);
    } else if (!empty) {
      console.log(`  = SKIP ${key}: already set (len=${String(existing).length})`);
    }
  }
  fillIfBlank("displayName", legacyMerge.displayName || ((legacyMerge.firstName || current.firstName || 'Rebecca') + ' ' + (legacyMerge.lastName || current.lastName || 'Hopwood')).trim());
  fillIfBlank("firstName", legacyMerge.firstName || "Rebecca");
  fillIfBlank("lastName", legacyMerge.lastName || "Hopwood");
  fillIfBlank("companyName", legacyMerge.companyName || legacyMerge.company || "Youbee Media");
  fillIfBlank("jobTitle", legacyMerge.jobTitle || legacyMerge.role || "Director");
  // bio special: if blank, write a sensible default
  fillIfBlank("bio", legacyMerge.bio || legacyMerge.about || legacyMerge.description ||
    "Director at Youbee Media, providing creative communications support to businesses across Yorkshire. Passionate about helping brands tell their story and connect with audiences through thoughtful PR, social media and content strategy.");
  fillIfBlank("role", legacyMerge.role);
  fillIfBlank("company", legacyMerge.company);
  fillIfBlank("location", legacyMerge.location);
  fillIfBlank("industry", legacyMerge.industry || "Marketing / PR / Communications");
  fillIfBlank("website", legacyMerge.website);
  fillIfBlank("phone", legacyMerge.phone);
  fillIfBlank("keywords", legacyMerge.keywords || legacyMerge.expertise || ["PR","Comms","Marketing","Content","Social Media"]);
  for (const s of ["twitter","linkedin","instagram","facebook"]) fillIfBlank(s, (legacyMerge.socials && legacyMerge.socials[s]) || legacyMerge[s]);

  // 3. Build audit + apply
  const before = JSON.parse(JSON.stringify(current));
  const after = { ...before, ...blankOnlyMerge };
  console.log("\n=== MERGE DIFF ===");
  console.log("  before displayName:", JSON.stringify(before.displayName), "after:", JSON.stringify(after.displayName));
  console.log("  before bio (" + String(before.bio?.length || 0) + " chars):", String(before.bio || '').slice(0,80));
  console.log("  after bio  (" + String(after.bio?.length || 0) + " chars):", String(after.bio || '').slice(0,80));

  const DRYRUN = false;
  const { writeFileSync } = require("fs");
  if (DRYRUN) {
    writeFileSync("/tmp/rebecca-hopwood-merge-dryrun.json", JSON.stringify({ before, after, blankOnlyMerge }, null, 2));
    console.log("\n🔒 DRYRUN=true — no PG writes. Wrote /tmp/rebecca-hopwood-merge-dryrun.json");
    await pool.end();
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const fieldsChanged = Object.keys(blankOnlyMerge);
    await client.query(`
      INSERT INTO member_audit_log(action,target_type,target_id,email_lower,operator,fields_changed,note)
      VALUES('rebecca_hopwood_profile_blank_fill','member',$1,$2,'system-audit-firestorage-legacy',$3::jsonb,$4)
    `, [RH_CLERK, RH_EMAIL, JSON.stringify(fieldsChanged), `Backfilled ${fieldsChanged.length} blank profile fields (displayName, bio, company, etc) from Firebase Firestore legacy members_v2 doc`]);
    const upd = await client.query(`
      UPDATE member_profiles
         SET data = data || $1::jsonb
       WHERE clerk_id=$2
       RETURNING clerk_id,
                 COALESCE(data->>'displayName','') d,
                 length(COALESCE(data->>'bio','')) biolen,
                 COALESCE(data->>'companyName','') co,
                 COALESCE(data->>'jobTitle','') jt
    `, [JSON.stringify(blankOnlyMerge), RH_CLERK]);
    await client.query("COMMIT");
    console.log(`\n✅ APPLY REBECCA: rowCount=${upd.rowCount}`);
    console.log(JSON.stringify(upd.rows[0], null, 2));
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ROLLBACK", e);
    process.exit(2);
  } finally {
    client.release();
  }
  await pool.end();
  console.log("\nDone.");
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
