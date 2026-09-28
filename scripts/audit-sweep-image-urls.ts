#!/usr/bin/env -S npx tsx
import dotenv from 'dotenv';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk';

function head(url: string): Promise<{ url: string; status: number | null; ok: boolean; err?: string }> {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({ method: 'HEAD', host: u.hostname, port: u.port, path: u.pathname + (u.search || ''), timeout: 8000, headers: { 'User-Agent': 'ybw-audit/1.0' } }, (res) => {
      resolve({ url, status: res.statusCode ?? null, ok: !!res.statusCode && res.statusCode >= 200 && res.statusCode < 400 });
      res.destroy();
    });
    req.on('error', (e) => resolve({ url, status: null, ok: false, err: String(e.message) }));
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

type Row = { email: string | null; clerk_id: string | null; image: unknown; avatarurl: unknown; profileimage: unknown; profileimagesource: unknown };

const QUERY = `
  SELECT email, clerk_id,
    data->>'image' AS image,
    data->>'avatarUrl' AS avatarUrl,
    data->>'profileImage' AS profileImage,
    data->>'profileImageSource' AS profileImageSource
  FROM member_profiles
  WHERE visibility = 'visible' AND is_active = true
  LIMIT 180
`;

function normToAbs(url: any): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return SITE.replace(/\/+$/, '') + url;
  return SITE.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
}

async function main() {
  const rs = await pool.query<Row>(QUERY);
  const rows = rs.rows;
  console.log(`[SWEEP] Visible active members: ${rows.length}`);
  console.log(`[SWEEP] Site base: ${SITE}\n`);

  const samplesByBucket: Record<string, any[]> = {
    gravatar_blank: [],
    uploads_origin_rel: [],
    clerk_cdn_http: [],
    external_http: [],
    firebase_urls: [],
    double_uploads_typo: [],
  };

  for (const r of rows) {
    const rawFields = { image: r.image, avatarUrl: r.avatarurl, profileImage: r.profileimage, profileImageSource: r.profileimagesource };
    const emails = r.email ?? '';
    for (const [k, raw] of Object.entries(rawFields)) {
      if (!raw || typeof raw !== 'string') continue;
      if (raw.includes('gravatar.com/avatar') && raw.includes('d=blank')) samplesByBucket.gravatar_blank.push({ email: emails, field: k, val: raw });
      else if (raw.startsWith('/uploads/uploads/')) samplesByBucket.double_uploads_typo.push({ email: emails, field: k, val: raw });
      else if (raw.startsWith('/uploads/')) samplesByBucket.uploads_origin_rel.push({ email: emails, field: k, val: raw });
      else if (raw.startsWith('http') && raw.includes('img.clerk.com')) samplesByBucket.clerk_cdn_http.push({ email: emails, field: k, val: raw });
      else if (raw.startsWith('http') && (raw.includes('firebasestorage') || raw.includes('storage.googleapis.com'))) samplesByBucket.firebase_urls.push({ email: emails, field: k, val: raw });
      else if (raw.startsWith('http')) samplesByBucket.external_http.push({ email: emails, field: k, val: raw });
    }
  }

  for (const [bucket, arr] of Object.entries(samplesByBucket)) {
    console.log(`\n=== Bucket: ${bucket} — count=${arr.length} ===`);
    if (arr.length === 0) continue;
    const slice = arr.slice(0, Math.min(12, arr.length));
    const results = await Promise.all(slice.map(s => head(normToAbs(s.val)!)));
    const fail = results.filter(r => !r.ok).length;
    console.log(`  HTTP head pass rate: ${results.length - fail}/${results.length} (fail=${fail})`);
    for (let i = 0; i < slice.length; i++) {
      const s = slice[i]; const r = results[i];
      if (!r.ok) console.log(`  ❌ ${s.email} ${s.field}=${s.val} -> HTTP ${r.status ?? 'ERR'}${r.err ? ' ' + r.err : ''}`);
      else if (bucket === 'uploads_origin_rel' || bucket === 'double_uploads_typo' || i < 3) console.log(`  ✅ ${s.email} ${s.field}=${s.val.slice(0,100)} -> HTTP ${r.status}`);
    }
  }

  // Shadowed-photo analysis: Gravatar-blank avatarUrl BUT profileImage or image = /uploads/ REAL photo
  console.log(`\n=== SHADOWED: Gravatar d=blank hides valid /uploads/ photo? ===`);
  let shadowed = 0;
  for (const r of rows) {
    const avatar = String(r.avatarurl ?? '');
    if (!(avatar.includes('gravatar.com/avatar') && avatar.includes('d=blank'))) continue;
    const shadow = [
      { k: 'image', v: r.image }, { k: 'profileImage', v: r.profileimage }, { k: 'profileImageSource', v: r.profileimagesource }
    ].filter(f => f.v && typeof f.v === 'string' && (f.v.startsWith('/uploads/') || (f.v.startsWith('http') && !f.v.includes('gravatar.com'))));
    if (shadow.length > 0) {
      shadowed++;
      if (shadowed <= 15) console.log(`  [${shadowed}] ${r.email} avatarUrl=GRAVATAR-BLANK but also has ${shadow.map(s => `${s.k}=${(s.v as string).slice(0,80)}`).join(' + ')}`);
    }
  }
  console.log(`TOTAL shadowed-by-gravatar members with real-but-unused photo fields: ${shadowed}`);

  await pool.end();
  console.log('\n[DONE]');
}

main().catch(e => { console.error(e); process.exit(1); });
