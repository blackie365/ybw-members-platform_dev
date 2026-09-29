#!/usr/bin/env npx tsx
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";

async function initFirebase() {
  // Lazy-load firebase-admin so that its own side effects don't hide env-load errors
  const env = (k: string) => process.env[k];
  console.log("[env] FIREBASE_PROJECT_ID:", { v: env("FIREBASE_PROJECT_ID"), len: env("FIREBASE_PROJECT_ID")?.length ?? "undefined" });
  console.log("[env] FIREBASE_CLIENT_EMAIL:", env("FIREBASE_CLIENT_EMAIL"));
  console.log("[env] FIREBASE_STORAGE_BUCKET:", env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"));
  let pk = env("FIREBASE_PRIVATE_KEY") || "";
  console.log("[env] FIREBASE_PRIVATE_KEY raw length:", pk.length, "head:", pk.substring(0, 24));
  pk = pk.trim();
  if (pk.startsWith('"')) pk = pk.slice(1);
  if (pk.endsWith('"')) pk = pk.slice(0, -1);
  pk = pk.replace(/\\n/g, "\n");
  console.log("[env] FIREBASE_PRIVATE_KEY parsed length:", pk.length, "hasPrivateKey:", pk.includes("PRIVATE KEY"));

  const admin = require("firebase-admin");
  if (typeof admin.initializeApp !== "function") throw new Error("bad firebase-admin import (CJS require)");
  const apps = (typeof admin.getApps === "function") ? admin.getApps() : (admin.apps ?? []);
  if (apps.length) return (typeof admin.getApp === "function") ? admin.getApp() : apps[0];
  const PROJECT_ID = env("FIREBASE_PROJECT_ID") || env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const CLIENT_EMAIL = env("FIREBASE_CLIENT_EMAIL");
  const STORAGE_BUCKET = env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!pk.includes("PRIVATE KEY")) throw new Error("Bad Firebase private key — length=" + pk.length);
  const certFn = (admin.credential?.cert) ?? admin.cert;
  if (typeof certFn !== "function") {
    console.log("[admin shape]", Object.keys(admin).slice(0, 20));
    throw new Error("firebase-admin credential.cert unavailable");
  }
  return admin.initializeApp({
    credential: certFn({
      projectId: PROJECT_ID,
      clientEmail: CLIENT_EMAIL,
      privateKey: pk,
    }),
    storageBucket: STORAGE_BUCKET,
  });
}

async function listAll(bucket: any, prefix: string) {
  let token: string | undefined;
  const files: any[] = [];
  while (true) {
    const [batch, next] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: 1000, pageToken: token } as any);
    files.push(...batch);
    token = (next as any)?.pageToken;
    if (!token) break;
    if (files.length > 20000) break;
  }
  return files;
}

type GsFile = { name: string; size: number; updated: string; md5: string; generation: string };

async function main() {
  const app = await initFirebase();
  const admin = require("firebase-admin");
  let bucket: any;
  if (typeof (admin as any).getStorage === "function") {
    bucket = (admin as any).getStorage(app).bucket();
  } else if (typeof (app as any).storage === "function") {
    bucket = (app as any).storage().bucket();
  } else {
    const storageMod = require("firebase-admin/storage");
    bucket = storageMod.getStorage(app).bucket();
  }
  console.log("Firebase storage bucket:", bucket.name);

  const prefixes = ["members/", "membersLogos/", "profile-images/", "user_"];
  const all: GsFile[] = [];
  for (const p of prefixes) {
    try {
      const files = await listAll(bucket, p);
      console.log(`  gs://${bucket.name}/${p}* files: ${files.length}`);
      for (const f of files) {
        const meta: any = f.metadata;
        all.push({
          name: f.name,
          size: parseInt(meta.size || "0", 10),
          updated: meta.updated || "",
          md5: meta.md5Hash || "",
          generation: meta.generation || "",
        });
      }
    } catch (e: any) {
      console.log(`  prefix ${p} skipped:`, e?.code || e?.message || String(e));
    }
  }

  // Try root-level members avatar (legacy folders)
  try {
    const root = await bucket.getFiles({ autoPaginate: false, maxResults: 300, delimiter: "/" } as any);
    const prefixesRoot = (root as any)[1] || [];
    console.log("\nTop-level prefixes (folders) in bucket:", prefixesRoot.length);
    for (const p of prefixesRoot.slice(0, 30)) console.log("  /", p);
  } catch {}

  console.log(`\nTotal member-relevant files in Firebase storage: ${all.length}`);
  const prefixCounts: Record<string, number> = {};
  for (const f of all) {
    const p = f.name.split("/")[0] + "/";
    prefixCounts[p] = (prefixCounts[p] || 0) + 1;
  }
  console.log("By top-level prefix:", JSON.stringify(prefixCounts, null, 2));

  // Cross-check with Postgres: for each visible member (clerk_id formats), build
  // candidate member/{folderKey}/avatar.* file matches
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const vis = (await pool.query(`
    SELECT clerk_id, email_lower, char_length(clerk_id) AS clen,
      data->>'avatarUrl' AS av, data->>'profileImage' AS pi, data->>'image' AS im
    FROM member_profiles WHERE visibility='visible' AND is_active=true
  `)).rows;
  console.log(`\nPostgres visible members: ${vis.length}`);

  // Build Firebase FS lookup tables
  // - Pattern 1: members/{firebaseShortUid}/avatar*.* (main migration path)
  // - Pattern 2: profile-images/{user_*}-{ts}.* (new Clerk path)
  // - Pattern 3: membersLogos/{name}.* (company logos)
  const fbMembersAvatarFiles = all.filter(f => f.name.startsWith("members/") && /avatar/i.test(f.name));
  const fbFolderKeys = new Set<string>();
  const fbFilesByFolder: Record<string, GsFile[]> = {};
  for (const f of all) {
    if (!f.name.startsWith("members/")) continue;
    const parts = f.name.split("/");
    if (parts.length < 2) continue;
    const k = parts[1];
    fbFolderKeys.add(k);
    (fbFilesByFolder[k] = fbFilesByFolder[k] || []).push(f);
  }
  console.log(`Firebase members/*/ subfolder keys: ${fbFolderKeys.size}`);
  console.log(`Firebase members/* files matching "avatar" in filename: ${fbMembersAvatarFiles.length}`);

  // Cross 1: Firebase folderKey (members/X/) matches PG clerk_id directly?
  const pgVisibleClerks = new Set(vis.map(r => r.clerk_id));
  const f1 = [...fbFolderKeys].filter(k => pgVisibleClerks.has(k)).length;
  console.log(`\n=== MATCH 1: Firebase folder key == PG clerk_id (direct) ===`);
  console.log(`  Firebase folder keys ${fbFolderKeys.size} vs visible PG clerk_ids ${pgVisibleClerks.size} → DIRECT MATCH: ${f1}`);

  // Cross 2: Firebase folder key is a SHORTENED prefix of PG clerk_id (Firebase 20/24 vs PG 28/32)
  // PG clerk_id prefixes bucket by length 20, 21, 22, 24 against Firebase folder keys.
  const matchByLen: Record<string, number> = {};
  const exactByLen: Record<string, string[]> = {};
  for (const [lenS, desc] of [
    [20, "prefix-20"],
    [21, "prefix-21"],
    [22, "prefix-22"],
    [24, "prefix-24"],
    [28, "prefix-28"],
    [32, "prefix-32"],
  ] as const) {
    const kset = new Set([...fbFolderKeys].filter(k => k.length === lenS));
    const pset = new Set(vis.filter(r => r.clerk_id.length >= lenS).map(r => r.clerk_id.substring(0, lenS)));
    let inter = 0;
    for (const k of kset) if (pset.has(k)) inter++;
    matchByLen[`${desc}(FB_len=${lenS})_vs_PG_prefixes[${lenS}]`] = inter;
    exactByLen[desc] = [];
    if (inter) {
      // Sample first 10 matches
      const samples: string[] = [];
      for (const k of kset) if (pset.has(k) && samples.length < 10) samples.push(k);
      exactByLen[desc] = samples;
    }
  }
  console.log(`\n=== MATCH 2: Firebase folder key (by length N) == PG clerk_id.prefix(N) ===`);
  console.log(JSON.stringify(matchByLen, null, 2));
  for (const k of Object.keys(exactByLen)) if (exactByLen[k].length) {
    console.log(`  Sample ${k}: ${exactByLen[k].join(", ")}`);
  }

  // Cross 3: PG email_lower → email -> find Firebase user by email via admin.auth.getUserByEmail -> uid
  // → folder members/{fbAuthUid}/avatar*  (the GOLDEN match path — when Firebase Auth UID != Firestore doc.id)
  console.log(`\n=== MATCH 3: Firebase auth.getUserByEmail(email) → auth.uid → members/{uid}/ EXISTS? (all 157 visible) ===`);
  const byEmailMatch: any[] = [];
  let auth: any;
  try {
    const modAuth = require("firebase-admin/auth");
    auth = modAuth.getAuth(app);
  } catch (e) {
    const adminImported = require("firebase-admin");
    auth = adminImported.auth ? adminImported.auth(app) : undefined;
  }
  if (!auth || typeof auth.getUserByEmail !== "function") {
    console.log("  Auth init FAIL — dumping require keys");
    console.log("  firebase-admin top keys:", Object.keys(require("firebase-admin")).slice(0, 20));
    try { console.log("  firebase-admin/auth keys:", Object.keys(require("firebase-admin/auth")).slice(0, 20)); } catch {}
    throw new Error("cannot get admin.auth().getUserByEmail");
  }
  for (const r of vis) {
    try {
      const u = await auth.getUserByEmail(r.email_lower);
      const uid = u.uid;
      const hasFolder = fbFolderKeys.has(uid);
      const prefs = [];
      for (const L of [20, 22, 24, 28]) {
        if (uid.length >= L && fbFolderKeys.has(uid.substring(0, L))) prefs.push(`prefix${L}=${uid.substring(0, L)}`);
      }
      const avatarsBest = hasFolder ? (fbFilesByFolder[uid] || []).filter(f => /avatar/i.test(f.name) || f.size > 5000).sort((a, b) => b.size - a.size)[0] : undefined;
      byEmailMatch.push({
        email: r.email_lower,
        pg_clerk_id: r.clerk_id,
        pg_clerkid_len: r.clen,
        pg_has_real_photo: (/\/uploads\//.test(r.av || "") || /\/uploads\//.test(r.pi || "") || /\/uploads\//.test(r.im || "") || ((r.av || r.pi || r.im || "").startsWith("http") && !/gravatar|img\.clerk\.com/.test((r.av || r.pi || r.im || "")))),
        fb_auth_uid: uid,
        fb_uid_len: uid.length,
        direct_folder_match: hasFolder,
        prefix_folder_matches: prefs.join(" "),
        avatar_file: avatarsBest ? `${avatarsBest.name} (${avatarsBest.size}b, ${avatarsBest.updated})` : "",
      });
    } catch (e: any) {
      byEmailMatch.push({
        email: r.email_lower,
        pg_clerk_id: r.clerk_id,
        pg_clerkid_len: r.clen,
        fb_user_not_found: e?.code === "auth/user-not-found" ? e.code : (e?.code || String(e)).substring(0, 40),
      });
    }
  }
  const hits = byEmailMatch.filter(r => r.direct_folder_match);
  const gapHits = byEmailMatch.filter(r => r.direct_folder_match && r.pg_has_real_photo === false);
  console.log(`\n=== MATCH 3 HITS ===
All 157 visible → FB auth users found: ${byEmailMatch.filter(r => !r.fb_user_not_found).length}
Direct folder members/{fbAuthUid}/ EXISTS: ${hits.length}
  Of which — current PG photo gap (no real photo stored yet): ${gapHits.length} ← RECOVERABLE TARGET
Gap-hits (recoverable, blank-only candidates — all):`);
  console.table(gapHits.map(r => ({
    email: r.email,
    pg_clerk_id: r.pg_clerk_id,
    fb_auth_uid_prefix: (r.fb_auth_uid || "").substring(0, 20),
    fb_uid_len: r.fb_uid_len,
    avatar: r.avatar_file ? (r.avatar_file.length > 90 ? r.avatar_file.substring(0, 87) + "..." : r.avatar_file) : "",
  })));
  console.log(`\nFull hit-set (157) — just keys:`);
  console.table(byEmailMatch.map(r => ({
    email: r.email,
    pg_has_real_photo: !!r.pg_has_real_photo,
    fb_found: !r.fb_user_not_found,
    fb_folder: r.direct_folder_match ? "YES" : "",
    fb_uid_len: r.fb_uid_len || "-",
    miss_reason: r.fb_user_not_found || (r.direct_folder_match ? "" : "FB_uid=no_folder"),
  })).slice(0, 157));

  console.log(`\n=== MATCH 4: FB folderKey → Firestore members/{folderKey} doc.email → PG email match (176 real folder keys) ===`);
  const adminFire: any = require("firebase-admin");
  let firestore: any;
  try {
    const modFire = require("firebase-admin/firestore");
    firestore = modFire.getFirestore(app);
  } catch (e) {
    firestore = adminFire.firestore ? adminFire.firestore(app) : undefined;
  }
  const fkArr = [...fbFolderKeys].filter(k => k.length >= 20);
  const folderKeyToEmail: Record<string, string> = {};
  const folderKeyToDoc: Record<string, { email?: string; avatarUrl?: string; image?: string; uid?: string; firestoreUid?: string; displayName?: string }> = {};
  const folderKeyAlreadyInPG = new Set<string>();
  // 1) Folder keys ALREADY in PG JSONB /uploads/members/X/ substring = confirmed accounted
  for (const r of vis) {
    const urls = [r.av, r.pi, r.im].map(s => (s || "").trim());
    for (const u of urls) {
      const m = u.match(/\/uploads\/members\/([^/]+)\//);
      if (m) folderKeyAlreadyInPG.add(m[1]);
    }
  }
  console.log("FB real folder keys:", fkArr.length);
  console.log("Already matched to /uploads/members/X in PG refs:", folderKeyAlreadyInPG.size);
  const orphanFolderKeys = fkArr.filter(k => !folderKeyAlreadyInPG.has(k));
  console.log("ORPHAN FB folder keys (avatar not yet in PG):", orphanFolderKeys.length);
  // 2) Pull orphans from Firestore (folderKey = members doc.id)
  const orphanBatches: any[] = [];
  for (let i = 0; i < orphanFolderKeys.length; i += 30) orphanBatches.push(orphanFolderKeys.slice(i, i + 30));
  let firestoreTries = 0, firestoreHits = 0;
  if (firestore && typeof firestore.getAll === "function") {
    const membersCol = firestore.collection("members");
    for (const batch of orphanBatches) {
      firestoreTries += batch.length;
      try {
        const snaps: any[] = await firestore.getAll(...batch.map(k => membersCol.doc(k)));
        for (const s of snaps) {
          if (!s?.exists) continue;
          const d = s.data() || {};
          const id = s.id;
          const em = (d.email || d.memberEmail || d.userEmail || "") as string;
          if (em) folderKeyToEmail[id] = String(em).toLowerCase();
          folderKeyToDoc[id] = {
            email: em,
            avatarUrl: d.avatarUrl || d.avatar || d.photoURL || d.photoUrl || d.image || "",
            image: d.image || d.logo || "",
            uid: d.uid || d.firebaseUid || d.firestoreUid || d.authUid || "",
            displayName: d.displayName || d.name || d.fullName || "",
          };
          firestoreHits++;
        }
      } catch (e: any) {
        console.log("  Firestore.getAll batch failed (fallback to .doc().get()):", e?.code || e.message);
        for (const k of batch) {
          try {
            const s = await membersCol.doc(k).get();
            firestoreTries++;
            if (s.exists) {
              const d = s.data() || {};
              const em = (d.email || d.memberEmail || d.userEmail || "") as string;
              if (em) folderKeyToEmail[k] = String(em).toLowerCase();
              folderKeyToDoc[k] = { email: em, avatarUrl: d.avatarUrl || d.image || "", uid: d.uid || "", displayName: d.displayName || d.name || "" };
              firestoreHits++;
            }
          } catch {}
        }
      }
    }
  } else if (firestore && typeof firestore.collection === "function") {
    const col = firestore.collection("members");
    for (const k of orphanFolderKeys.slice(0, 180)) {
      try {
        const s = await col.doc(k).get();
        firestoreTries++;
        if (s.exists) {
          const d = s.data() || {};
          const em = (d.email || d.memberEmail || d.userEmail || "") as string;
          if (em) folderKeyToEmail[k] = String(em).toLowerCase();
          folderKeyToDoc[k] = { email: em, avatarUrl: d.avatarUrl || d.image || "", uid: d.uid || "", displayName: d.displayName || d.name || "" };
          firestoreHits++;
        }
      } catch {}
    }
  }
  console.log(`Firestore orphans attempted: ${firestoreTries}, firestoreHits with doc.email: ${Object.keys(folderKeyToEmail).length}`);
  // Orphans matched to PG visible via email (firestore doc.email == PG.email_lower) — this is the recovery list!
  const orphanMatch = orphanFolderKeys
    .filter(k => folderKeyToEmail[k])
    .map(k => ({
      folderKey: k,
      email: folderKeyToEmail[k],
      pg_visible: vis.find(r => r.email_lower === folderKeyToEmail[k]),
      bestAvatar: (fbFilesByFolder[k] || []).filter(f => /avatar/i.test(f.name) || f.size > 5000).sort((a, b) => b.size - a.size)[0],
    }));
  const orphanWithPG = orphanMatch.filter(o => !!o.pg_visible);
  const orphanRecoverable = orphanWithPG.filter(o => {
    const r = o.pg_visible!;
    const urls = [r.av, r.pi, r.im].map(s => (s || "").trim());
    const hasReal = urls.some(u => u.startsWith("/uploads/") || u.startsWith("http") && !u.includes("gravatar.com") && !u.includes("img.clerk.com"));
    return !hasReal;
  });
  console.log(`\n=== ORPHAN RECOVERABLE (MATCH 4 FIRESTORE SUCCESS) ===
Orphan folder keys with Firestore email found: ${orphanMatch.length}
  → matched to visible PG member row by email: ${orphanWithPG.length}
  → of those, PG still has NO real photo (blank-only backfill eligible): ${orphanRecoverable.length} ← RECOVERABLE TARGET!
Top 30 of orphanRecoverable (email matches, photo gap, FB avatar ready to download):`);
  console.table(orphanRecoverable.slice(0, 30).map(o => ({
    email: o.email,
    folderKey: o.folderKey,
    bestAvatar: o.bestAvatar ? `${o.bestAvatar.name} ${o.bestAvatar.size}b` : "(none)",
    pg_clerk_id: o.pg_visible!.clerk_id,
    pg_clerk_id_len: o.pg_visible!.clerk_id.length,
  })));

  console.log(`\n=== MATCH 5: For 126 visible members matched to FB Auth user → photoURL contains folderKey? customClaims.uid/firestoreId? ===`);
  const fbFoundRows = byEmailMatch.filter(r => !r.fb_user_not_found && r.pg_has_real_photo === false);
  let photoUrlFolderHits = 0, customClaimFolderHits = 0;
  const match5Recoverable: any[] = [];
  for (const r of fbFoundRows) {
    try {
      const u = await auth.getUser(r.fb_auth_uid);
      const photoURL = (u.photoURL || "") as string;
      const claims = (u.customClaims || {}) as any;
      const candidates = [photoURL, claims.uid, claims.firestoreId, claims.firestoreDocId, claims.firebaseUid, claims.memberId, claims.docId].filter(Boolean) as string[];
      let hit: string | undefined;
      for (const c of candidates) {
        for (const k of orphanFolderKeys) {
          if (c.includes(k) || String(claims.uid || "") === k) { hit = k; break; }
        }
        if (hit) break;
      }
      if (photoURL && orphanFolderKeys.some(k => photoURL.includes(k))) { hit = hit || orphanFolderKeys.find(k => photoURL.includes(k))!; photoUrlFolderHits++; }
      if (claims && Object.values(claims).some(v => typeof v === "string" && orphanFolderKeys.some(k => v.includes(k)))) customClaimFolderHits++;
      if (hit) {
        const bestAvatar = (fbFilesByFolder[hit] || []).filter(f => /avatar/i.test(f.name) || f.size > 5000).sort((a, b) => b.size - a.size)[0];
        match5Recoverable.push({ email: r.email, clerk_id: r.pg_clerk_id, folderKey: hit, bestAvatar: bestAvatar?.name || "", size: bestAvatar?.size || 0 });
      }
    } catch {}
  }
  console.log(`photoURL folderKey hits: ${photoUrlFolderHits}, customClaims folderKey hits: ${customClaimFolderHits}`);
  console.log(`MATCH 5 recoverable combined: ${match5Recoverable.length}`);
  if (match5Recoverable.length) console.table(match5Recoverable.slice(0, 30));

  // Summary file for plan
  const summary = {
    bucket: bucket.name,
    storage_total_files: all.length,
    storage_members_folders: fbFolderKeys.size,
    storage_members_folders_real: fkArr.length,
    storage_members_avatar_files: fbMembersAvatarFiles.length,
    pg_visible: vis.length,
    pg_has_real_photo: vis.filter(r => [r.av, r.pi, r.im].some(s =>
      s?.startsWith("/uploads/") || s?.startsWith("http") && !s.includes("gravatar.com"))).length,
    match1_direct_clerkid_equals_folderkey: f1,
    match2_prefix: matchByLen,
    match3_auth_users_found: byEmailMatch.filter(r => !r.fb_user_not_found).length,
    match3_folder_matches_by_authuid: hits.length,
    match4_firestore_orphan_attempted: firestoreTries,
    match4_firestore_email_hits: Object.keys(folderKeyToEmail).length,
    match4_orphan_matched_to_visible_pg: orphanWithPG.length,
    match4_orphan_RECOVERABLE_blankonly: orphanRecoverable.length,
    match5_photoUrl_or_customClaims_hits: match5Recoverable.length,
  };
  const fn = path.join(process.cwd(), "scripts/.audit-firebase-storage-summary.json");
  fs.writeFileSync(fn, JSON.stringify({
    ...summary,
    orphanRecoverable,
    match5Recoverable,
    folderKeyAlreadyInPG_count: folderKeyAlreadyInPG.size,
    orphanFolderKeys_count: orphanFolderKeys.length,
  }, null, 2));
  const csv = "name,size,updated,md5,generation\n" +
    all.map(f => [JSON.stringify(f.name), f.size, JSON.stringify(f.updated), JSON.stringify(f.md5), f.generation].join(",")).join("\n") + "\n";
  fs.writeFileSync("/tmp/firebase-storage-listing.csv", csv, "utf8");
  // Also write recoverable CSV for user review
  const recRows = [
    ["email","clerk_id","folderKey","firebase_file","size_bytes","updated_at"],
    ...orphanRecoverable.map(o => [
      o.email, o.pg_visible!.clerk_id, o.folderKey,
      JSON.stringify(o.bestAvatar?.name || ""), o.bestAvatar?.size || 0, JSON.stringify(o.bestAvatar?.updated || ""),
    ].join(",")),
    ...match5Recoverable.filter(r => !orphanRecoverable.some(o => o.email === r.email)).map(r => [
      r.email, r.clerk_id, r.folderKey, JSON.stringify(r.bestAvatar), r.size, "",
    ].join(",")),
  ];
  const recCsv = recRows.join("\n") + "\n";
  fs.writeFileSync("/tmp/firebase-backfill-candidates.csv", recCsv);
  console.log(`\nWrote ${fn}`);
  console.log(`Wrote /tmp/firebase-storage-listing.csv rows = ${all.length}`);
  console.log(`Wrote /tmp/firebase-backfill-candidates.csv rows = ${recRows.length - 1}`);
  console.log(`\n=== FINAL FIREBASE RECOVERY SUMMARY ===`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nBackfill candidate list (${orphanRecoverable.length + match5Recoverable.filter(r => !orphanRecoverable.some(o => o.email === r.email)).length} members) saved at /tmp/firebase-backfill-candidates.csv.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
