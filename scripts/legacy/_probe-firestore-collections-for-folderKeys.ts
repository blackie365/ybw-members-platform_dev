import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
import * as fs from "fs";

async function main() {
  const mod = require("firebase-admin");
  let pk = process.env.FIREBASE_PRIVATE_KEY || "";
  pk = pk.trim();
  if (pk.startsWith('"')) pk = pk.slice(1);
  if (pk.endsWith('"')) pk = pk.slice(0, -1);
  pk = pk.replace(/\\n/g, "\n");
  const certFn = mod.credential?.cert ?? mod.cert;
  const app = (mod.getApps().length) ? mod.getApp() : mod.initializeApp({
    credential: certFn({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  const fM = require("firebase-admin/firestore");
  const firestore = fM.getFirestore(app);
  const auth = (require("firebase-admin/auth")).getAuth(app);

  // 0. Get folder keys from CSV
  const parseCsv = (ln: string): string[] => {
    const out: string[] = []; let cur = ""; let inQ = false;
    for (let i = 0; i < ln.length; i++) {
      const c = ln[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur); return out;
  };
  const folderKeys = new Set<string>();
  for (const l of fs.readFileSync("/tmp/firebase-storage-listing.csv","utf8").split("\n").slice(1).filter(Boolean)) {
    const cols = parseCsv(l); const f = cols[0];
    if (!f.startsWith("members/")) continue;
    const parts = f.split("/"); if (parts.length >= 2 && parts[1] && parts[1] !== "members") folderKeys.add(parts[1]);
  }
  const realFk = [...folderKeys].filter(k => k.length >= 20);
  console.log("FB folder keys:", realFk.length);
  const fkSet = new Set(realFk);

  // 1. Postgres: which folderKeys ALREADY in /uploads/members/X in refs
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const { rows: vis } = await pool.query(`
    SELECT clerk_id, email_lower, data->>'avatarUrl' AS av, data->>'profileImage' AS pi, data->>'image' AS im
    FROM member_profiles WHERE visibility='visible' AND is_active=true`);
  const folderKeyInPG = new Set<string>();
  for (const r of vis) {
    for (const s of [r.av, r.pi, r.im]) {
      const m = (s || "").match(/\/uploads\/members\/([^/]+)\//);
      if (m) folderKeyInPG.add(m[1]);
    }
  }
  const orphans = realFk.filter(k => !folderKeyInPG.has(k));
  console.log("PG already has folderKeys:", folderKeyInPG.size, "ORPHANS:", orphans.length);
  const orphanSet = new Set(orphans);

  // 2. Scan 3 candidate Firestore collections for ANY string field containing members/{folderKey}/:
  const emailFromCollections: Record<string, string[]> = {
    memberImageBackup: [], newMemberCollection: [], members_v2: [],
  };
  const orphanToEmail: Record<string, Set<string>> = {};
  const fieldPath: any = (fM.FieldPath || {}).documentId
    ? fM.FieldPath.documentId()
    : (firestore.FieldPath || {}).documentId
      ? firestore.FieldPath.documentId()
      : "__name__";
  for (const cname of Object.keys(emailFromCollections)) {
    console.log(`\nScanning collection "${cname}"…`);
    let cursor: any = null; let n = 0, hits = 0;
    let safeIterations = 0;
    while (true) {
      safeIterations++; if (safeIterations > 50) { console.log("  exceeded 50 pages — bailing out of", cname); break; }
      let snap: any;
      try {
        const qBase: any = (typeof fieldPath !== "string" && firestore.FieldPath)
          ? firestore.collection(cname).orderBy(fieldPath).limit(200)
          : firestore.collection(cname).limit(500);
        snap = cursor ? await qBase.startAfter(cursor).get() : await qBase.get();
      } catch (e: any) {
        console.log(`  ${cname} orderBy/limit failed, switching to get():`, e.code || e.message);
        snap = await firestore.collection(cname).get();
      }
      if (snap.empty) break;
      for (const doc of snap.docs) {
        n++;
        const id = doc.id;
        const d = doc.data() || {};
        // Determine email: doc.id IF contains @ else d.email / d.emailLower
        const email = (id.includes("@") ? id : (d.email || d.emailLower || "") as string).toString().toLowerCase();
        // Collect candidate strings
        const strs: string[] = [];
        const walk = (o: any) => {
          if (!o) return;
          if (typeof o === "string") { strs.push(o); return; }
          if (Array.isArray(o)) { o.forEach(walk); return; }
          if (typeof o === "object") Object.values(o).forEach(walk);
        };
        walk(d);
        for (const s of strs) {
          for (const fk of orphans) {
            if (s.includes(`members/${fk}/`) || (s.length === fk.length && s === fk && s.length >= 20)) {
              (orphanToEmail[fk] = orphanToEmail[fk] || new Set()).add(email);
              hits++;
            }
          }
        }
        cursor = doc;
      }
      if (snap.size < 200) break;
    }
    console.log(`  "${cname}" docs scanned: ${n}, orphan-substring hits: ${hits}, uniqueFKmatched: ${Object.keys(orphanToEmail).length}`);
  }
  // 3. Also try: for orphan folderKey (20 chars), it might equal field `legacyUid` / `id` / `docId` in the above 3 col's docs, even if not inside members/ path
  for (const cname of Object.keys(emailFromCollections)) {
    console.log(`\nScan "${cname}" for orphan=top-level uid/id/docId/memberId/FIREBASE_LEGACY…`);
    let cursor: any = null; let hits = 0; let safe = 0;
    while (safe++ < 50) {
      let snap: any;
      try {
        const qBase: any = firestore.FieldPath
          ? firestore.collection(cname).orderBy(firestore.FieldPath.documentId()).limit(200)
          : firestore.collection(cname).limit(500);
        snap = cursor ? await qBase.startAfter(cursor).get() : await qBase.get();
      } catch { snap = await firestore.collection(cname).get(); }
      if (snap.empty) break;
      for (const doc of snap.docs) {
        const id = doc.id;
        const d = doc.data() || {};
        const email = (id.includes("@") ? id : (d.email || d.emailLower || "") as string).toString().toLowerCase();
        const vals = new Set<string>();
        for (const k of ["uid","id","docId","legacyId","legacyUid","memberId","firestoreId","firebaseUid","firestoreDocId","firebaseLegacyUid","authUid","userId","userUid"]) {
          const v = (d as any)[k];
          if (typeof v === "string") vals.add(v);
        }
        for (const v of vals) {
          if (orphanSet.has(v)) {
            (orphanToEmail[v] = orphanToEmail[v] || new Set()).add(email);
            hits++;
          }
        }
        cursor = doc;
      }
      if (snap.size < 200) break;
    }
    console.log(`  "${cname}" orphan=id-field hits: ${hits}`);
  }

  // 4. Final crossmatch: orphanToEmail → PG visible by email_lower.
  const matchedFKtoPG: any[] = [];
  for (const fk of Object.keys(orphanToEmail)) {
    for (const em of orphanToEmail[fk]) {
      const pgRow = vis.find(r => r.email_lower === em);
      if (pgRow) matchedFKtoPG.push({
        folderKey: fk,
        email: em,
        clerk_id: pgRow.clerk_id,
        hasRealPhoto: [pgRow.av, pgRow.pi, pgRow.im].some(s =>
          s?.startsWith("/uploads/") || s?.startsWith("http") && !s.includes("gravatar.com")),
      });
    }
  }
  const recoverable = matchedFKtoPG.filter(m => !m.hasRealPhoto);
  console.log("\n=======================================");
  console.log("TOTAL folderKeys mapped via Firestore -> email:", Object.keys(orphanToEmail).length);
  console.log("TOTAL mapped to VISIBLE PG member by email:", new Set(matchedFKtoPG.map(m => m.email)).size);
  console.log("RECOVERABLE (PG no real photo yet, backfill eligible):", new Set(recoverable.map(r => r.email)).size);
  console.table(recoverable.slice(0, 60));

  // Save recoverables to CSV
  const uniq = new Map<string, any>();
  for (const r of recoverable) uniq.set(r.email, r);
  const recArr = [...uniq.values()];
  const outCsv = "email,clerk_id,folderKey\n" + recArr.map(r => `${r.email},${r.clerk_id},${r.folderKey}`).join("\n") + "\n";
  fs.writeFileSync("/tmp/fb-recoverable-firestore.csv", outCsv);
  console.log(`\nWrote /tmp/fb-recoverable-firestore.csv rows=${recArr.length}`);
  await pool.end();
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
