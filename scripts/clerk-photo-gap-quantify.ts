#!/usr/bin/env npx tsx
import { clerkClient } from "@clerk/nextjs/server";
import * as fs from "fs";
import { Pool } from "pg";

function b64UrlJson(s: string) {
  try {
    const p = 4 - (s.length % 4);
    const pad = s + (p !== 4 ? "=".repeat(p) : "");
    return JSON.parse(Buffer.from(pad, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function decodeClerkImage(url: string): { type: string; iid?: string; uploaded?: boolean; user_upload?: boolean } {
  if (!url || !url.includes("img.clerk.com/")) {
    if (!url) return { type: "empty" };
    if (url.includes("gravatar.com")) return { type: "gravatar", uploaded: false };
    if (url.startsWith("/uploads/")) return { type: "vps", uploaded: true };
    if (url.startsWith("http")) return { type: "external", uploaded: true };
    return { type: "unknown" };
  }
  const tok = url.split("img.clerk.com/")[1].split("?")[0];
  const payload = tok.includes(".") ? b64UrlJson(tok.split(".")[1]) : b64UrlJson(tok);
  if (!payload || typeof payload !== "object") return { type: "unparseable" };
  const t = (payload as any).type;
  return {
    type: t || "unknown",
    iid: (payload as any).iid,
    uploaded: t === "uploaded" || t === "public" || t === "user_upload" || t === "photo",
  };
}

async function main() {
  const clerk = await clerkClient();
  const allUsers: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const r = await (clerk as any).users.getUserList({ limit: 100, offset });
    const arr = Array.isArray(r) ? r : r.data || [];
    allUsers.push(...arr);
    if (arr.length < 100 || allUsers.length > 500) break;
  }
  console.log(`Clerk users: ${allUsers.length}`);

  // Distribution of imageUrl types across 225 Clerk users
  const typeCounts: Record<string, number> = {};
  const emailToRow: Map<string, any> = new Map();
  for (const u of allUsers) {
    const dec = decodeClerkImage(u.imageUrl || "");
    typeCounts[dec.type] = (typeCounts[dec.type] || 0) + 1;
    const emails = (u.emailAddresses || []).map((e: any) => (e.emailAddress || "").toLowerCase());
    for (const em of emails) {
      const prev = emailToRow.get(em);
      const better = !prev || (dec.uploaded && !decodeClerkImage(prev?.imageUrl || "").uploaded);
      if (better) emailToRow.set(em, { userId: u.id, imageUrl: u.imageUrl || "", firstName: u.firstName, lastName: u.lastName, clerkImgType: dec.type });
    }
  }
  console.log(`\nClerk imageUrl distribution (${allUsers.length} users):`);
  for (const [k, v] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(16)}: ${v}`);
  const uploadedCount = allUsers.filter(u => decodeClerkImage(u.imageUrl || "").uploaded).length;
  console.log(`  REAL user-uploaded photos on Clerk: ${uploadedCount}`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const vis = (await pool.query(`
    SELECT clerk_id, email_lower, char_length(clerk_id) AS clen,
      data->>'avatarUrl' AS av, data->>'profileImage' AS pi, data->>'image' AS im
    FROM member_profiles WHERE visibility='visible' AND is_active=true
  `)).rows;

  function pgHasRealPhoto(r: any) {
    const a = decodeClerkImage(r.av || "");
    const p = decodeClerkImage(r.pi || "");
    const i = decodeClerkImage(r.im || "");
    return a.uploaded || p.uploaded || i.uploaded;
  }

  // Bucket-A: 58 gravatar-blank no-local-upload
  const blank = vis.filter(r => {
    const a = decodeClerkImage(r.av || "");
    const p = decodeClerkImage(r.pi || "");
    const i = decodeClerkImage(r.im || "");
    return a.type === "gravatar" && (r.av || "").includes("d=blank") && !p.uploaded && !i.uploaded;
  });
  const aRecoverable = blank.map(r => ({
    email: r.email_lower,
    clen: r.clen,
    hasRealClerk: decodeClerkImage(emailToRow.get(r.email_lower)?.imageUrl || "").uploaded,
    clerkType: decodeClerkImage(emailToRow.get(r.email_lower)?.imageUrl || "").type,
    clerkUrl: (emailToRow.get(r.email_lower)?.imageUrl || "").substring(0, 90),
  }));
  const aOK = aRecoverable.filter(r => r.hasRealClerk).length;
  console.log(`\n=== (A) Bucket-A Gravatar-blank 58 members: recoverable Clerk REAL uploads? ===`);
  console.log(`  Blanks: ${blank.length}. Recoverable via Clerk user-upload: ${aOK}`);
  if (aOK) console.table(aRecoverable.filter(r => r.hasRealClerk).map(r => ({ email: r.email, type: r.clerkType, url: r.clerkUrl })));

  // Bucket-B: 44 Clerk user_* PG rows — any with Clerk REAL photo but PG missing ref?
  const bRows = vis.filter(r => r.clen === 32 && r.clerk_id.startsWith("user_"));
  const bFix = bRows.map(r => {
    const c = emailToRow.get(r.email_lower);
    const hasClerkReal = decodeClerkImage(c?.imageUrl || "").uploaded;
    const pgOk = pgHasRealPhoto(r);
    return {
      email: r.email_lower,
      pgOk,
      hasClerkReal,
      fixable: !pgOk && hasClerkReal,
      clerkImgType: decodeClerkImage(c?.imageUrl || "").type,
    };
  });
  console.log(`\n=== (B) Bucket-B 44 user_* rows: Clerk real photo missing from PG? ===`);
  console.log(`  Fixable: ${bFix.filter(r => r.fixable).length} / ${bRows.length}`);
  const bF = bFix.filter(r => r.fixable);
  if (bF.length) console.table(bF.map(r => ({ email: r.email, clerk_type: r.clerkImgType })));

  // Bucket-C: 32 external-link-rot members — do any of them have Clerk REAL photo alternative?
  const ext = vis.filter(r => {
    for (const f of [r.pi, r.im, r.av]) {
      const d = decodeClerkImage(f || "");
      if (d.type === "external") return true;
    }
    return false;
  });
  const cFix = ext.map(r => {
    const c = emailToRow.get(r.email_lower);
    const hasClerkReal = decodeClerkImage(c?.imageUrl || "").uploaded;
    return { email: r.email_lower, pg_photo_type: "external", hasClerkReal, clerkType: decodeClerkImage(c?.imageUrl || "").type };
  });
  console.log(`\n=== (C) Bucket-C 32 External link rot: Clerk alternative photo exists? ===`);
  console.log(`  Ext members: ${ext.length}. Have real Clerk upload: ${cFix.filter(r => r.hasClerkReal).length}`);
  if (cFix.filter(r => r.hasClerkReal).length) console.table(cFix.filter(r => r.hasClerkReal).map(r => ({ email: r.email, clerkType: r.clerkType })));

  // Bucket-D: ALL visible members (157) — full enumeration of ALL photo sources & gap quantification
  const summary = {
    total_visible: vis.length,
    has_real_photo_pg: vis.filter(pgHasRealPhoto).length,
    can_use_clerk_upload: vis.filter(r => decodeClerkImage(emailToRow.get(r.email_lower)?.imageUrl || "").uploaded).length,
    clerk_matches_pg_email: vis.filter(r => emailToRow.has(r.email_lower)).length,
  };
  console.log(`\n=== (D) FINAL GAP QUANTIFICATION ===`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Net "can add real photo from Clerk" to currently blank = ${aOK + bFix.filter(r => r.fixable).length + cFix.filter(r => r.hasClerkReal).length}`);
  console.log(`Unfixable (no photo anywhere, user needs to re-upload): ${summary.total_visible - summary.has_real_photo_pg - aOK - bFix.filter(r => r.fixable).length - cFix.filter(r => r.hasClerkReal).length}`);

  // Write CSV backfill input
  const backfill: Array<{ email_lower: string; clerk_id: string; profile_image_url: string; source: string }> = [];
  for (const r of [...blank, ...bRows, ...ext]) {
    const c = emailToRow.get(r.email_lower);
    if (!c) continue;
    const d = decodeClerkImage(c.imageUrl || "");
    if (!d.uploaded) continue;
    const pgOk = pgHasRealPhoto(r);
    if (pgOk) continue;
    backfill.push({
      email_lower: r.email_lower,
      clerk_id: r.clerk_id,
      profile_image_url: c.imageUrl,
      source: `clerk_user_upload_type_${d.type}`,
    });
  }
  fs.writeFileSync(
    "/tmp/clerk-backfill-photos.csv",
    "email_lower,clerk_id,profile_image_url,source\n" +
    backfill.map(r => [r.email_lower, r.clerk_id, `"${r.profile_image_url}"`, r.source].join(",")).join("\n") +
    "\n",
    "utf8"
  );
  console.log(`\nWrote /tmp/clerk-backfill-photos.csv rows: ${backfill.length}`);
  if (backfill.length) console.table(backfill.map(r => ({ email: r.email_lower, source: r.source, url: r.profile_image_url.substring(0, 70) })));
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
