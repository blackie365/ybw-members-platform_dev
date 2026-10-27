// Nightly Ghost <-> Postgres member reconcile (daily 02:30 UTC via ybw-member-reconcile.timer).
// Postgres is the source of truth for membership. Ghost is legacy: it still carries
// rows and stale paid flags from the shared-Stripe era, so a raw count diff is
// expected and is NOT actionable. The full drift picture is still written to
// member_audit for visibility, but we only alert (and exit non-zero) when a
// genuinely NEW Ghost paid sign-up appears — a paid-like Ghost member created
// inside the recent window that the platform DB has never seen. That is the one
// thing that needs a human.
// Must run with NODE_PATH=/srv/ybw-frontend/node_modules so pnpm symlinks resolve,
// WorkingDirectory=/srv/ybw-frontend so the relative require paths for libs resolve.

import GhostAdminAPI from '@tryghost/admin-api';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Client } = pg;

const ROOT = process.env.YBW_ROOT || path.resolve(__dirname, '..');
const env = Object.assign({}, process.env);
const envPath = path.resolve(ROOT, '.env.local');
try {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if (v.length >= 2) {
      const f = v[0], l = v[v.length - 1];
      if ((f === '"' && l === '"') || (f === "'" && l === "'")) v = v.slice(1, -1);
    }
    if (!(k in env)) env[k] = v;
  }
} catch (_err) { /* ignore if missing */ }

const adminEmail = env.ADMIN_EMAIL || env.OWNER_EMAIL || env.SMTP_TO || null;
const ghostUrlStr = env.GHOST_API_URL || env.NEXT_PUBLIC_GHOST_API_URL || `https://admin.${env.NEXT_PUBLIC_SITE_DOMAIN || 'yorkshirebusinesswoman.co.uk'}`;
const ghostUrl = new URL(ghostUrlStr.replace(/\/+$/, '') + '/');
const ghostKey = env.GHOST_ADMIN_API_KEY || env.GHOST_ADMIN_KEY;
const premiumTierId = env.GHOST_PREMIUM_TIER_ID || env.GHOST_PREMIUM_TIER || null;
const GHOST_API_VERSION = env.GHOST_API_VERSION || 'v6.44';

const KNOWN_DELTA_IGNORE = new Set([
  'rob@ghost-communications.com',
].map(s => String(s || '').toLowerCase().trim()));

// How far back to look for a "new" Ghost paid sign-up. Anything older is treated
// as legacy state left over from before memberships moved to the Next.js app.
const NEW_SIGNUP_WINDOW_HOURS = Number(env.RECONCILE_NEW_WINDOW_HOURS || 72);

if (!ghostKey) {
  console.error('[reconcile] missing GHOST_ADMIN_API_KEY — abort');
  process.exit(2);
}

// Sign Ghost v5 admin JWT token manually for raw HTTP calls.
function signAdminToken(key) {
  const [id, secret] = String(key).split(':');
  if (!id || !secret) throw new Error('Invalid GHOST_ADMIN_API_KEY format (expect kid:secret hex)');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 5 * 60, aud: '/v5/admin/' };
  const payB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${header}.${payB64}`;
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(input).digest('base64url');
  return `${input}.${sig}`;
}

// Raw HTTPS helper — avoids legacy @tryghost/admin-api stripping include fields in browse.
function ghostReq(method, path, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const u = new URL(path, ghostUrl);
    const headers = {
      Authorization: 'Ghost ' + signAdminToken(ghostKey),
      'Accept-Version': GHOST_API_VERSION,
      'Content-Type': 'application/json',
    };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request({ host: u.hostname, port: u.port || 443, path: u.pathname + u.search, method, headers }, (res) => {
      let c = '';
      res.on('data', ch => c += ch.toString());
      res.on('end', () => {
        let o = c;
        try { o = JSON.parse(c); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: o, raw: c });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// @tryghost/admin-api still initialized for optional direct add/edit helpers if needed later.
const api = new GhostAdminAPI({ url: ghostUrlStr, key: ghostKey, version: 'v5.0' });

async function fetchAllGhost() {
  let page = 1, all = [];
  while (true) {
    const include = encodeURIComponent('tiers,labels,subscriptions,products');
    const path = `/ghost/api/admin/members/?page=${page}&limit=100&order=email%20ASC&include=${include}`;
    const res = await ghostReq('GET', path, null);
    if (res.status < 200 || res.status >= 300) {
      console.error('[reconcile] Ghost browse failed HTTP', res.status, 'body=', JSON.stringify(res.body?.errors || res.body || '').slice(0, 300));
      throw new Error('Ghost browse failed');
    }
    const arr = Array.isArray(res.body?.members) ? res.body.members : [];
    if (!arr.length) break;
    all = all.concat(arr);
    if (arr.length < 100 || page > 200) break;
    page++;
  }
  return all;
}

function tierRank(name) {
  switch (String(name || 'free').toLowerCase().trim()) {
    case 'founder': return 6;
    case 'premium': return 5;
    case 'paid_annual': return 4;
    case 'paid_monthly': return 3;
    case 'complimentary':
    case 'comped': return 2;
    case 'free': return 1;
    default: return 0;
  }
}

function buildAdminEmailHtml(s) {
  const { runAt, ghostUniques, paidGhost, compedGhost, freeGhost, countRowRows, distinctEmails, deltaDistinct, ghostOnly, pgOnly, tierMismatches, newGhostPaid = [], legacyDrift } = s;
  const rows = (a) => a.map(e => `<tr><td style="padding:4px 8px;border:1px solid #eee;">${String(e).replace(/[<>]/g, '')}</td></tr>`).join('');
  const newRows = newGhostPaid.slice(0, 50).map(m => `<tr>
    <td style="padding:4px 8px;border:1px solid #eee;">${String(m.email).replace(/[<>]/g, '')}</td>
    <td style="padding:4px 8px;border:1px solid #eee;">${String(m.createdAt || '-').replace(/[<>]/g, '')}</td>
    <td style="padding:4px 8px;border:1px solid #eee;">${String(m.status || '-').replace(/[<>]/g, '')}</td>
  </tr>`).join('');
  const mism = tierMismatches.slice(0, 20).map(m => `<tr>
    <td style="padding:4px 8px;border:1px solid #eee;">${m.email}</td>
    <td style="padding:4px 8px;border:1px solid #eee;">${m.pgTier || 'free'}</td>
    <td style="padding:4px 8px;border:1px solid #eee;">${m.ghostStatus}</td>
    <td style="padding:4px 8px;border:1px solid #eee;">${(m.ghostLabels || '').replace(/[<>]/g, '') || '-'}</td>
  </tr>`).join('');
  return `<div style="font-family:sans-serif;line-height:1.55;color:#222;max-width:860px;">
<h2 style="color:#b91c1c;">⚠️ New Ghost paid sign-up (not in the platform DB)</h2>
<p>At <b>${runAt.toISOString()}</b> Ghost created a paid-like member inside the last ${NEW_SIGNUP_WINDOW_HOURS}h that Postgres has never seen. Memberships run on the Next.js app, so a new paid Ghost sign-up means a payment slipped through Ghost's own Stripe — check and migrate it.</p>
${newGhostPaid.length ? `<h3 style="margin-top:18px;color:#b91c1c;">New paid sign-ups (${newGhostPaid.length})</h3><table style="border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:4px 8px;border:1px solid #eee;">Email</th><th style="text-align:left;padding:4px 8px;border:1px solid #eee;">Created</th><th style="text-align:left;padding:4px 8px;border:1px solid #eee;">Status</th></tr></thead><tbody>${newRows}</tbody></table>` : ''}
<p style="color:#666;font-size:12px;margin-top:12px;">Postgres is the source of truth for membership. The counts below are recorded for context only and do not by themselves need action.</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><th style="text-align:left;padding:6px 10px;border:1px solid #eee;">Metric</th><th style="text-align:left;padding:6px 10px;border:1px solid #eee;">Ghost</th><th style="text-align:left;padding:6px 10px;border:1px solid #eee;">Platform PG (active+visible FE)</th><th style="text-align:left;padding:6px 10px;border:1px solid #eee;">Δ</th></tr>
  <tr><td style="padding:6px 10px;border:1px solid #eee;">Distinct emails</td><td style="padding:6px 10px;border:1px solid #eee;"><b>${ghostUniques.size}</b></td><td style="padding:6px 10px;border:1px solid #eee;"><b>${distinctEmails}</b></td><td style="padding:6px 10px;border:1px solid #eee;"><b style="color:#b45309;">${deltaDistinct}</b></td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #eee;">Counted rows (Quickstats)</td><td style="padding:6px 10px;border:1px solid #eee;">${ghostUniques.size}</td><td style="padding:6px 10px;border:1px solid #eee;">${countRowRows}</td><td style="padding:6px 10px;border:1px solid #eee;">${(ghostUniques.size - countRowRows)}</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #eee;">Ghost status</td><td style="padding:6px 10px;border:1px solid #eee;" colspan="3">paid=${paidGhost}, comped=${compedGhost}, free=${freeGhost}</td></tr>
</table>
<p style="color:#666;font-size:12px;">Legacy drift${typeof legacyDrift === 'boolean' ? ` (${legacyDrift ? 'present' : 'none'})` : ''}: ghostOnly=${ghostOnly.length}, pgOnly=${pgOnly.length}, tierMismatches=${tierMismatches.length} — informational.</p>
${ghostOnly.length ? `<h3 style="margin-top:18px;">Legacy — Ghost only (${ghostOnly.length})</h3><table style="border-collapse:collapse;"><tbody>${rows(ghostOnly.slice(0,50))}</tbody></table>` : ''}
${pgOnly.length ? `<h3 style="margin-top:18px;">Legacy — PG only (${pgOnly.length})</h3><table style="border-collapse:collapse;"><tbody>${rows(pgOnly.slice(0,50))}</tbody></table>` : ''}
${tierMismatches.length ? `<h3 style="margin-top:18px;">Legacy — tier mismatches (${tierMismatches.length})</h3><table style="border-collapse:collapse;"><thead><tr><th>Email</th><th>PG tier</th><th>Ghost status</th><th>Ghost labels</th></tr></thead><tbody>${mism}</tbody></table>` : ''}
<p style="color:#666;font-size:12px;margin-top:24px;">auto-generated by ybw-member-reconcile.service. Check dashboard Admin → Members → review & run scripts/nightly-reconcile.mjs.</p>
</div>`;
}

(async function main() {
  const runAt = new Date();
  console.log(`[reconcile] starting at ${runAt.toISOString()} premiumTierId=${premiumTierId ? premiumTierId.slice(0,8) + '…' : '(none)'}`);
  const pgClient = new Client({
    host: env.PGHOST || '127.0.0.1',
    port: Number(env.PGPORT || 5432),
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    connectionTimeoutMillis: 10000,
  });
  await pgClient.connect();
  let ghost, ghostUniques, paidGhost, compedGhost, freeGhost;
  try {
    ghost = await fetchAllGhost();
    ghostUniques = new Set(ghost.map(m => (m.email || '').toLowerCase().trim()).filter(Boolean));
    paidGhost = ghost.filter(m => m.status === 'paid').length;
    compedGhost = ghost.filter(m => m.status === 'comped').length;
    freeGhost = ghost.filter(m => m.status === 'free').length;
  } catch (err) {
    console.error('[reconcile] Ghost fetch failed:', err?.message || err);
    await pgClient.end();
    process.exit(3);
  }

  const countRowRows = (await pgClient.query("SELECT count(*)::int n FROM member_profiles WHERE is_active = true AND visibility = 'visible'")).rows[0].n;
  const distinctEmails = (await pgClient.query(
    "SELECT count(distinct lower(btrim(coalesce(email_lower, email))))::int n FROM member_profiles WHERE is_active=true AND visibility='visible' AND (email_lower IS NOT NULL OR btrim(email) <> '')"
  )).rows[0].n;
  const totalRows = (await pgClient.query('SELECT count(*)::int n FROM member_profiles')).rows[0].n;
  const pgDistinctAll = (await pgClient.query("SELECT count(distinct lower(btrim(coalesce(email_lower,email))))::int n FROM member_profiles")).rows[0].n;
  const pgDistinctEmailList = (await pgClient.query(
    "SELECT distinct lower(btrim(coalesce(email_lower, email))) e FROM member_profiles WHERE is_active=true AND visibility='visible' AND (email_lower IS NOT NULL OR btrim(email) <> '') ORDER BY 1"
  )).rows.map(r => r.e);
  const pgSet = new Set(pgDistinctEmailList);
  const ghostOnlyAll = [...ghostUniques].filter(e => !pgSet.has(e));
  const pgOnlyAll = pgDistinctEmailList.filter(e => !ghostUniques.has(e));
  const ghostOnly = ghostOnlyAll.filter(e => !KNOWN_DELTA_IGNORE.has(e));
  const pgOnly = pgOnlyAll.filter(e => !KNOWN_DELTA_IGNORE.has(e));
  const ignoredDeltaContrib =
    ghostOnlyAll.filter(e => KNOWN_DELTA_IGNORE.has(e)).length -
    pgOnlyAll.filter(e => KNOWN_DELTA_IGNORE.has(e)).length;

  const rowsForPaidCheck = (await pgClient.query(
    "SELECT coalesce(email_lower, lower(btrim(email))) AS e, data->>'membershipTier' AS tier FROM member_profiles WHERE is_active=true AND visibility='visible' AND (email_lower IS NOT NULL OR btrim(email) <> '')"
  )).rows;
  const byEmailPG = new Map(rowsForPaidCheck.map(r => [String(r.e || '').toLowerCase().trim(), r.tier]));
  // Every email the platform DB knows about, regardless of visibility — a Ghost
  // sign-up is only "new" if Postgres has literally never seen the address.
  const pgAllEmails = (await pgClient.query(
    "SELECT distinct lower(btrim(coalesce(email_lower, email))) e FROM member_profiles WHERE (email_lower IS NOT NULL OR btrim(email) <> '')"
  )).rows.map(r => r.e);
  const pgAllSet = new Set(pgAllEmails);
  const newSignupWindowStart = Date.now() - NEW_SIGNUP_WINDOW_HOURS * 60 * 60 * 1000;
  const tierMismatches = [];
  const ghostPaidNew = [];
  for (const m of ghost) {
    const e = (m.email || '').toLowerCase().trim();
    if (!e) continue;
    const pgTier = byEmailPG.get(e) || null;
    const expectedPaid = tierRank(pgTier) >= tierRank('complimentary'); // rank >= 2 (comped/complimentary, paid_monthly, paid_annual, premium, founder)
    const ghostPaidStatus = m.status === 'paid' || m.status === 'comped';
    const labelNames = new Set((m.labels || []).map(l => String(l?.name || '').toLowerCase().trim()));
    const hasPaidLabel = labelNames.has('paid-member') || labelNames.has('stripe-upgrade') || labelNames.has('paid_annual') || labelNames.has('paid_monthly') || labelNames.has('comped-for-no-stripe') || labelNames.has('bulk-tier-sync');
    const hasAssignedTier = Array.isArray(m.tiers) && m.tiers.length > 0;
    const hasActiveSubscriptions = Array.isArray(m.subscriptions) && m.subscriptions.some((s) => {
      if (!s || !s.id) return false;
      const stat = String(s.status || '').toLowerCase();
      if (stat === 'active' || stat === 'trialing' || stat === 'past_due') return true;
      const end = s.current_period_end ? new Date(s.current_period_end * 1000) : s.ended_at ? new Date(s.ended_at) : null;
      if (s.cancel_at_period_end === false && end && !isNaN(end.getTime()) && end.getTime() > Date.now()) return true;
      return false;
    });
    const compedFlag = m.comped === true || m.complimentary_plan === true;
    // admin note: explicit PAID/ANNUAL/COMPED/PREMIUM/FOUNDER/COMPLIMENTARY whole words.
    const notePaid = typeof m.note === 'string' && /(^|[^A-Za-z])(paid|annual|comped|premium|founder|complimentary)([^A-Za-z]|$)/i.test(String(m.note || ''));
    const ghostPaidLike = ghostPaidStatus || compedFlag || hasActiveSubscriptions || (hasPaidLabel && hasAssignedTier) || (notePaid && (hasAssignedTier || compedFlag));
    if (expectedPaid !== ghostPaidLike) {
      tierMismatches.push({ email: e, pgTier: pgTier || 'free', ghostStatus: m.status, ghostLabels: (m.labels || []).map(l => l.name).join(','), ghostTierCount: (m.tiers || []).length });
    }
    // The only genuinely actionable signal: Ghost created a paid-like member
    // inside the recent window and the platform DB has never seen that email.
    const createdAtMs = m.created_at ? new Date(m.created_at).getTime() : 0;
    if (ghostPaidLike && !pgAllSet.has(e) && !KNOWN_DELTA_IGNORE.has(e) && createdAtMs >= newSignupWindowStart) {
      ghostPaidNew.push({ email: e, createdAt: m.created_at || null, status: m.status });
    }
  }
  const deltaRows = ghostUniques.size - countRowRows;
  const deltaDistinct = ghostUniques.size - distinctEmails;
  const adjustedDeltaDistinct = deltaDistinct - ignoredDeltaContrib;
  // Postgres is authoritative: the diffs above are recorded for visibility, but
  // only a new Ghost paid sign-up is actionable. Legacy drift must not page anyone.
  const legacyDrift = Math.abs(adjustedDeltaDistinct) >= 1 || ghostOnly.length >= 1 || pgOnly.length >= 1 || tierMismatches.length >= 1;
  const shouldAlert = ghostPaidNew.length >= 1;
  const ignoredGhost = ghostOnlyAll.filter(e => KNOWN_DELTA_IGNORE.has(e));
  const ignoredPg = pgOnlyAll.filter(e => KNOWN_DELTA_IGNORE.has(e));

  try {
    await pgClient.query(`CREATE TABLE IF NOT EXISTS member_audit (
      id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, target_type TEXT, target_id TEXT,
      email_lower TEXT, visibility_before TEXT, visibility_after TEXT,
      fields_changed JSONB, note TEXT, operator TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const summaryNote = shouldAlert
      ? `ALERT: ${ghostPaidNew.length} new Ghost paid sign-up(s) not in PG: ${ghostPaidNew.map(m => m.email).join(',')} — legacy drift: Δadj=${adjustedDeltaDistinct} ghostOnly=${ghostOnly.length} pgOnly=${pgOnly.length} tierMismatches=${tierMismatches.length}`
      : `OK (PG authoritative): no new Ghost paid sign-ups in last ${NEW_SIGNUP_WINDOW_HOURS}h; legacy drift recorded only (Δadj=${adjustedDeltaDistinct} ghostOnly=${ghostOnly.length} pgOnly=${pgOnly.length} tierMismatches=${tierMismatches.length} ignored=${[...ignoredGhost, ...ignoredPg].join(',')})`;
    const fieldsChanged = {
      ghostTotalRows: ghost.length,
      ghostDistinct: ghostUniques.size,
      ghostBreakdown: { paid: paidGhost, comped: compedGhost, free: freeGhost },
      pgTotalRows: totalRows,
      pgDistinctAll,
      pgActiveVisibleRows: countRowRows,
      pgActiveVisibleDistinct: distinctEmails,
      deltaRows,
      deltaDistinct,
      adjustedDeltaDistinct,
      ignoredDeltaContrib,
      ignoredGhostOnly: ignoredGhost,
      ignoredPgOnly: ignoredPg,
      ghostOnly,
      pgOnly,
      tierMismatches,
      newGhostPaid: ghostPaidNew,
      legacyDrift,
      shouldAlert,
    };
    await pgClient.query(
      `INSERT INTO member_audit (action, target_type, fields_changed, note, operator) VALUES ($1,$2,$3::jsonb,$4,$5)`,
      ['nightly_reconcile', 'member_profiles', JSON.stringify(fieldsChanged), summaryNote, 'system']
    );
  } catch (auditErr) {
    console.warn('[reconcile] best-effort member_audit write:', auditErr.message);
  }

  console.log('--- Report -------------------------------------------------------------');
  console.log('Ghost  : rows=', ghost.length, 'distinct=', ghostUniques.size, 'paid=', paidGhost, 'comped=', compedGhost, 'free=', freeGhost);
  console.log('PG tot : rows=', totalRows, 'distinct(all)=', pgDistinctAll);
  console.log('FE QS  : rows=', countRowRows, 'distinct(a+v)=', distinctEmails);
  console.log('Δ rows :', deltaRows, '   Δ distinct:', deltaDistinct, '   Δ adj (ignored=' + ignoredDeltaContrib + '):', adjustedDeltaDistinct);
  if (ignoredGhost.length || ignoredPg.length) {
    console.log('ignored:', [...ignoredGhost.map(e => 'ghost:' + e), ...ignoredPg.map(e => 'pg:' + e)].join(', '));
  }
  if (ghostOnly.length) console.log('ghostOnly:', ghostOnly.slice(0, 10).join(', '), ghostOnly.length > 10 ? `(+${ghostOnly.length - 10})` : '');
  if (pgOnly.length) console.log('pgOnly:', pgOnly.slice(0, 10).join(', '), pgOnly.length > 10 ? `(+${pgOnly.length - 10})` : '');
  if (tierMismatches.length) {
    console.log('tierMismatches=' + tierMismatches.length + ' sample (legacy, informational):');
    tierMismatches.slice(0, 5).forEach(m => console.log(' ', m.email, 'pgTier=', m.pgTier, 'ghost=', m.ghostStatus, m.ghostLabels ? 'labels='+m.ghostLabels : ''));
  }
  if (ghostPaidNew.length) {
    console.log('NEW Ghost paid sign-ups (not in PG, last ' + NEW_SIGNUP_WINDOW_HOURS + 'h):');
    ghostPaidNew.forEach(m => console.log(' ', m.email, m.createdAt || '', m.status || ''));
  } else {
    console.log('NEW Ghost paid sign-ups: none in last ' + NEW_SIGNUP_WINDOW_HOURS + 'h');
  }
  console.log('legacyDrift=' + (legacyDrift ? 'yes (informational)' : 'no'));
  console.log(shouldAlert ? 'RESULT: ACTION NEEDED — new Ghost paid sign-up' : 'RESULT: OK (PG authoritative, nothing new)');
  console.log('------------------------------------------------------------------------');

  if (shouldAlert && adminEmail) {
    try {
      const sendMod = await import(path.resolve(ROOT, 'src/lib/email.ts')).catch(() => null);
      const sendEmail = sendMod?.sendEmail;
      if (typeof sendEmail === 'function') {
        await sendEmail({
          to: [adminEmail],
          subject: `[YBWC] ⚠️ ${ghostPaidNew.length} new Ghost paid sign-up(s) not in platform DB`,
          html: buildAdminEmailHtml({ runAt, ghost, ghostUniques, paidGhost, compedGhost, freeGhost, totalRows, pgDistinctAll, countRowRows, distinctEmails, deltaRows, deltaDistinct: adjustedDeltaDistinct, ghostOnly, pgOnly, tierMismatches, newGhostPaid: ghostPaidNew, legacyDrift }),
        }).catch(e => console.warn('[reconcile] sendEmail failed:', e?.message || e));
      }
    } catch (e) {
      console.warn('[reconcile] admin notification best-effort failed:', e?.message || e);
    }
  }

  await pgClient.end();
  process.exit(shouldAlert ? 1 : 0);
})().catch(err => {
  console.error('[reconcile] FATAL:', err?.stack || err?.message || err);
  process.exit(99);
});
