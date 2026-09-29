#!/usr/bin/env npx tsx
import { clerkClient } from "@clerk/nextjs/server";
import * as fs from "fs";
import { Pool } from "pg";

async function main() {
  const clerk = await clerkClient();
  const allUsers: any[] = [];
  let last: string | undefined;
  while (true) {
    const resp: any = await clerk.users.getUserList({
      limit: 100,
      orderBy: "-created_at",
      ...(last ? { offset: allUsers.length as any } : {}),
    } as any);
    const batch = Array.isArray(resp) ? resp : resp.data || [];
    allUsers.push(...batch);
    if (batch.length < 100) break;
    last = "more";
    if (allUsers.length > 500) break;
  }
  console.log(`Clerk users fetched: ${allUsers.length}`);
  const withImage = allUsers.filter(u =>
    (u.imageUrl || "").startsWith("http") &&
    !(u.imageUrl || "").includes("gravatar.com") &&
    !(u.imageUrl || "").includes("d=blank")
  );
  console.log(`  Clerk users with non-blank-non-gravatar imageUrl: ${withImage.length}`);
  console.log(`    Of those, on img.clerk.com CDN (real uploads, not defaults):`,
    withImage.filter(u => u.imageUrl.includes("img.clerk.com")).length,
    "/ distinct emails:", withImage.filter(u =>
      u.imageUrl.includes("img.clerk.com") && (u.emailAddresses || []).length
    ).length
  );

  const emailToClerk: Map<string, { imageUrl: string; clerkUserId: string; name?: string }> = new Map();
  for (const u of allUsers) {
    const emails = (u.emailAddresses || []).map((e: any) => (e.emailAddress || "").toLowerCase());
    if (!emails.length) continue;
    const iu = u.imageUrl || "";
    for (const em of emails) {
      const prev = emailToClerk.get(em);
      const hasPhoto =
        iu.startsWith("http") && !iu.includes("gravatar.com") && !iu.includes("d=blank") &&
        !(iu.includes("img.clerk.com") && iu.includes('"type":"default"'));
      const p_hasPhoto = prev ? (
        prev.imageUrl.startsWith("http") && !prev.imageUrl.includes("gravatar.com") &&
        !prev.imageUrl.includes("d=blank") && !(prev.imageUrl.includes("img.clerk.com") && prev.imageUrl.includes('"type":"default"'))
      ) : false;
      if (!prev || (hasPhoto && !p_hasPhoto)) {
        emailToClerk.set(em, {
          imageUrl: iu,
          clerkUserId: u.id,
          name: [u.firstName, u.lastName].filter(Boolean).join(" "),
        });
      }
    }
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const vis = (await pool.query(`
    SELECT clerk_id, email_lower, char_length(clerk_id) AS clen,
      data->>'avatarUrl' AS av,
      data->>'profileImage' AS pi,
      data->>'image' AS im
    FROM member_profiles WHERE visibility='visible' AND is_active=true
  `)).rows;

  const blank = vis.filter(r =>
    (r.av || "").includes("gravatar.com") &&
    (r.av || "").includes("d=blank") &&
    !(r.pi || "").startsWith("/uploads/") &&
    !(r.im || "").startsWith("/uploads/")
  );
  console.log(`\n=== (A) Bucket-A 58 Gravatar-blank members: how many have REAL photo on Clerk? ===`);
  const a_res = blank.map(r => {
    const c = emailToClerk.get(r.email_lower);
    const hasRealClerkPhoto =
      c && c.imageUrl.startsWith("http") && !c.imageUrl.includes("gravatar.com") &&
      !c.imageUrl.includes("d=blank") &&
      !(c.imageUrl.includes("img.clerk.com") && c.imageUrl.includes('"type":"default"'));
    return {
      email: r.email_lower,
      clen: r.clen,
      clerkMatches: !!c,
      clerkCidMatches: c ? c.clerkUserId === r.clerk_id : undefined,
      hasRealClerkPhoto,
      clerkImageUrl: c ? c.imageUrl.substring(0, 90) : "",
    };
  });
  const a_fixable = a_res.filter(r => r.hasRealClerkPhoto);
  console.log(`  Bucket-A blank members:      ${blank.length}`);
  console.log(`  Recoverable via Clerk photo: ${a_fixable.length}`);
  if (a_fixable.length) console.table(a_fixable.map(r => ({
    email: r.email,
    clerkid_match: r.clerkCidMatches,
    has_photo: r.hasRealClerkPhoto,
    url: r.clerkImageUrl,
  })));

  console.log(`\n=== (B) ALL 44 Clerk user_* PG rows: how many avatarUrl/profileImage not set when Clerk imageUrl IS real? ===`);
  const newuser = vis.filter(r => r.clen === 32 && r.clerk_id.startsWith("user_"));
  const b_res = newuser.map(r => {
    const c = emailToClerk.get(r.email_lower);
    const hasRealClerkPhoto = c && c.imageUrl.startsWith("http") &&
      !c.imageUrl.includes("gravatar.com") && !c.imageUrl.includes("d=blank") &&
      !(c.imageUrl.includes("img.clerk.com") && c.imageUrl.includes('"type":"default"'));
    const pgHasReal =
      ((r.pi && (r.pi.startsWith("/uploads/") || r.pi.startsWith("http") && !r.pi.includes("gravatar.com") && !r.pi.includes("img.clerk.com"))) ||
       (r.im && (r.im.startsWith("/uploads/") || r.im.startsWith("http") && !r.im.includes("gravatar.com") && !r.im.includes("img.clerk.com"))) ||
       (r.av && !r.av.includes("gravatar.com") && !r.av.includes("d=blank")));
    return {
      email: r.email_lower,
      pgHasReal,
      hasRealClerkPhoto,
      shadowed: pgHasReal && hasRealClerkPhoto ? false : (!pgHasReal && hasRealClerkPhoto),
      clerkUrl: c ? c.imageUrl.substring(0, 90) : "",
    };
  });
  const recoverableB = b_res.filter(r => r.shadowed);
  console.log(`  44 user_* PG rows: ${b_res.length}`);
  console.log(`  PG missing Clerk real photo: ${recoverableB.length} (recoverable)`);
  if (recoverableB.length) console.table(recoverableB.map(r => ({ email: r.email, shadowed: r.shadowed, url: r.clerkUrl })));

  // write full CSV for backfill script
  const rows4csv = [...a_res, ...b_res].filter(r => (r as any).hasRealClerkPhoto).map(r => ({
    email_lower: r.email_lower,
    clerk_id: vis.find(v => v.email_lower === r.email_lower)?.clerk_id || "",
    clerk_user_id: (emailToClerk.get(r.email_lower)?.clerkUserId) || "",
    clerk_image_url: (emailToClerk.get(r.email_lower)?.imageUrl) || "",
  }));
  const csv =
    "email_lower,clerk_id,clerk_user_id,clerk_image_url\n" +
    rows4csv.map(r => [r.email_lower, r.clerk_id, r.clerk_user_id, `"${r.clerk_image_url.replace(/"/g, '""')}"`].join(","))
      .join("\n") +
    "\n";
  fs.writeFileSync("/tmp/clerk-recoverable-photos.csv", csv, "utf8");
  console.log(`\nWrote /tmp/clerk-recoverable-photos.csv rows: ${rows4csv.length}`);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
