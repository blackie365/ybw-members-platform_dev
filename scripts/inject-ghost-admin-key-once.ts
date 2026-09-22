#!/usr/bin/env -S pnpm tsx
import { writeFileSync, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

function loadKeyFromEnv(): string {
  const v =
    process.env.INJECT_GHOST_ADMIN_API_KEY ||
    process.env.GHOST_ADMIN_API_KEY_INJECT ||
    '';
  if (!v) {
    console.error(
      'FATAL: INJECT_GHOST_ADMIN_API_KEY env var is empty. Set it as an encrypted repo secret passed into the maintenance runner env.',
    );
    process.exit(2);
  }
  const [id, secret] = v.split(':');
  if (!id || !secret || id.length < 16 || secret.length < 32) {
    console.error(
      'FATAL: INJECT_GHOST_ADMIN_API_KEY shape is invalid (expected <id>:<long-secret>, min lengths 16/32). Refusing to write.',
    );
    process.exit(3);
  }
  return v;
}

function main() {
  const cwd = process.cwd();
  const envFile = resolve(cwd, '.env.local');
  const envDir = dirname(envFile);
  if (!existsSync(envDir)) mkdirSync(envDir, { recursive: true });
  if (!existsSync(envFile)) writeFileSync(envFile, '', { mode: 0o660 });

  const raw = readFileSync(envFile, 'utf-8');
  const keyValue = loadKeyFromEnv();

  // Idempotent: drop any existing GHOST_ADMIN_API_KEY= or GHOST_ADMIN_KEY= lines
  // (GHOST_ADMIN_KEY is the legacy fallback used by ghost-admin.ts)
  const stripped = raw
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('GHOST_ADMIN_API_KEY=') && !l.startsWith('GHOST_ADMIN_KEY='))
    .join('\n');
  const withoutTrailing = stripped.endsWith('\n') ? stripped.slice(0, -1) : stripped;
  const newContent = `${withoutTrailing}\nGHOST_ADMIN_API_KEY=${keyValue}\n`;

  // Atomic write
  const tmp = `${envFile}.tmp.${process.pid}`;
  writeFileSync(tmp, newContent, { mode: 0o660 });
  renameSync(tmp, envFile);

  // Sanity: print only counts/lengths, NEVER the value
  const after = readFileSync(envFile, 'utf-8');
  const match = after.match(/^GHOST_ADMIN_API_KEY=(.+)$/m);
  if (!match) {
    console.error('FATAL: post-write verification failed — GHOST_ADMIN_API_KEY line missing.');
    process.exit(4);
  }
  const written = match[1];
  const [id, secret] = written.split(':');
  const lines = after.match(/^GHOST_ADMIN_API_KEY=/gm)?.length || 0;
  console.log(
    `Wrote .env.local: ${envFile} | GHOST_ADMIN_API_KEY lines=${lines} | id_len=${
      id.length
    } | secret_len=${secret.length} | valid_shape=${Boolean(
      id && secret && id.length >= 16 && secret.length >= 32,
    )}`,
  );
  process.exit(0);
}

main();
