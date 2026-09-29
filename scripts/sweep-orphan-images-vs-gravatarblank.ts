#!/usr/bin/env npx tsx
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  const visible = (await pool.query(`
    SELECT clerk_id, email_lower, char_length(clerk_id) AS clen,
      data->>'avatarUrl' AS avatarurl,
      data->>'profileImage' AS profileimage,
      data->>'image' AS image
    FROM member_profiles
    WHERE visibility='visible' AND is_active=true
  `)).rows;

  const blankgrav = visible.filter(r =>
    (r.avatarurl || "").includes("gravatar.com") &&
    (r.avatarurl || "").includes("d=blank") &&
    !(r.profileimage || "").startsWith("/uploads/") &&
    !(r.image || "").startsWith("/uploads/")
  );
  console.log(`\nBucket-A Gravatar-blank-no-local-upload members: ${blankgrav.length}`);
  console.table(blankgrav.map(r => ({
    email: r.email_lower, clen: r.clen,
    clerk_prefix: r.clerk_id.slice(0, 20),
  })));

  const clerkids_all = visible.map(r => r.clerk_id);
  const firebase_clerks = visible.filter(r => r.clen !== 32 || !r.clerk_id.startsWith("user_")).map(r => r.clerk_id);
  const newuser_clerks = visible.filter(r => r.clen === 32 && r.clerk_id.startsWith("user_")).map(r => r.clerk_id);
  console.log(`\nClerk formats: Firebase-legacy non-user_* = ${firebase_clerks.length}; New user_* = ${newuser_clerks.length}`);

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
