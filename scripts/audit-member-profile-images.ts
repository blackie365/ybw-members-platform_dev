#!/usr/bin/env npx tsx
import { Pool } from "pg";

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const r = await pool.query(`
    SELECT
      COUNT(*)::int AS total_visible,
      COUNT(NULLIF(data->>'image', ''))::int AS has_image,
      COUNT(NULLIF(data->>'avatarUrl', ''))::int AS has_avatarUrl,
      COUNT(NULLIF(data->>'profileImage', ''))::int AS has_profileImage,
      COUNT(NULLIF(data->>'profileImageSource', ''))::int AS has_profileImageSource,
      COUNT(NULLIF(data->>'photoURL', ''))::int AS has_photoURL,
      COUNT(NULLIF(data->>'gravatarUrl', ''))::int AS has_gravatarUrl,
      COUNT(CASE WHEN (data->>'avatarUrl' LIKE '%gravatar.com/avatar%' AND data->>'avatarUrl' LIKE '%d=blank%') THEN 1 END)::int AS gravatar_blank_avatarUrl,
      COUNT(CASE WHEN (data->>'profileImage' LIKE '%gravatar.com/avatar%' AND data->>'profileImage' LIKE '%d=blank%') THEN 1 END)::int AS gravatar_blank_profileImage,
      COUNT(CASE WHEN (data->>'image' LIKE '%gravatar.com/avatar%' AND data->>'image' LIKE '%d=blank%') THEN 1 END)::int AS gravatar_blank_image,
      COUNT(CASE WHEN NULLIF(data->>'avatarUrl', '') IS NOT NULL AND data->>'avatarUrl' NOT LIKE '%gravatar.com/avatar%' THEN 1 END)::int AS real_nonGrav_avatarUrl,
      COUNT(CASE WHEN NULLIF(data->>'profileImage', '') IS NOT NULL AND data->>'profileImage' NOT LIKE '%gravatar.com/avatar%' THEN 1 END)::int AS real_nonGrav_profileImage,
      COUNT(CASE WHEN NULLIF(data->>'image', '') IS NOT NULL AND data->>'image' NOT LIKE '%gravatar.com/avatar%' THEN 1 END)::int AS real_nonGrav_image,
      COUNT(CASE WHEN NULLIF(data->>'avatarUrl', '') LIKE '/uploads/%' THEN 1 END)::int AS local_vps_avatarUrl,
      COUNT(CASE WHEN NULLIF(data->>'profileImage', '') LIKE '/uploads/%' THEN 1 END)::int AS local_vps_profileImage,
      COUNT(CASE WHEN NULLIF(data->>'image', '') LIKE '/uploads/%' THEN 1 END)::int AS local_vps_image,
      COUNT(CASE WHEN NULLIF(data->>'avatarUrl', '') LIKE 'https://img.clerk.com/%' OR NULLIF(data->>'profileImage', '') LIKE 'https://img.clerk.com/%' OR NULLIF(data->>'image', '') LIKE 'https://img.clerk.com/%' THEN 1 END)::int AS clerk_cdn_any,
      COUNT(CASE WHEN NULLIF(data->>'avatarUrl', '') LIKE 'https://www.gravatar.com/%' OR NULLIF(data->>'profileImage', '') LIKE 'https://www.gravatar.com/%' OR NULLIF(data->>'image', '') LIKE 'https://www.gravatar.com/%' OR NULLIF(data->>'gravatarUrl', '') LIKE 'https://www.gravatar.com/%' THEN 1 END)::int AS gravatar_any_real,
      COUNT(CASE WHEN
          NULLIF(data->>'image', '') IS NULL
          AND NULLIF(data->>'avatarUrl', '') IS NULL
          AND NULLIF(data->>'profileImage', '') IS NULL
          AND NULLIF(data->>'profileImageSource', '') IS NULL
          AND NULLIF(data->>'gravatarUrl', '') IS NULL
          AND NULLIF(data->>'photoURL', '') IS NULL
        THEN 1 END)::int AS zero_image_fields_all_nulls
    FROM member_profiles WHERE visibility='visible' AND is_active=true;
  `);
  const row = r.rows[0] as any;
  const total = Number(row.total_visible);
  const pct = (n: any) => Math.round(1000 * Number(n) / total) / 10;
  console.log("========== PART 1: Profile image field coverage (visible members, n=" + total + ") ==========");
  console.log("");
  console.log("total_visible members                 :", total);
  console.log("has image (non-empty)                 :", row.has_image, "/", total, "=", pct(row.has_image) + "%");
  console.log("has avatarUrl (non-empty)             :", row.has_avatarurl, "/", total, "=", pct(row.has_avatarurl) + "%");
  console.log("has profileImage (non-empty)          :", row.has_profileimage, "/", total, "=", pct(row.has_profileimage) + "%");
  console.log("has profileImageSource (non-empty)    :", row.has_profileimagesource, "/", total, "=", pct(row.has_profileimagesource) + "%");
  console.log("has photoURL (non-empty)              :", row.has_photourl, "/", total, "=", pct(row.has_photourl) + "%");
  console.log("has gravatarUrl (non-empty)           :", row.has_gravatarurl, "/", total, "=", pct(row.has_gravatarurl) + "%");
  console.log("");
  console.log("Gravatar d=blank BROKEN placeholder counts (these show a blank silhouette INSTEAD of a photo):");
  console.log("  in avatarUrl   =", row.gravatar_blank_avatarurl);
  console.log("  in profileImage=", row.gravatar_blank_profileimage);
  console.log("  in image       =", row.gravatar_blank_image);
  console.log("");
  const anyRealNonGrav = Number(row.real_nongrav_image) + Number(row.real_nongrav_avatarurl) + Number(row.real_nongrav_profileimage);
  console.log("Real non-Gravatar hosted photos (Clerk CDN, VPS uploads, Ghost CDN, etc.) — overlap-counted since fields can be set simultaneously on same member:");
  console.log("  in avatarUrl   =", row.real_nongrav_avatarurl);
  console.log("  in profileImage=", row.real_nongrav_profileimage);
  console.log("  in image       =", row.real_nongrav_image);
  console.log("  Clerk CDN ANY  =", row.clerk_cdn_any);
  console.log("  Gravatar REAL  =", row.gravatar_any_real);
  const anyLocal = Number(row.local_vps_avatarurl) + Number(row.local_vps_profileimage) + Number(row.local_vps_image);
  console.log("  VPS local /uploads/ ANY =", anyLocal);
  console.log("");
  console.log("ALL 6 image fields NULL SIMULTANEOUSLY =", row.zero_image_fields_all_nulls, "/", total, "=", pct(row.zero_image_fields_all_nulls) + "%  (THE DISAPPEARED — these have ZERO photo of any kind.)");

  console.log("");
  console.log("========== PART 2: URL prefix distribution across all 6 image fields combined ==========");
  const pref = await pool.query(`
    SELECT prefix, COUNT(*)::int AS c FROM (
      SELECT
        CASE
          WHEN u LIKE '/uploads/%' THEN '/uploads/ local VPS storage'
          WHEN u LIKE 'https://img.clerk.com/%' THEN 'Clerk CDN img.clerk.com'
          WHEN u LIKE 'https://www.gravatar.com/avatar%' AND u LIKE '%d=blank%' THEN 'GRAVATAR BROKEN d=blank (silhouette, NO photo)'
          WHEN u LIKE 'https://www.gravatar.com/%' THEN 'Gravatar OK real user avatar'
          WHEN u LIKE 'https://secure.gravatar.com/%' THEN 'Gravatar secure'
          WHEN u LIKE 'https://0.gravatar.com/%' OR u LIKE 'https://1.gravatar.com/%' OR u LIKE 'https://2.gravatar.com/%' THEN 'Gravatar CDN shard'
          WHEN u LIKE 'https://ybw-members-platform.%' OR u LIKE 'firebasestorage.googleapis.com%' OR u LIKE 'https://storage.googleapis.com/%' THEN 'Legacy Firebase storage URL'
          WHEN u LIKE 'https://%.ghost.io/content/%' OR u LIKE 'https://yorkshirebusinesswoman.co.uk/content/%' THEN 'Ghost CDN content URL'
          WHEN u IS NULL OR u = '' THEN NULL
          WHEN u LIKE 'http%' THEN 'External HTTP(S): ' || regexp_replace(u, '^(https?://[^/]+)/.*', '$1')
          ELSE 'Other (non-HTTP)'
        END AS prefix
      FROM (
        SELECT data->>'image' AS u FROM member_profiles WHERE visibility='visible' AND is_active=true
        UNION ALL SELECT data->>'avatarUrl' FROM member_profiles WHERE visibility='visible' AND is_active=true
        UNION ALL SELECT data->>'profileImage' FROM member_profiles WHERE visibility='visible' AND is_active=true
        UNION ALL SELECT data->>'profileImageSource' FROM member_profiles WHERE visibility='visible' AND is_active=true
        UNION ALL SELECT data->>'gravatarUrl' FROM member_profiles WHERE visibility='visible' AND is_active=true
        UNION ALL SELECT data->>'photoURL' FROM member_profiles WHERE visibility='visible' AND is_active=true
      ) src
    ) q WHERE prefix IS NOT NULL GROUP BY prefix ORDER BY c DESC;
  `);
  for (const p of pref.rows) console.log("  " + String(p.c).padStart(5, " ") + "  " + p.prefix);

  console.log("");
  console.log("========== PART 3: Members with ZERO photo fields (all 6 NULL) — these are the DISAPPEARED ==========");
  const zeroes = await pool.query(`
    SELECT clerk_id, email_lower, email, member_slug,
      data->>'firstName' AS fn, data->>'lastName' AS ln,
      data->>'ghostMemberId' AS ghost_id, data->>'membershipTier' AS tier
    FROM member_profiles
    WHERE visibility='visible' AND is_active=true
      AND NULLIF(data->>'image', '') IS NULL
      AND NULLIF(data->>'avatarUrl', '') IS NULL
      AND NULLIF(data->>'profileImage', '') IS NULL
      AND NULLIF(data->>'profileImageSource', '') IS NULL
      AND NULLIF(data->>'gravatarUrl', '') IS NULL
      AND NULLIF(data->>'photoURL', '') IS NULL
    ORDER BY coalesce(data->>'lastName', '') ASC
  `);
  console.log("Count:", zeroes.rows.length);
  for (const m of zeroes.rows as any[]) {
    console.log("  [" + String(m.tier || "NULL").padEnd(14, " ") + "] clerk=" + String(m.clerk_id || "").padEnd(30, " ") + " email=" + String(m.email_lower || "").padEnd(44, " ") + " name=" + ((m.fn || "") + " " + (m.ln || "")).padEnd(28, " ") + " ghost=" + (m.ghost_id || "(none)"));
  }

  console.log("");
  console.log("========== PART 4: Local VPS /uploads/ references in PG (check against file system later) ==========");
  const localPaths = await pool.query(`
    SELECT clerk_id, email_lower, data->>'firstName' AS fn, data->>'lastName' AS ln,
      data->>'image' AS img, data->>'avatarUrl' AS av, data->>'profileImage' AS pi
    FROM member_profiles
    WHERE visibility='visible' AND is_active=true AND (
      NULLIF(data->>'image', '') LIKE '/uploads/%' OR
      NULLIF(data->>'avatarUrl', '') LIKE '/uploads/%' OR
      NULLIF(data->>'profileImage', '') LIKE '/uploads/%'
    )
    ORDER BY coalesce(data->>'lastName', '') ASC
  `);
  const allLocalPaths: string[] = [];
  console.log("Count:", localPaths.rows.length);
  for (const m of localPaths.rows as any[]) {
    const used = [m.img, m.av, m.pi].filter((p: any) => typeof p === "string" && p.startsWith("/uploads/"));
    for (const p of used) { allLocalPaths.push(p); console.log("  PATH=" + String(p).padEnd(72, " ") + " email=" + String(m.email_lower).padEnd(42, " ") + " name=" + (m.fn || "") + " " + (m.ln || "")); }
  }
  console.log("Unique local /uploads/ paths:", allLocalPaths.length);

  console.log("");
  console.log("========== PART 5: Gravatar d=blank BROKEN silhouette members (NO real photo, just blank placeholder) ==========");
  const blank = await pool.query(`
    SELECT clerk_id, email_lower, data->>'firstName' AS fn, data->>'lastName' AS ln,
      data->>'membershipTier' AS tier, data->>'avatarUrl' AS av
    FROM member_profiles
    WHERE visibility='visible' AND is_active=true AND (
      NULLIF(data->>'avatarUrl', '') LIKE '%gravatar.com/avatar%d=blank%' OR
      NULLIF(data->>'profileImage', '') LIKE '%gravatar.com/avatar%d=blank%' OR
      NULLIF(data->>'image', '') LIKE '%gravatar.com/avatar%d=blank%'
    )
    ORDER BY coalesce(data->>'lastName', '') ASC
  `);
  console.log("Count:", blank.rows.length, "members displaying a blank silhouette.");
  for (const m of (blank.rows as any[]).slice(0, 20)) {
    console.log("  [" + String(m.tier || "NULL").padEnd(14, " ") + "] " + String(m.email_lower).padEnd(44, " ") + " " + ((m.fn || "") + " " + (m.ln || "")).padEnd(28, " "));
  }
  if (blank.rows.length > 20) console.log("  ... and", blank.rows.length - 20, "more.");

  console.log("");
  console.log("========== PART 6: Real uploaded profileImage (non-grav, actual member-uploaded pics) ==========");
  const realPhotos = await pool.query(`
    SELECT clerk_id, email_lower, data->>'firstName' AS fn, data->>'lastName' AS ln, data->>'profileImage' AS pi
    FROM member_profiles
    WHERE visibility='visible' AND is_active=true
      AND NULLIF(data->>'profileImage', '') IS NOT NULL
      AND data->>'profileImage' NOT LIKE '%gravatar.com/%'
    ORDER BY coalesce(data->>'lastName', '') ASC
  `);
  console.log("Count of real profileImage photos:", realPhotos.rows.length, "/", total, "=", pct(realPhotos.rows.length) + "%");
  for (const m of (realPhotos.rows as any[]).slice(0, 15)) {
    console.log("  " + String(m.email_lower).padEnd(44, " ") + " " + ((m.fn || "") + " " + (m.ln || "")).padEnd(28, " ") + " → " + (m.pi || "").slice(0, 90));
  }
  if (realPhotos.rows.length > 15) console.log("  ... and", realPhotos.rows.length - 15, "more.");

  await pool.end();
})().catch((e) => { console.error("SCRIPT ERROR:", e); process.exit(1); });
