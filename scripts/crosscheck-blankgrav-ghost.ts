#!/usr/bin/env npx tsx
import { Pool } from "pg";
import * as fs from "fs";

async function main() {
  const lines = fs.readFileSync("/tmp/ghost_avatar.csv", "utf8").trim().split("\n").slice(1);
  const csv = lines.map(l => {
    const cells: string[] = [];
    let cur = "", inQ = false;
    for (const c of l) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { cells.push(cur); cur = ""; continue; }
      cur += c;
    }
    cells.push(cur);
    return { email_lower: cells[0], a: cells[1], i: cells[2], s_pimg: cells[3], s_cimg: cells[4] };
  });
  const byEmail = new Map(csv.map(r => [r.email_lower, r]));
  console.log("Ghost CSV rows:", csv.length);
  console.log("  Unique Ghost emails with ANY non-empty http image field:", csv.filter(r => (r.a||r.i||r.s_pimg||r.s_cimg).startsWith("http")).length);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const rows = (await pool.query(`
    SELECT clerk_id, email_lower, char_length(clerk_id) AS clen
    FROM member_profiles
    WHERE visibility='visible' AND is_active=true
    AND COALESCE(data->>'avatarUrl','') LIKE '%gravatar.com%'
    AND COALESCE(data->>'avatarUrl','') LIKE '%d=blank%'
    AND (COALESCE(data->>'profileImage','') = '' OR COALESCE(data->>'profileImage','') NOT LIKE '%/uploads/%')
    AND (COALESCE(data->>'image','')        = '' OR COALESCE(data->>'image','')        NOT LIKE '%/uploads/%')
  `)).rows;
  const g = rows.map(r => {
    const x = byEmail.get(r.email_lower) || { a: "", i: "", s_pimg: "", s_cimg: "" };
    return {
      email: r.email_lower,
      clen: r.clen,
      ghost_member_a: x.a.substring(0, 80),
      ghost_member_i: x.i.substring(0, 80),
      ghost_staff_p: x.s_pimg.substring(0, 80),
      ghost_staff_c: x.s_cimg.substring(0, 80),
      any_http: [x.a, x.i, x.s_pimg, x.s_cimg].some(s => s.startsWith("http")),
    };
  });
  const recover = g.filter(r => r.any_http);
  console.log(`\n=== Bucket-A 58 blanks: how many recoverable from Ghost members/users endpoints? ===`);
  console.log(`Recoverable: ${recover.length} / ${g.length}`);
  if (recover.length) console.table(recover.map(r => ({ email: r.email, clen: r.clen, any: r.any_http, a: r.ghost_member_a, sp: r.ghost_staff_p })));
  console.log(`\n=== Ghost Admin: emails with populated http avatar_url/image, cross-match vs ANY visible PG member ===`);
  const allvis = (await pool.query("SELECT email_lower, clerk_id, data->>'profileImage' pi, data->>'image' im, data->>'avatarUrl' av FROM member_profiles WHERE visibility=$1 AND is_active=$2", ["visible", true])).rows;
  const vismap = new Map(allvis.map(r => [r.email_lower, r]));
  const withAvatar = csv.filter(r => (r.a||r.i||r.s_pimg||r.s_cimg).startsWith("http"));
  const merged = withAvatar.map(r => {
    const v = vismap.get(r.email_lower);
    return {
      email: r.email_lower,
      inPGvisible: !!v,
      pg_profileImage: v?.pi?.substring(0,80) || "",
      best_ghost_url: r.a || r.i || r.s_pimg || r.s_cimg,
    };
  });
  console.log(`Ghost email rows with http avatar: ${withAvatar.length}. Of those, in visible PG: ${merged.filter(m => m.inPGvisible).length}`);
  console.table(merged);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
