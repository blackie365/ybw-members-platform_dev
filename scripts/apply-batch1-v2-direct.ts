#!/usr/bin/env npx tsx
import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
import * as fs from "fs";
import { execSync } from "child_process";

type Row = { email: string; clerk_id: string; folder: string; fname: string; vps_ref: string };

// Files downloaded earlier in /tmp/fb-avatar-backfill from batch1 dryrun, names cached from dryrun output:
const rows: Row[] = (fs.readdirSync("/tmp/fb-avatar-backfill").filter(f => f.endsWith(".jpg")) as string[]).map((fname) => {
  const clerk_id = fname.split("-")[0];
  const clerkToFolder = new Map<string, { email: string; fb: string }>([
    ["60795efddb66fd6b3ed62580", { email: "charlotte.hall@travelcounsellors.com", fb: "LJkJ5DoQl4YOZ12yFXG9" }],
    ["669f638032f2cf273b226833", { email: "charlotte.o'sullivan@armouries.org.uk", fb: "FWw0sZCGSko9NkM2WSYD" }],
    ["654370462d646eba794a2266", { email: "lisa.turton@eu.asmglobal.com", fb: "pkzmKPXoxOSfgWxj7Hrd" }],
    ["651e7b232d646eba794a117c", { email: "megan.rawlins@vantagemotorgroup.co.uk", fb: "RQXJJxLQBmMXsbHcvmxk" }],
    ["6478c6acab3db5b736d39579", { email: "robin.howcroft@quilter.com", fb: "Gtx1x5I866lTCAqa1YyG" }],
    ["6492f08c86cf4256bd7f3f79", { email: "vanessa.eve@quiltercheviot.com", fb: "tKIYsubbNGZmXr0Lyj4O" }],
  ]);
  const info = clerkToFolder.get(clerk_id)!;
  return { email: info.email, clerk_id, folder: info.fb, fname, vps_ref: `/uploads/members/${clerk_id}/${fname}` };
});
rows.sort((a, b) => a.clerk_id.localeCompare(b.clerk_id));

console.log("BATCH1 APPLY ==================================================");
console.log("Rows:", rows.map(r => `${r.email.slice(0, 35)} → ${r.vps_ref}`));

async function main() {
console.log("\n=== STEP A: SCP to VPS /srv/ybw-frontend/uploads/members/<clerk_id>/ via ROOT DIRECT (retry to beat fail2ban drops)");
const SSH_OPTS = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=error -o ConnectTimeout=30 -o ServerAliveInterval=10";
function runWithRetry(cmd: string, retries=5, backoffMs=7000): Buffer {
  let attempt=0, lastErr: any=null;
  while (attempt++ < retries) {
    try { return execSync(cmd); }
    catch (e: any) { lastErr = e; console.log(`    ssh attempt ${attempt}/${retries} failed, sleep ${backoffMs*attempt}ms…`); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,backoffMs*attempt); }
  }
  throw lastErr;
}
for (const r of rows) {
  runWithRetry(`ssh ${SSH_OPTS} root@vps725503.ovh.net "mkdir -p /srv/ybw-frontend/uploads/members/${r.clerk_id} && chown www-data:www-data /srv/ybw-frontend/uploads/members/${r.clerk_id}"`);
  runWithRetry(`scp ${SSH_OPTS} -q /tmp/fb-avatar-backfill/${r.fname} root@vps725503.ovh.net:/srv/ybw-frontend/uploads/members/${r.clerk_id}/${r.fname}`);
  runWithRetry(`ssh ${SSH_OPTS} root@vps725503.ovh.net "chown www-data:www-data /srv/ybw-frontend/uploads/members/${r.clerk_id}/${r.fname} && chmod 644 /srv/ybw-frontend/uploads/members/${r.clerk_id}/${r.fname}"`);
  console.log(`  UPLOAD OK: ${r.email} → VPS ${r.vps_ref}`);
}

console.log("\n=== STEP B: HTTP 200 sweep nginx /uploads alias");
for (const r of rows) {
  const code = execSync(`curl -sS -o /dev/null -w "%{http_code}" "https://yorkshirebusinesswoman.co.uk${r.vps_ref}"`, { encoding: "utf8" });
  console.log(`  HTTP ${code} ${r.vps_ref}`);
  if (code !== "200") { console.error("FATAL non-200"); process.exit(2); }
}

console.log("\n=== STEP C: PG BLANK-ONLY write + audit_log (rows=", rows.length, ")");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

for (const r of rows) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const getRow = await client.query(`SELECT clerk_id, data FROM member_profiles WHERE clerk_id=$1`, [r.clerk_id]);
    if (getRow.rowCount !== 1) throw new Error(`No PG row for clerk_id ${r.clerk_id} email ${r.email}`);
    const before = getRow.rows[0].data || {};
    const av = String(before.avatarUrl || "");
    const pi = String(before.profileImage || "");
    const im = String(before.image || "");
    const hasReal = [av, pi, im].some(s => s.startsWith("/uploads/"));
    if (hasReal) { console.log(`  SKIP ${r.email}: already has real photo, guard. Not writing`); await client.query("ROLLBACK"); continue; }
    const after = { ...before, profileImage: r.vps_ref };
    await client.query(`
      INSERT INTO member_audit_log (action, target_type, target_id, email_lower, operator, fields_changed, note, created_at)
      VALUES('firebasestorage_avatar_backfill','member',$1,$2,'system-audit-firestorage',$3::jsonb,'Imported original avatar from Firebase Storage gs://newmembersdirectory130325/members/${r.folder}/',NOW())
    `, [r.clerk_id, r.email, JSON.stringify(["profileImage"])]);
    const upd = await client.query(`
      UPDATE member_profiles
         SET data = data || $1::jsonb
       WHERE clerk_id=$2
         AND NOT (COALESCE(data->>'profileImage','') LIKE '%/uploads/%')
         AND NOT (COALESCE(data->>'image','') LIKE '%/uploads/%')
         AND NOT (COALESCE(data->>'avatarUrl','') LIKE '%/uploads/%')
       RETURNING clerk_id, COALESCE(data->>'profileImage','') AS pi
    `, [JSON.stringify({ profileImage: r.vps_ref }), r.clerk_id]);
    await client.query("COMMIT");
    console.log(`  ✅ PG WRITE ${r.email}: profileImage=${upd.rows[0]?.pi} (rowCount=${upd.rowCount})`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`  ❌ ${r.email}: rollback`, e);
    process.exit(3);
  } finally {
    client.release();
  }
}
await pool.end();
console.log("BATCH1 DONE.");
}
main().catch(e => { console.error("FAIL", e); process.exit(4); });
