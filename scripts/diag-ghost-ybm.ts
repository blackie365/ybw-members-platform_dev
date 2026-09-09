#!/usr/bin/env tsx
/**
 * Temporary diagnostic (read-only) for the yorkshirebusinessman.co.uk Ghost
 * install at /var/www/ghost_ybm on the frontend VPS.
 *
 * Prints, with secrets redacted:
 *   - install dir layout + ownership/permissions (readability for www-data)
 *   - Ghost core version (root + current/package.json)
 *   - config.production.json: url, server, db client + host/port/db/user
 *     (password masked), and whether a mail transport is configured
 *   - owner/staff rows from the DB (id, name, email, status, created_at)
 *   - session table row count
 *   - process + systemd unit names for this install
 *
 * ONLY reads. Does not write to the DB, files, or services.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const GHOST = '/var/www/ghost_ybm';
const CFG = `${GHOST}/config.production.json`;

function run(args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number }): string {
  try {
    return execFileSync(args[0], args.slice(1), {
      cwd: opts?.cwd,
      env: opts?.env ?? process.env,
      timeout: opts?.timeout ?? 20000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return `[ERR] ${err.stderr?.trim() || err.stdout?.trim() || err.message}`;
  }
}

function redactPassword(value: unknown): string {
  return value === undefined || value === null || value === '' ? '<none>' : '<set>';
}

function main(): void {
  console.log(`whoami: ${run(['whoami'])}`);
  console.log(`hostname: ${run(['hostname'])}`);
  console.log(`GHOST: ${GHOST}`);

  console.log('\n=== install dir ===');
  console.log(`ls -ld: ${run(['ls', '-ldn', GHOST])}`);
  if (!existsSync(GHOST)) {
    console.log(`FATAL: ${GHOST} does not exist`);
    return;
  }
  const top = run(['ls', '-la', GHOST]);
  console.log(top.includes('[ERR]') ? top : `entries:\n${top}`);

  console.log('\n=== versions ===');
  for (const f of ['package.json', 'current/package.json']) {
    const p = `${GHOST}/${f}`;
    if (!existsSync(p)) {
      console.log(`${f}: <missing>`);
      continue;
    }
    try {
      const j = JSON.parse(readFileSync(p, 'utf8')) as { version?: string; name?: string };
      console.log(`${f}: ${j.name ?? '?'} ${j.version ?? '?'}`);
    } catch (e) {
      console.log(`${f}: [ERR] ${(e as Error).message}`);
    }
  }

  console.log('\n=== config.production.json (redacted) ===');
  if (!existsSync(CFG)) {
    console.log(`FATAL: ${CFG} does not exist or is unreadable`);
  } else {
    try {
      const cfg = JSON.parse(readFileSync(CFG, 'utf8')) as Record<string, unknown>;
      const url = (cfg.url as string | undefined) ?? '<unset>';
      const server = (cfg.server as Record<string, unknown> | undefined) ?? {};
      console.log(`url: ${url}`);
      console.log(`server: port=${server.port ?? '<unset>'} host=${server.host ?? '<default>'}`);
      if (cfg.ghostUrl) console.log(`ghostUrl: ${String(cfg.ghostUrl)}`);
      if (cfg.ghostAdminUrl) console.log(`ghostAdminUrl: ${String(cfg.ghostAdminUrl)}`);

      const db = (cfg.database as Record<string, unknown> | undefined) ?? {};
      console.log(`db.client: ${String(db.client)}`);
      const conn = (db.connection as Record<string, unknown> | undefined) ?? {};
      const isSqlite = String(db.client).toLowerCase().includes('sqlite');
      if (isSqlite) {
        console.log(`db.sqlite.filename: ${String(conn.filename ?? conn.file ?? '<unset>')}`);
      } else {
        console.log(
          `db.connection: host=${conn.host ?? '<unset>'} port=${conn.port ?? '<unset>'} ` +
            `database=${conn.database ?? '<unset>'} user=${conn.user ?? '<unset>'} password=${redactPassword(conn.password)}`,
        );
      }

      const mail = (cfg.mail as Record<string, unknown> | undefined) ?? {};
      const isEmpty = Object.keys(mail).length === 0;
      console.log(`mail.transport: ${isEmpty ? '<none configured>' : String(mail.transport ?? '(object)')}`);
      if (mail.from) console.log(`mail.from: ${String(mail.from)}`);
    } catch (e) {
      console.log(`config parse failed (permission or corrupt): ${(e as Error).message}`);
    }
  }

  console.log('\n=== tooling present on box ===');
  for (const t of ['node', 'mysql', 'mariadb', 'sqlite3']) {
    const w = run(['which', t]);
    console.log(`${t}: ${w.includes('[ERR]') ? 'not found' : w}`);
  }

  console.log('\n=== process + systemd (this install only) ===');
  const psOut = run(['bash', '-c', 'ps -eo user,pid,etime,cmd | grep -F /var/www/ghost_ybm | grep -v grep || true']);
  console.log(psOut.includes('[ERR]') ? psOut : psOut || '<no processes matching /var/www/ghost_ybm>');
  const units = run(['bash', '-c', 'systemctl list-units --all --no-legend --no-pager 2>/dev/null | grep -i ghost || true']);
  console.log(units.includes('[ERR]') ? units : units || '<no ghost systemd units seen>');

  console.log('\n=== DB read-only probe ===');
  const current = existsSync(`${GHOST}/current`) ? `${GHOST}/current` : GHOST;
  const probe = `
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync(process.env.GHOST_CFG, 'utf8'));
const db = cfg.database || {};
const client = String(db.client || '').toLowerCase();
const conn = db.connection || {};
const write = (k, v) => console.log(k + '=' + JSON.stringify(v));
(async () => {
  let users, sessions;
  if (client.includes('sqlite')) {
    const sqlite = require('sqlite3');
    await new Promise((res, rej) => {
      const d = new sqlite.Database(conn.filename || conn.file || '', e => e ? rej(e) : res());
      d.all('select id, name, email, status, created_at from users order by id limit 50',
        (e, rows) => { if (e) return rej(e); users = rows; sessions = null; d.close(); });
    });
  } else {
    const mysql = require('mysql2/promise');
    const c = await mysql.createConnection({
      host: conn.host, port: conn.port || 3306, user: conn.user,
      password: conn.password, database: conn.database, connectTimeout: 8000,
    });
    const [r] = await c.execute('select id, name, email, status, created_at from users order by id limit 50');
    users = r;
    try {
      const [s] = await c.execute('select count(*) as n from sessions');
      sessions = s;
    } catch (e) { sessions = [{n: 'ERR ' + e.message}]; }
    await c.end();
  }
  write('users', users);
  write('sessions', sessions);
})().catch(e => { console.log('DBPROBE_ERROR=' + (e && e.message ? e.message : String(e))); process.exit(0); });
`;
  const out = run(
    ['node', '-e', probe],
    { cwd: current, env: { ...process.env, GHOST_CFG: CFG }, timeout: 25000 },
  );
  console.log(out);
  console.log('\nDone (read-only).');
}

main();