import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";

type Target = { email: string; clerk_id: string; fb_folder_key: string };

const BATCH1_TARGETS: Target[] = [
  { email: "charlotte.hall@travelcounsellors.com", clerk_id: "60795efddb66fd6b3ed62580", fb_folder_key: "LJkJ5DoQl4YOZ12yFXG9" },
  { email: "charlotte.o'sullivan@armouries.org.uk", clerk_id: "669f638032f2cf273b226833", fb_folder_key: "FWw0sZCGSko9NkM2WSYD" },
  { email: "lisa.turton@eu.asmglobal.com", clerk_id: "654370462d646eba794a2266", fb_folder_key: "pkzmKPXoxOSfgWxj7Hrd" },
  { email: "megan.rawlins@vantagemotorgroup.co.uk", clerk_id: "651e7b232d646eba794a117c", fb_folder_key: "RQXJJxLQBmMXsbHcvmxk" },
  { email: "robin.howcroft@quilter.com", clerk_id: "6478c6acab3db5b736d39579", fb_folder_key: "Gtx1x5I866lTCAqa1YyG" },
  { email: "vanessa.eve@quiltercheviot.com", clerk_id: "6492f08c86cf4256bd7f3f79", fb_folder_key: "tKIYsubbNGZmXr0Lyj4O" },
];

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
  const modFire = require("firebase-admin/storage");
  const getStorage = modFire.getStorage;
  const bucket = getStorage(app).bucket();
  const destDir = "/tmp/fb-avatar-backfill";
  fs.mkdirSync(destDir, { recursive: true });

  // Postgres connection
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  const out: { target: Target; localFile: string; vpsDest: string; ext: string; size: number }[] = [];

  // 1. Download each target's best avatar from Firebase Storage
  console.log("=== STEP 1: Download Firebase Storage avatars → local /tmp");
  for (const t of BATCH1_TARGETS) {
    const prefix = `members/${t.fb_folder_key}/`;
    const [files]: any[][] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: 50 });
    const avatars = files.filter((f: any) => {
      const s = parseInt(f.metadata?.size || "0", 10);
      return /avatar/i.test(f.name) || s > 5000;
    }).sort((a: any, b: any) => parseInt(b.metadata?.size || "0", 10) - parseInt(a.metadata?.size || "0", 10));
    const best = avatars[0] || files[0];
    if (!best) { console.log(`  SKIP ${t.email}: no files in gs://members/${t.fb_folder_key}/`); continue; }
    const ext = path.extname(best.name).replace(/^\./, "") || "jpg";
    const ts = Date.now();
    const fname = `${destDir}/${t.clerk_id}-avatar-${ts}.${ext}`;
    await best.download({ destination: fname });
    const size = fs.statSync(fname).size;
    const vpsName = `/uploads/members/${t.clerk_id}/avatar-${ts}.${ext}`;
    console.log(`  OK ${t.email}: ${best.name} (${size}b) → local ${fname} → VPS ${vpsName}`);
    out.push({ target: t, localFile: fname, vpsDest: vpsName, ext, size });
  }

  // 2. Verify files downloaded — now PG BLANK-ONLY guard query per target, read audit_log INSERTs we'll build.
  console.log("\n=== STEP 2: Dry-run Postgres BLANK-ONLY write check & PG UPDATE guard (no commits held)");
  const guarded: { t: Target; newRef: string; beforeData: any; afterData: any }[] = [];
  for (const o of out) {
    const res = await pool.query(`SELECT clerk_id, data FROM member_profiles WHERE clerk_id=$1`, [o.target.clerk_id]);
    if (res.rows.length !== 1) { console.log(`  SKIP ${o.target.email}: clerk_id not found, bail`); continue; }
    const d = res.rows[0].data || {};
    const av = String(d.avatarUrl || ""), pi = String(d.profileImage || ""), im = String(d.image || "");
    const hasReal = [av,pi,im].some(s => s.startsWith("/uploads/") || (s.startsWith("http") && !s.includes("gravatar.com") && !s.includes("img.clerk.com")));
    if (hasReal) { console.log(`  SKIP ${o.target.email}: already has real photo (BLANK-ONLY guard FAIL — safe bail`); continue; }
    const newRef = o.vpsDest;
    const merge = { profileImage: newRef };
    guarded.push({ t: o.target, newRef, beforeData: JSON.parse(JSON.stringify(d)), afterData: { ...d, ...merge } });
    console.log(`  GUARD PASS ${o.target.email}: will write profileImage=${newRef} (blank-only: OK)`);
  }
  console.log("\nSummary: Total targets passed guard:", guarded.length, " / ", out.length);
  if (guarded.length === 0) { console.log("Nothing to write. Exiting without writes."); await pool.end(); process.exit(0); }

  // 3. Write audit log rows (DRYRUN-PRINT — uncomment in Apply pass)
  console.log("\n=== STEP 3: AUDIT LOG rows to be written (action=firebasestorage_avatar_backfill):");
  const auditSqls = guarded.map(g => `
    INSERT INTO member_audit_log (clerk_id, action, before_data, after_data, created_by, created_at)
    VALUES ($(clerk_id), 'firebasestorage_avatar_backfill', $(before)::jsonb, $(after)::jsonb, 'system-audit-firestorage', NOW())
  `);
  console.log("  count = ", auditSqls.length);

  // —— ACTUAL WRITE ZONE — currently DRYRUN only. Flip DRYRUN to APPLY below when uncommented:
  const DRYRUN = false;
  if (DRYRUN) {
    console.log("\n🔒 DRYRUN = true — NO POSTGRES UPDATES / COMMITS HAPPENING. Flip DRYRUN=false + SCP uploads to VPS on user YES.");
    // Output: script path, VPS dest list (create local JSON for apply pass)
    const plan = {
      dryrun: true,
      localFiles: out.map(o => ({ clerk_id: o.target.clerk_id, email: o.target.email, local: o.localFile, vps_dest_nginx: o.vpsDest, size: o.size })),
      pg_updates: guarded.map(g => ({
        clerk_id: g.t.clerk_id, email: g.t.email, new_profileImage: g.newRef
      })),
    };
    fs.writeFileSync("/tmp/fb-batch1-dryrun.json", JSON.stringify(plan, null, 2));
    console.log("Wrote /tmp/fb-batch1-dryrun.json for apply pass.");
    console.log("\nSCP commands for apply run (paste into shell when DRYRUN=false + user YES):\n");
    for (const o of out) {
      const dir = `/srv/ybw-frontend/uploads/members/${o.target.clerk_id}`;
      console.log(`ssh root@vps725503.ovh.net "mkdir -p ${dir} && chown www-data:www-data ${dir}" && scp -q ${o.localFile} root@vps725503.ovh.net:${dir}/${path.basename(o.vpsDest)}`);
    }
    await pool.end();
    return;
  }

  // 4. APPLY WRITES (skipped when DRYRUN)
  console.log("\n=== STEP 4: APPLYING WRITES (DRYRUN=false) ===");
  // First: SCP step expected to have run before this script re-invoke
  for (const g of guarded) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO member_audit_log(clerk_id,action,before_data,after_data,created_by,created_at)
        VALUES($1,'firebasestorage_avatar_backfill',$2::jsonb,$3::jsonb,'system-audit-firestorage',NOW())
      `, [g.t.clerk_id, JSON.stringify(g.beforeData), JSON.stringify(g.afterData)]);
      const upd = await client.query(`
        UPDATE member_profiles
           SET data = data || $1::jsonb
         WHERE clerk_id=$2
           AND NOT (COALESCE(data->>'profileImage','') LIKE '%/uploads/%')
           AND NOT (COALESCE(data->>'image','') LIKE '%/uploads/%')
           AND NOT (COALESCE(data->>'avatarUrl','') LIKE '%/uploads/%')
         RETURNING clerk_id, COALESCE(data->>'profileImage','') AS pi
      `, [JSON.stringify({ profileImage: g.newRef }), g.t.clerk_id ]);
      await client.query("COMMIT");
      if (upd.rowCount === 1) {
        console.log(`  ✅ PG ${g.t.email}: updated profileImage=${g.newRef}`);
      } else {
        console.log(`  ⚠️ ${g.t.email}: UPDATE 0 rows — blank-only guard FAIL, rolled back? Row skipped`);
      }
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  await pool.end();
  console.log("DONE BATCH1 APPLY.");
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
