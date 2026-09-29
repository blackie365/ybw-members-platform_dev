import * as dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
import { Pool } from "pg";
import * as fs from "fs";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const lines = fs.readFileSync("/tmp/firebase-storage-listing.csv", "utf8").split("\n").slice(1).filter(Boolean);
  const folderKeys = new Set<string>();
  const parseCsvLine = (ln: string): string[] => {
    const out: string[] = []; let cur = ""; let inQ = false;
    for (let i = 0; i < ln.length; i++) {
      const c = ln[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur); return out;
  };
  for (const l of lines) {
    const cols = parseCsvLine(l);
    const f = cols[0];
    if (!f.startsWith("members/")) continue;
    const parts = f.split("/");
    if (parts.length >= 2 && parts[1] && parts[1] !== "members") folderKeys.add(parts[1]);
  }
  console.log("Firebase folder keys count:", folderKeys.size);
  const lens: Record<number, number> = {};
  for (const k of folderKeys) lens[k.length] = (lens[k.length] || 0) + 1;
  console.log("FB folderKeys length distribution:", lens);
  const samplesByLen: Record<number, string[]> = {};
  for (const k of folderKeys) (samplesByLen[k.length] = samplesByLen[k.length] || []).push(k);
  for (const L of Object.keys(samplesByLen)) console.log(`  len=${L} samples:`, samplesByLen[+L].slice(0, 5));

  const { rows: vis } = await pool.query(`
    SELECT clerk_id, email_lower, char_length(clerk_id) AS clen, data
    FROM member_profiles WHERE visibility='visible' AND is_active=true
  `);
  console.log("PG visible rows:", vis.length);

  // Clerk id prefix vs FB folderKey: direct equal already done: 0.
  // Now: find any FB folderKey matching ANY JSONB top-level or nested string value.
  type RowFlat = { clerk_id: string; email: string; keyPath: string; value: string };
  const rowFlats: RowFlat[] = [];
  for (const r of vis) {
    function fl(obj: any, prefix = "") {
      if (!obj || typeof obj !== "object") return;
      for (const [k, v] of Object.entries(obj)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "string") rowFlats.push({ clerk_id: r.clerk_id, email: r.email_lower, keyPath: p, value: v });
        else if (v && typeof v === "object") fl(v, p);
      }
    }
    fl(r.data);
  }
  console.log("Total JSONB string values in visible rows:", rowFlats.length);

  const exact: (RowFlat & { folderKey: string })[] = [];
  for (const s of rowFlats) if (folderKeys.has(s.value)) exact.push({ ...s, folderKey: s.value });
  console.log("\nStrategy S1: JSONB value EXACT equals FB folderKey → HITS:", exact.length);
  if (exact.length) console.table(exact.slice(0, 30).map(r => ({ email: r.email, keyPath: r.keyPath, folderKey: r.folderKey })));

  const fkArr = [...folderKeys];
  const contain: (RowFlat & { matchedFolderKey: string })[] = [];
  for (const s of rowFlats) {
    if (s.value.length < 12) continue;
    for (const k of fkArr) {
      if (s.value.includes(k)) { contain.push({ ...s, matchedFolderKey: k }); break; }
    }
  }
  console.log("\nStrategy S2: JSONB value CONTAINS FB folderKey (substring) → HITS:", contain.length);
  if (contain.length) console.table(contain.slice(0, 30).map(r => ({
    email: r.email, keyPath: r.keyPath, folderKey: r.matchedFolderKey.substring(0, 20), value: r.value.length > 80 ? r.value.substring(0, 77) + "..." : r.value
  })));

  // 20-char prefixes of clerk_id / auth UIDs / other IDs vs 20-char folderKeys
  const len20Keys = new Set(fkArr.filter(k => k.length === 20));
  const len24Keys = new Set(fkArr.filter(k => k.length === 24));
  console.log("\nFB folder key sets: len=20 count=", len20Keys.size, "; len=24 count=", len24Keys.size);

  // Look for JSONB key "firebaseUid" / "firestoreDocId" / "uid" / "legacyId" / "id"
  const interestingKeys: Record<string, RowFlat[]> = {};
  for (const s of rowFlats) {
    const leaf = s.keyPath.split(".").pop()!.toLowerCase();
    if (["uid","id","firebaseuid","firestoreid","legacyjid","legacyid","docid","memberid"].includes(leaf)) {
      (interestingKeys[leaf] = interestingKeys[leaf] || []).push(s);
    }
  }
  console.log("\nInteresting JSONB key-leaf buckets (uid/id etc):");
  for (const k of Object.keys(interestingKeys)) {
    const items = interestingKeys[k];
    const hitsExact = items.filter(s => folderKeys.has(s.value)).length;
    console.log(`  ${k}: total=${items.length}, FBfolderExact=${hitsExact}  — sample:`, items.slice(0, 3).map(s => s.value.substring(0, 20)));
  }

  // Cross-match: for each FB folderKey (len 20/24), search if ANY member in member_profiles.data->>'X' = key (column-based):
  // Try: data.uid, data.member.uid, data.firebaseUid, data.legacyId
  const commonPaths = [
    "data->>'uid'", "data->>'id'", "data->>'legacyId'", "data->>'legacyUid'",
    "data->>'firebaseUid'", "data->>'firestoreId'", "data->>'firestoreDocId'",
    "data->'member'->>'uid'", "data->'member'->>'id'", "data->'member'->>'firestoreId'",
  ];
  console.log("\n=== Try column-level SQL lookups for FB folderKey matches ===");
  for (const fk of fkArr.slice(0, 30)) {
    // Skip, too many. Just do one sample joined query.
    break;
  }
  // Build a JSONB-path EXISTS query that checks every FB folderKey against every member
  const qAny = `
    SELECT clerk_id, email_lower, data
    FROM member_profiles
    WHERE visibility='visible' AND is_active=true
      AND EXISTS (
        SELECT 1 FROM jsonb_each_text(data) AS kv(key,value)
         WHERE value = ANY($1::text[])
            OR value IN (SELECT regexp_split_to_table(array_to_string(array_agg(value),'|'), '/') FROM jsonb_each_text(data))
      )
  `;
  // Simpler: for each member, scan JSONB texts. Already done via rowFlats above (exact/contain) — it's definitive.
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
