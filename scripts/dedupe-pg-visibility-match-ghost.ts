import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: false });

const APPLY = process.argv.includes('--apply');
const OPERATOR = (process.env.GITHUB_ACTOR || 'maintenance-runner').slice(0, 48);

import GhostAdminAPI from '@tryghost/admin-api';
import { normalizeBaseUrl } from '@/lib/ghost';
import fs from 'node:fs';
import path from 'node:path';
import { getMemberStore, type MemberProfile } from '@/features/members/server';
import { closeMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';

type GhostMember = {
  id: string;
  email?: string;
  name?: string;
};

const TIER_RANK: Record<string, number> = {
  free: 0,
  comped: 10,
  paid_monthly: 20,
  paid_annual: 30,
};

function getGhostAdmin() {
  const key = process.env.GHOST_ADMIN_API_KEY || process.env.GHOST_ADMIN_KEY || '';
  const url = normalizeBaseUrl(process.env.NEXT_PUBLIC_GHOST_URL || process.env.GHOST_URL || process.env.GHOST_ADMIN_URL || '');
  if (!key || !url) return null;
  const [id, secret] = key.split(':');
  if (!id || !secret || id.length < 8 || secret.length < 16) return null;
  return new GhostAdminAPI({ url, key, version: 'v5' });
}

async function getAllGhostMembers(): Promise<GhostMember[]> {
  const admin = getGhostAdmin();
  if (!admin) return [];
  const out: GhostMember[] = [];
  let page = 1;
  const limit = 100;
  while (true) {
    const resp: any = await admin.members.browse({ page, limit, order: 'created_at DESC' });
    const rows = (resp as any).members || (Array.isArray(resp) ? resp : []);
    if (rows.length === 0) break;
    out.push(...rows);
    const meta = (resp as any).meta?.pagination;
    if (!meta || !meta.pages || page >= Number(meta.pages)) break;
    page += 1;
  }
  return out;
}

function writeBackup(filename: string, data: unknown) {
  const dir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o770 });
  const full = path.join(dir, filename);
  fs.writeFileSync(full, JSON.stringify(data, null, 2), { mode: 0o660 });
  return full;
}

function normalizeEmail(s?: string): string {
  return String(s || '').trim().toLowerCase();
}

function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function matchEmailFromRow(p: MemberProfile): string {
  const any = p as any;
  const candidates = [
    any.email_lower, any.emailLower, any.email, any.Email, any.user_email, any.userEmail, (any.data || any)?.emailLower, (any.data || any)?.email,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const n = normalizeEmail(c);
      if (n) return n;
    }
  }
  return '';
}

function tierRank(v: unknown): number {
  if (typeof v !== 'string') return 0;
  return TIER_RANK[v] ?? 0;
}

function hasPaidIdentity(p: MemberProfile): boolean {
  const any = p as any;
  return Boolean(any.stripeCustomerId || any.subscriptionId || any.stripeSubscriptionId || any.stripe_customer_id);
}

function scoreCandidate(p: MemberProfile): number {
  const any = p as any;
  const id = String(any.clerkId || any.clerk_id || '');
  const isClerk = id.startsWith('user_');
  const paid = hasPaidIdentity(p);
  const rank = tierRank(any.membershipTier);
  const gs = typeof any.ghostSyncedAt === 'string' && any.ghostSyncedAt.length > 0 ? 1 : 0;
  const vis = p.visibility === 'visible' ? 1 : 0;
  const keyCount = Object.keys(any.data ?? any ?? {}).length;
  const upd = typeof any.updatedAt === 'string' ? new Date(any.updatedAt).getTime() : (any.updatedAt instanceof Date ? any.updatedAt.getTime() : 0);
  return (
    (isClerk ? 2000 : 0) +
    (paid ? 500 : 0) +
    rank +
    gs * 5 +
    vis * 2 +
    keyCount * 0.01 +
    (Number.isFinite(upd) && upd > 1577836800000 ? (upd / 1e12) : 0)
  );
}

const FIELDS_TO_CARRY: string[] = [
  'firstName', 'lastName', 'displayName', 'industrySector', 'industry',
  'location', 'city', 'region', 'newsletterSubscribed', 'isNewsletterRecipient',
  'isNewsletterAuthorized', 'role', 'jobTitle', 'isAdmin', 'isFeatured',
  'stripeCustomerId', 'subscriptionId', 'stripeSubscriptionId', 'stripe_customer_id',
  'ghostSyncedAt', 'ghostMemberId', 'ghostUuid', 'ghostMemberNote', 'ghostLabelsCsv',
  'companyName', 'company', 'linkedinUrl', 'linkedin', 'websiteUrl', 'website',
  'avatarUrl', 'profileImage', 'bio',
];

type Group = {
  emailLower: string;
  rows: MemberProfile[];
};

async function main() {
  const mode = APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)';
  console.log(`dedupe-pg-match-ghost start | mode=${mode} | operator=${OPERATOR}`);

  const ghostMembers = await getAllGhostMembers();
  const ghostEmailsLower = new Set<string>(
    ghostMembers.map((gm) => normalizeEmail(gm.email)).filter(Boolean),
  );
  console.log(`ghost_members_total=${ghostMembers.length} | uniqueEmails=${ghostEmailsLower.size}`);

  const store = getMemberStore();
  const allPg = await store.getAllAdmin();
  console.log(`pg_members_total_all_visibility=${allPg.length}`);

  const preCounts = allPg.reduce<{ visible: number; invisible: number }>(
    (acc, m) => {
      if (m.visibility === 'invisible') acc.invisible++;
      else acc.visible++;
      return acc;
    },
    { visible: 0, invisible: 0 },
  );
  console.log(`pre PG visibility: { visible: ${preCounts.visible}, invisible: ${preCounts.invisible} }`);

  const groupsMap = new Map<string, MemberProfile[]>();
  for (const row of allPg) {
    if (row.visibility !== 'visible') continue;
    const eml = matchEmailFromRow(row);
    if (!eml || !ghostEmailsLower.has(eml)) continue;
    if (!groupsMap.has(eml)) groupsMap.set(eml, []);
    groupsMap.get(eml)!.push(row);
  }

  const groups: Group[] = Array.from(groupsMap.entries()).map(([emailLower, rows]) => ({ emailLower, rows }));
  const singleton = groups.filter((g) => g.rows.length === 1).length;
  const doubles = groups.filter((g) => g.rows.length === 2).length;
  const triplesPlus = groups.filter((g) => g.rows.length >= 3).length;
  const totalLosersProjected = groups.reduce((n, g) => n + Math.max(0, g.rows.length - 1), 0);
  console.log(`groups_total=${groups.length} (should == unique Ghost emails = ${ghostEmailsLower.size})`);
  console.log(`  singletons (1 row, keep): ${singleton}`);
  console.log(`  doubles (2 rows, 1 loser): ${doubles}`);
  console.log(`  >=3 rows (N-1 losers) : ${triplesPlus}`);
  console.log(`  projected losers to hide = ${totalLosersProjected} (post-dedupe visible = ${preCounts.visible - totalLosersProjected})`);

  const plan: Array<{
    emailLower: string;
    winnerClerkId: string;
    winnerScore: number;
    loserClerkIds: string[];
    loserScores: number[];
    mergePatch: Record<string, unknown> | null;
  }> = [];
  const allLoserIds: string[] = [];
  let mergePatchesNonEmpty = 0;
  const groupsForLog: Array<{ emailLower: string; winner: unknown; losers: unknown[]; mergePatch: Record<string, unknown> | null }> = [];

  for (const g of groups) {
    const scored = g.rows
      .map((r) => ({ r, score: scoreCandidate(r) }))
      .sort((a, b) => b.score - a.score);
    const winner = scored[0];
    const losers = scored.slice(1);
    const loserIds = losers.map((x) => String((x.r as any).clerkId || (x.r as any).clerk_id || '')).filter(Boolean);
    allLoserIds.push(...loserIds);

    const mergePatch: Record<string, unknown> = {};
    const winnerAny = winner.r as any;

    const arrayUnions: Record<string, Set<unknown>> = {};

    for (const field of FIELDS_TO_CARRY) {
      if (mergePatch[field] !== undefined) continue;
      if (winnerAny[field] !== undefined && winnerAny[field] !== null && winnerAny[field] !== '') continue;
      for (const x of losers) {
        const v = (x.r as any)[field];
        if (v === undefined || v === null || v === '') continue;
        if (Array.isArray(v)) {
          if (!arrayUnions[field]) arrayUnions[field] = new Set<unknown>();
          for (const item of v) arrayUnions[field].add(typeof item === 'object' ? JSON.stringify(item) : item);
          continue;
        }
        mergePatch[field] = v;
        break;
      }
    }
    for (const [f, s] of Object.entries(arrayUnions)) {
      const winnerArr = Array.isArray(winnerAny[f]) ? winnerAny[f].map((x: any) => typeof x === 'object' ? JSON.stringify(x) : x) : [];
      const combined = Array.from(new Set<unknown>([...winnerArr, ...Array.from(s)]));
      const restored = combined.map((x) => {
        if (typeof x === 'string' && (x.startsWith('{') || x.startsWith('['))) {
          try { return JSON.parse(x); } catch { /* noop */ }
        }
        return x;
      });
      if (restored.length > winnerArr.length) mergePatch[f] = restored;
    }

    const bestTierNow = winnerAny.membershipTier;
    let bestTier = bestTierNow;
    for (const x of losers) {
      const t = (x.r as any).membershipTier;
      if (tierRank(t) > tierRank(bestTier)) bestTier = t;
    }
    if (bestTier && bestTier !== bestTierNow) mergePatch.membershipTier = bestTier;

    const patchNonEmpty = Object.keys(mergePatch).length > 0;
    if (patchNonEmpty) mergePatchesNonEmpty++;

    plan.push({
      emailLower: g.emailLower,
      winnerClerkId: String((winner.r as any).clerkId || (winner.r as any).clerk_id || ''),
      winnerScore: winner.score,
      loserClerkIds: loserIds,
      loserScores: losers.map((x) => x.score),
      mergePatch: patchNonEmpty ? mergePatch : null,
    });
    groupsForLog.push({
      emailLower: g.emailLower,
      winner: { clerkId: plan[plan.length - 1].winnerClerkId, score: winner.score },
      losers: losers.map((x) => ({ clerkId: String((x.r as any).clerkId || (x.r as any).clerk_id || ''), score: x.score })),
      mergePatch: patchNonEmpty ? mergePatch : null,
    });
  }

  console.log(`merge_patches_would_apply=${mergePatchesNonEmpty} (out of ${groups.length} groups)`);
  console.log(`sample 5 groups:`);
  for (const item of groupsForLog.slice(0, 5)) {
    console.log(`  ${item.emailLower} winner=${(item.winner as any).clerkId}(${((item.winner as any).score as number).toFixed(2)}) losers=${(item.losers as any[]).map((l: any) => `${l.clerkId}(${l.score.toFixed(2)})`).join(',') || 'none'}${item.mergePatch ? ` merge=${Object.keys(item.mergePatch).length} keys` : ''}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = writeBackup(
    `dedupe-visibility-match-ghost-${APPLY ? 'apply' : 'dryrun'}-${stamp}.json`,
    { mode: APPLY ? 'apply' : 'dryrun', ghostMemberCount: ghostMembers.length, ghostUniqueEmails: ghostEmailsLower.size, preCounts, groups: groupsForLog, loserClerkIds: allLoserIds },
  );
  console.log(`backup written: ${backup}`);

  const sortedEmails = Array.from(ghostEmailsLower).sort();
  const sampleSize = Math.max(0, Math.min(sortedEmails.length, Math.ceil(sortedEmails.length * 0.10)));
  const sampleEmails = sortedEmails.filter((e) => fnv1a32(e) % 100 < 10).slice(0, sampleSize);
  console.log(`\nspot check 10% FNV-1a deterministic sample size=${sampleEmails.length}`);

  if (!APPLY) {
    console.log('\nDRY-RUN only. To commit changes re-run with: --apply');
    console.log(`  projected losers visibility hide count=${totalLosersProjected}`);
    console.log(`  projected post-apply visible=${preCounts.visible - totalLosersProjected} (target=${ghostEmailsLower.size}) invisible=${preCounts.invisible + totalLosersProjected}`);
    for (const eml of sampleEmails) {
      const grp = groups.find((g) => g.emailLower === eml);
      const want = 1;
      const gotProjected = grp ? 1 : 0;
      console.log(`  [PROJECT ${gotProjected === want ? 'PASS' : 'FAIL'}] ${eml} (projected ${gotProjected}/${want} visible post-dedupe, group size=${grp?.rows.length ?? 0})`);
    }
    try { await closeMagazinePgPool(); } catch { /* noop */ }
    return;
  }

  console.log('\nAPPLY mode: patching winners with missing fields from losers then hiding losers visibility=invisible...');

  let patchesApplied = 0;
  for (const p of plan) {
    if (!p.mergePatch || Object.keys(p.mergePatch).length === 0) continue;
    try {
      await store.patch(p.winnerClerkId, p.mergePatch);
      patchesApplied++;
    } catch (err) {
      console.warn(`  patch failed winner=${p.winnerClerkId} (${p.emailLower}) keys=${Object.keys(p.mergePatch).join(',')}:`, err);
    }
  }
  console.log(`merge patches applied to winners: ${patchesApplied}/${mergePatchesNonEmpty}`);

  const visResult = allLoserIds.length > 0
    ? await store.setClerkIdsVisibility(allLoserIds, 'invisible', OPERATOR)
    : { updatedRows: 0, changedRows: 0, auditLogIds: [] };
  const firstLast = visResult.auditLogIds.length > 0
    ? ` ${visResult.auditLogIds[0]} ${visResult.auditLogIds[visResult.auditLogIds.length - 1]}`
    : ' (none)';
  console.log(`setClerkIdsVisibility done | rows_touched=${visResult.updatedRows} | actually_changed=${visResult.changedRows} | audit_ids_written=${visResult.auditLogIds.length}`);
  console.log(`  audit_log_id_first_last=${firstLast}`);

  const afterPg = await store.getAllAdmin();
  const postCounts = afterPg.reduce<{ visible: number; invisible: number }>(
    (acc, m) => {
      if (m.visibility === 'invisible') acc.invisible++;
      else acc.visible++;
      return acc;
    },
    { visible: 0, invisible: 0 },
  );
  console.log(`post-apply PG visibility: { visible: ${postCounts.visible}, invisible: ${postCounts.invisible} }`);
  if (postCounts.visible === ghostEmailsLower.size) {
    console.log(`  ✓ visible count EXACTLY MATCHES Ghost unique (${ghostEmailsLower.size})`);
  } else {
    console.log(`  ⚠ visible count=${postCounts.visible} GHOST_TARGET=${ghostEmailsLower.size} (diff=${postCounts.visible - ghostEmailsLower.size})`);
  }

  let spotPass = 0;
  let spotFail = 0;
  for (const eml of sampleEmails) {
    const got = afterPg.filter((m) => m.visibility === 'visible' && matchEmailFromRow(m) === eml).length;
    const want = 1;
    if (got === want) spotPass++;
    else spotFail++;
    console.log(`  [${got === want ? 'PASS' : 'FAIL'}] ${eml} visible=${got} want=${want}`);
  }
  console.log(`\nSPOT CHECK FINAL: PASS=${spotPass} FAIL=${spotFail}`);

  try { await closeMagazinePgPool(); } catch { /* noop */ }
  if (spotFail > 0 || postCounts.visible !== ghostEmailsLower.size) process.exit(1);
  process.exit(0);
}

main().catch(async (err) => {
  console.error('dedupe-pg-match-ghost failed:', err);
  try { await closeMagazinePgPool(); } catch { /* noop */ }
  process.exit(1);
});
