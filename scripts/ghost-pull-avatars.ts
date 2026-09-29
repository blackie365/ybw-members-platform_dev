#!/usr/bin/env npx tsx
import * as crypto from "crypto";
import * as fs from "fs";

function signToken(kid: string, secret: Buffer) {
  const header = { alg: "HS256", typ: "JWT", kid };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 300, aud: "/admin/" };
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${b64url(header)}.${b64url(payload)}`;
  const sig = crypto.createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${sig}`;
}

async function paginatedMembers(url: string, token: string) {
  const all: any[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const qs = `limit=${pageSize}&page=${page}&fields=id,email,name,avatar_url,image,subscribed,status,created_at&include=labels`;
    const r = await fetch(`${url}/ghost/api/admin/members/?${qs}`, {
      headers: { Authorization: `Ghost ${token}` },
    });
    const j = await r.json();
    const arr = j.members || [];
    all.push(...arr);
    if (arr.length < pageSize) break;
    page++;
    if (page > 10) break;
  }
  return all;
}

async function main() {
  const [kid, secretHex] = process.env.GHOST_ADMIN_API_KEY!.split(":");
  const secret = Buffer.from(secretHex, "hex");
  const base = process.env.NEXT_PUBLIC_GHOST_API_URL!.replace(/\/$/, "");
  const token = signToken(kid, secret);

  const members = await paginatedMembers(base, token);
  console.log(`Ghost paginated members total: ${members.length}`);

  const staffResp = await fetch(
    `${base}/ghost/api/admin/users/?limit=100&fields=id,email,name,slug,profile_image,cover_image`,
    { headers: { Authorization: `Ghost ${token}` } }
  );
  const staffJson = await staffResp.json();
  const staff = staffJson.users || [];
  console.log(`Ghost staff (users) total: ${staff.length}`);

  const csv = [
    "email_lower,member_avatar_url,member_image,staff_profile_image,staff_cover_image",
    ...members.map(m => {
      const em = (m.email || "").toLowerCase();
      const s = staff.find((u: any) => (u.email || "").toLowerCase() === em) as any;
      return [
        em,
        m.avatar_url || "",
        m.image || "",
        s?.profile_image || "",
        s?.cover_image || "",
      ]
        .map(f => `"${f.toString().replace(/"/g, '""')}"`)
        .join(",");
    }),
  ].join("\n") + "\n";
  fs.writeFileSync("/tmp/ghost_avatar.csv", csv, "utf8");

  const nonEmptyAvatars = members.filter(
    m =>
      ((m.avatar_url || "") as string).startsWith("http") ||
      ((m.image || "") as string).startsWith("http")
  ).length;
  const staffWithImg = staff.filter(
    (u: any) =>
      ((u.profile_image || "") as string).startsWith("http") ||
      ((u.cover_image || "") as string).startsWith("http")
  ).length;
  console.log(`Members rows with avatar_url/image (http): ${nonEmptyAvatars}/${members.length}`);
  console.log(`Staff rows with profile_image/cover_image (http): ${staffWithImg}/${staff.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
