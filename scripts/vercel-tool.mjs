#!/usr/bin/env node
/**
 * scripts/vercel-tool.mjs
 * Default Vercel workspace helper for every TRAE session.
 *
 * Usage (any future session):
 *   node scripts/vercel-tool.mjs whoami
 *   node scripts/vercel-tool.mjs project                 # ybw-frontend project info
 *   node scripts/vercel-tool.mjs deploys [limit=5]       # recent deploys + state
 *   node scripts/vercel-tool.mjs deploy <deploy-url>     # one deploy detail
 *   node scripts/vercel-tool.mjs cancel <deploy-id>      # cancel in-progress
 *   node scripts/vercel-tool.mjs aliases                 # production / preview URLs
 *   node scripts/vercel-tool.mjs env                     # project env vars (keys only)
 *   node scripts/vercel-tool.mjs usage [fromISO] [toISO] # 24h billable usage breakdown
 *   node scripts/vercel-tool.mjs inspect                 # high-level: plan + builds + 24h fn invocations
 *
 * Auth (one-time, FREE):
 *   1. Go https://vercel.com/account/tokens → create token scoped "All projects" or just ybw-frontend
 *   2. Paste the token line into .env.local:  VERCEL_TOKEN=vercel_xxxYYYzzz123
 *   3. Done. This script auto-loads .env.local every run → default auth every TRAE session.
 */
import { readFileSync, existsSync } from 'node:fs';
import { request } from 'node:https';
import { URL } from 'node:url';

const BASE_ROOT = `https://api.vercel.com`;
const PROJECT = 'ybw-frontend';
const OWNER = 'ghost-publishing-projects';
const TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_RAh0RgZIDwJF9oixeCuD6UBd';

function loadEnv() {
  const paths = ['.env.local', '.env'];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      let v = line.slice(idx + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (k && !(k in process.env)) process.env[k] = v;
    }
  }
}

function token() {
  const t = process.env.VERCEL_TOKEN;
  if (!t) {
    console.error('[vercel-tool] ERROR: VERCEL_TOKEN not set in .env.local');
    console.error('  → Go https://vercel.com/account/tokens (FREE) + add line:');
    console.error('      VERCEL_TOKEN=vercel_...your.token.here');
    console.error('  → Script auto-loads it every future run.');
    process.exit(2);
  }
  return t;
}

function http(method, pathpath, opts = {}) {
  const useTeamId = !(opts.noTeamId === true);
  const query = new URLSearchParams();
  if (useTeamId) query.set('teamId', TEAM_ID);
  if (opts.query) for (const [k, v] of Object.entries(opts.query)) query.set(k, String(v));
  const qs = query.toString();
  const url = new URL(BASE_ROOT + pathpath + (qs ? '?' + qs : ''));
  return new Promise((resolve, reject) => {
    const req = request(
      { method, hostname: url.hostname, path: url.pathname + url.search,
        headers: { Authorization: 'Bearer ' + token(),
                   Accept: 'application/json',
                   'Content-Type': 'application/json' } },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          try {
            const obj = chunks ? JSON.parse(chunks) : null;
            if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${chunks.slice(0,500)}`));
            resolve(obj);
          } catch (e) { reject(e); }
        });
      }
    ).on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

function printTable(rows, cols) {
  if (!rows || rows.length === 0) return console.log('(no rows)');
  const norm = rows.map(r => Object.fromEntries(cols.map(c => [c.label, String(r[c.key] ?? '').slice(0, c.w ?? 200)])));
  console.table(norm, cols.map(c => c.label));
}

const cmd = process.argv[2] || 'inspect';
loadEnv();

(async () => {
  if (cmd === 'whoami') {
    let info = null;
    try {
      const u = await http('GET', '/v2/user', { noTeamId: true });
      info = { kind: 'user-token', user: u.username || u.email, uid: u.id, name: u.name, billable: u.billableEmail, softBlock: u.softBlock };
    } catch(_) {
      const p = await http('GET', '/v9/projects', { query: { limit: 1 } });
      const first = (p.projects || [])[0];
      info = { kind: 'project-scoped-token (vcp_)', note: '/v2/user not available; this PAT is scoped to project(s). Visible project count:', count: (p.projects||[]).length, first_project: first ? { name: first.name, id: first.id, accountId: first.accountId, framework: first.framework } : null };
    }
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (cmd === 'project') {
    const p = await http('GET', `/v9/projects/${PROJECT}`);
    console.log(JSON.stringify({
      name: p.name, plan: p.plan, accountId: p.accountId, framework: p.framework,
      latestDeployments: (p.latestDeployments || []).map(d => ({ url: d.url, state: d.state, createdAt: new Date(d.createdAt).toISOString(), branch: d.meta?.githubCommitRef || '?' })),
      target: p.targets,
      buildCommand: p.buildCommand, devCommand: p.devCommand, installCommand: p.installCommand
    }, null, 2));
    return;
  }

  if (cmd === 'deploys' || cmd === 'deployments') {
    const n = Number(process.argv[3] || 8);
    const r = await http('GET', `/v6/deployments`, { query: { projectId: PROJECT, limit: n } });
    printTable((r.deployments || []).map(d => ({
      state: d.state,
      url: d.url,
      branch: d.meta?.githubCommitRef || d.meta?.githubCommitSha?.slice(0,8) || '-',
      age: (()=>{const s=(Date.now()-d.createdAt)/1000; return s<60? s+'s': s<3600? Math.round(s/60)+'m': Math.round(s/3600)+'h';})(),
      ready: d.ready ? Math.round((d.ready-d.createdAt)/1000)+'s' : '-',
      creator: d.creator?.username || '-'
    })), [
      { key: 'state', label: 'STATE', w: 10 },
      { key: 'age', label: 'AGE', w: 6 },
      { key: 'ready', label: 'DUR', w: 6 },
      { key: 'branch', label: 'BRANCH', w: 24 },
      { key: 'creator', label: 'USER', w: 12 },
      { key: 'url', label: 'URL', w: 48 }
    ]);
    return;
  }

  if (cmd === 'aliases') {
    const p = await http('GET', `/v9/projects/${PROJECT}`);
    const rows = [];
    const targets = p.targets || {};
    for (const [env, info] of Object.entries(targets)) {
      for (const a of (info.alias || [])) rows.push({ env, alias: a, deployment: info.deployment?.url || '-', created: info.deployment?.createdAt ? new Date(info.deployment.createdAt).toISOString().slice(0,16).replace('T',' ') : '-' });
    }
    if (rows.length === 0 && (p.alias || []).length) {
      for (const a of p.alias || []) rows.push({ env: 'project', alias: a.alias || a, deployment: a.deployment?.url || '-', created: new Date(a.createdAt || Date.now()).toISOString().slice(0,16).replace('T',' ') });
    }
    if (rows.length === 0) return console.log('(no project aliases configured — custom domains live in project.targets.production.alias)');
    printTable(rows, [
      { key: 'env', label: 'TARGET', w: 10 },
      { key: 'alias', label: 'ALIAS', w: 56 },
      { key: 'deployment', label: 'DEPLOY', w: 56 },
      { key: 'created', label: 'DEPLOYED_AT', w: 16 }
    ]);
    return;
  }

  if (cmd === 'cancel') {
    const id = process.argv[3];
    if (!id) return console.error('need deploy id/url');
    const r = await http('PATCH', `/v6/deployments/${encodeURIComponent(id)}/cancel`);
    console.log(JSON.stringify({ id: r.id, state: r.state, cancelledBy: r.cancelledBy }, null, 2));
    return;
  }

  if (cmd === 'env') {
    const r = await http('GET', `/v9/projects/${PROJECT}/env`);
    const envs = r.envs || r;
    console.log(JSON.stringify((envs).map(e => ({
      key: e.key, target: e.target, type: e.type, id: e.id, createdAt: new Date(e.createdAt || 0).toISOString().slice(0,10)
    })), null, 2));
    return;
  }

  if (cmd === 'deploy' || cmd === 'deployment') {
    const id = process.argv[3];
    if (!id) return console.error('need deploy id or url');
    const r = await http('GET', `/v6/deployments/${encodeURIComponent(id)}`);
    console.log(JSON.stringify({ id: r.id, url: r.url, state: r.state, created: new Date(r.createdAt).toISOString(), ready: r.ready? new Date(r.ready).toISOString(): null, duration_s: r.ready? Math.round((r.ready-r.createdAt)/1000): null, errorCode: r.errorCode, errorMessage: r.errorMessage, meta: r.meta, builds: (r.builds||[]).slice(0,5) }, null, 2));
    return;
  }

  if (cmd === 'usage') {
    const from = process.argv[3] || new Date(Date.now()-24*3600*1000).toISOString().slice(0,10);
    const to   = process.argv[4] || new Date().toISOString().slice(0,10);
    let r;
    try {
      r = await http('GET', `/v2/usage`, { query: { from, to, projectIds: PROJECT } });
    } catch(e) {
      r = await http('GET', `/v1/teams/${TEAM_ID}/usage`, { query: { from, to }, noTeamId: true });
    }
    const out = {};
    for (const k of Object.keys(r)) {
      const v = r[k];
      if (typeof v === 'object' && v !== null && ('total' in v || 'used' in v || 'data' in v)) out[k] = v;
    }
    console.log(JSON.stringify({ from, to, ...out }, null, 2));
    return;
  }

  if (cmd === 'inspect') {
    const user = await http('GET', '/v2/user', { noTeamId: true }).catch(() => null);
    const proj = await http('GET', `/v9/projects/${PROJECT}`).catch(() => null);
    const deps = await http('GET', `/v6/deployments`, { query: { projectId: PROJECT, limit: 5 } }).catch(() => null);
    let usage = null;
    try {
      const from = new Date(Date.now()-2*24*3600*1000).toISOString().slice(0,10);
      const to   = new Date().toISOString().slice(0,10);
      usage = await http('GET', `/v2/usage`, { query: { from, to, projectIds: PROJECT } });
    } catch(_) {
      try {
        const from = new Date(Date.now()-2*24*3600*1000).toISOString().slice(0,10);
        const to   = new Date().toISOString().slice(0,10);
        usage = await http('GET', `/v1/teams/${TEAM_ID}/usage`, { query: { from, to }, noTeamId: true });
      } catch(__) {}
    }
    console.log(JSON.stringify({
      user: user ? { name: user.name || user.username, email: user.email, uid: user.id, softBlock: user.softBlock, plan: proj?.plan || user.plan || '?' } : 'NOT_AUTHED',
      project: proj ? { name: proj.name, plan: proj.plan, accountId: proj.accountId, framework: proj.framework, updatedAt: new Date(proj.updatedAt||0).toISOString().slice(0,16), latestDeploy: (proj.latestDeployments||[])[0]?.url, targets: Object.keys(proj.targets || {}) } : 'N/A',
      last_deploys: (deps?.deployments||[]).slice(0,5).map(d => ({
        state: d.state, age: Math.round((Date.now()-d.createdAt)/60000)+'m', branch: d.meta?.githubCommitRef || '-', url: d.url
      })),
      usage_48h: usage ? Object.fromEntries(Object.entries(usage).filter(([k,v]) => typeof v === 'object' && v && (('total' in v)||('used' in v)||('data' in v))).map(([k,v])=>[k,v])) : null
    }, null, 2));
    return;
  }

  console.error('Unknown command:', cmd);
  process.exit(1);
})().catch(e => { console.error('[vercel-tool] FAIL:', e.message); process.exit(1); });
