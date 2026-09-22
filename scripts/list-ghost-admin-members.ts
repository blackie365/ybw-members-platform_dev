#!/usr/bin/env -S pnpm tsx
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: false });

// Instantiate Ghost Admin API directly (bypass 'use server' module shape issue).
import GhostAdminAPI from '@tryghost/admin-api';
import { normalizeBaseUrl } from '@/lib/ghost';
import fs from 'node:fs';
import path from 'node:path';

type GhostMember = {
  id: string;
  email: string;
  name?: string;
  note?: string | null;
  labels?: Array<{ name: string }> | null;
  status?: string;
  tier?: { name?: string } | null;
  subscribed?: boolean;
  created_at?: string;
  updated_at?: string;
};

function getGhostAdmin(): any | null {
  const key = process.env.GHOST_ADMIN_API_KEY || process.env.GHOST_ADMIN_KEY;
  if (!key) {
    console.error('FATAL: GHOST_ADMIN_API_KEY / GHOST_ADMIN_KEY not present in env.');
    process.exit(2);
  }
  const url = normalizeBaseUrl(
    (process.env.GHOST_ADMIN_API_URL ||
      process.env.NEXT_PUBLIC_GHOST_API_URL ||
      process.env.GHOST_API_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://yorkshirebusinesswoman.co.uk') as string,
  );
  try {
    return new GhostAdminAPI({ url, key, version: 'v5.0' });
  } catch (err: any) {
    console.error('FATAL: failed to init Ghost Admin API:', err?.message || err);
    process.exit(3);
  }
}

async function getAllGhostMembers(admin: any): Promise<GhostMember[]> {
  const members: GhostMember[] = [];
  let page = 1;
  while (true) {
    const resp: any = await admin.members.browse({
      page,
      limit: 100,
      order: 'created_at DESC',
    });
    const pageArr = (resp as any).members || (Array.isArray(resp) ? resp : []);
    if (pageArr.length === 0) break;
    members.push(...pageArr);
    const meta = (resp as any).meta?.pagination;
    if (!meta || !meta.pages || page >= meta.pages) break;
    page += 1;
  }
  return members;
}

function writeBackup(blob: unknown): string {
  const dir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fname = `ghost-members-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const full = path.join(dir, fname);
  fs.writeFileSync(full, JSON.stringify(blob, null, 2), 'utf-8');
  return full;
}

(async () => {
  const admin = getGhostAdmin();
  console.log('Browsing Ghost admin members list ...');
  const members = await getAllGhostMembers(admin);
  console.log(`Ghost admin members total: ${members.length}`);

  // Basic duplicate email grouping (case-insensitive) for quick view.
  const byEmailLower = new Map<string, GhostMember[]>();
  for (const m of members) {
    const k = (m.email || '').toLowerCase();
    if (!k) continue;
    if (!byEmailLower.has(k)) byEmailLower.set(k, []);
    byEmailLower.get(k)!.push(m);
  }
  const dupes = Array.from(byEmailLower.entries())
    .filter(([, arr]) => arr.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Duplicate email groups (Ghost-only): ${dupes.length}`);

  const backup = writeBackup({
    generatedAt: new Date().toISOString(),
    members,
    duplicates: dupes.map(([emailLower, arr]) => ({
      emailLower,
      count: arr.length,
      rows: arr.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name || null,
        status: m.status || null,
        tier: m.tier?.name || null,
        subscribed: m.subscribed ?? null,
        labels: m.labels?.map((l) => l.name) || [],
        created_at: m.created_at || null,
        updated_at: m.updated_at || null,
      })),
    })),
  });

  console.log(`Backup JSON written: ${backup}`);

  console.log('');
  console.log('================ GHOST MEMBERS (compact) =================');
  console.log(
    `${String('#').padEnd(4, ' ')}  ${'email'.padEnd(52, ' ')}  ${'name'.padEnd(
      28,
      ' ',
    )}  ${'tier'.padEnd(14, ' ')}  ${'status'.padEnd(10, ' ')}  labels`,
  );
  for (let i = 0; i < members.length; i += 1) {
    const m = members[i];
    const labels = (m.labels || []).map((l) => l.name).join(',') || '-';
    console.log(
      `${String(i + 1).padStart(3, ' ')}  ${String(m.email).padEnd(52, ' ').slice(0, 52)}  ${String(
        m.name || '-',
      )
        .padEnd(28, ' ')
        .slice(0, 28)}  ${String(m.tier?.name || '-').padEnd(14, ' ').slice(0, 14)}  ${String(
          m.status || '-',
        )
          .padEnd(10, ' ')
          .slice(0, 10)}  ${labels}`,
    );
  }

  if (dupes.length > 0) {
    console.log('');
    console.log('================ GHOST DUPLICATE EMAIL GROUPS ================');
    for (const [emailLower, arr] of dupes) {
      console.log(`--- ${emailLower} (${arr.length}) ---`);
      for (const m of arr) {
        console.log(
          `  id=${m.id}  status=${m.status || '-'}  tier=${m.tier?.name || '-'}  name=${
            m.name || '-'
          }  created=${m.created_at || '-'}`,
        );
      }
    }
  }
})().catch((err) => {
  console.error('FATAL ghost-members list error:', err);
  process.exit(1);
});
