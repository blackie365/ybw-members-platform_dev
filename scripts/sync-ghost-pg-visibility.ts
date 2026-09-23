import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: false });

const APPLY = process.argv.includes('--apply');
const OPERATOR = (process.env.GITHUB_ACTOR || 'maintenance-runner').slice(0, 48);

import GhostAdminAPI from '@tryghost/admin-api';
import { normalizeBaseUrl } from '@/lib/ghost';
import fs from 'node:fs';
import path from 'node:path';
import { getMemberStore, type MemberProfile, type GhostPriorityMemberInput } from '@/features/members/server';

type GhostMember = {
  id: string;
  uuid?: string;
  email?: string;
  name?: string;
  note?: string;
  subscribed_to_emails?: boolean;
  complimentary_plan?: boolean;
  stripe_customer_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  labels?: Array<{ id: string; name: string; slug?: string }>;
  tiers?: Array<{ id: string; name: string; slug?: string; monthly_price?: number; yearly_price?: number }>;
  status?: string;
  subscriptions?: Array<unknown>;
  avatar_image?: string;
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
    const resp: any = await admin.members.browse({
      page,
      limit,
      order: 'created_at DESC',
    });
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

function buildGhostPriorityPayload(gm: GhostMember): GhostPriorityMemberInput {
  const emailLower = normalizeEmail(gm.email);
  const name = String(gm.name || '').trim();
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(' ');
  const tierName = gm.tiers?.[0]?.name || null;
  const labelsCsv = (gm.labels || []).map((l) => l.name).filter(Boolean).join(',');
  const profile: Record<string, unknown> = {
    email: gm.email,
    emailLower,
    displayName: name || null,
    firstName: firstName || null,
    lastName: lastName || null,
    subscribedToEmails: gm.subscribed_to_emails === true,
    complimentaryPlan: gm.complimentary_plan === true,
    ghostMemberId: gm.id,
    ghostUuid: gm.uuid || null,
    ghostMemberNote: gm.note || null,
    ghostLabelsCsv: labelsCsv || null,
    stripeCustomerId: gm.stripe_customer_id || null,
    ghostCreatedAt: gm.created_at || null,
    ghostUpdatedAt: gm.updated_at || null,
    deletedAt: gm.deleted_at || null,
    membershipTier:
      tierName === 'Complimentary' ? 'comped' :
      tierName === 'Free' ? 'free' :
      tierName?.toLowerCase()?.includes('annual') ? 'paid_annual' :
      tierName?.toLowerCase()?.includes('month') ? 'paid_monthly' :
      (gm.status === 'paid' ? 'paid_monthly' : (gm.status || 'free')),
    status:
      gm.status === 'paid' ? 'active' :
      gm.status === 'comped' ? 'active' :
      gm.status || 'active',
    avatarUrl: gm.avatar_image || null,
  };
  return {
    emailLower,
    ghostMemberId: gm.id,
    profile,
    visibility: gm.deleted_at ? 'invisible' : 'visible',
  };
}

function hashDeterministic(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickSpotSample<T>(arr: T[], percent: number): T[] {
  if (!arr.length) return [];
  const n = Math.max(1, Math.min(arr.length, Math.ceil((arr.length * percent) / 100)));
  const sorted = [...arr].sort((a, b) => {
    const ka = JSON.stringify(a);
    const kb = JSON.stringify(b);
    return hashDeterministic(ka) - hashDeterministic(kb);
  });
  return sorted.slice(0, n);
}

async function main() {
  console.log(`ghost-pg-visibility-sync start | mode=${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'} | operator=${OPERATOR}`);
  const startedAt = new Date().toISOString();
  const ts = startedAt.replace(/[:.]/g, '-');

  const store = getMemberStore();
  const ghostMembers = await getAllGhostMembers();
  const ghostBackupPath = writeBackup(`ghost-members-snapshot-${ts}.json`, ghostMembers);
  console.log(`ghost_members_total=${ghostMembers.length} | backup=${ghostBackupPath}`);
  if (ghostMembers.length === 0) {
    console.error('FATAL: Ghost members list empty. Check GHOST_ADMIN_API_KEY in env.');
    process.exit(2);
  }

  const pgMembers: MemberProfile[] = await store.getAllAdmin();
  console.log(`pg_members_total_all_visibility=${pgMembers.length}`);

  const pgByEmailLower = new Map<string, MemberProfile[]>();
  for (const p of pgMembers) {
    const key = normalizeEmail((p.emailLower as string) || (p.email as string) || null);
    if (!key) continue;
    const arr = pgByEmailLower.get(key) || [];
    arr.push(p);
    pgByEmailLower.set(key, arr);
  }

  const ghostByEmailLower = new Map<string, GhostMember>();
  const ghostInternalDupes: { emailLower: string; ids: string[] }[] = [];
  for (const g of ghostMembers) {
    const key = normalizeEmail(g.email);
    if (!key) continue;
    const prev = ghostByEmailLower.get(key);
    if (prev) {
      const dup = ghostInternalDupes.find((d) => d.emailLower === key);
      if (dup) dup.ids.push(g.id);
      else ghostInternalDupes.push({ emailLower: key, ids: [prev.id, g.id] });
    } else {
      ghostByEmailLower.set(key, g);
    }
  }
  console.log(`ghost_unique_emails=${ghostByEmailLower.size} | ghost_internal_dupe_email_groups=${ghostInternalDupes.length}`);

  const pgAllEmailLowers = Array.from(pgByEmailLower.keys());
  const toHideEmails: string[] = [];
  for (const el of pgAllEmailLowers) {
    if (!ghostByEmailLower.has(el)) toHideEmails.push(el);
  }

  const matchingLowers: string[] = [];
  for (const el of pgAllEmailLowers) {
    if (ghostByEmailLower.has(el)) matchingLowers.push(el);
  }

  const newFromGhost: string[] = [];
  for (const el of ghostByEmailLower.keys()) {
    if (!pgByEmailLower.has(el)) newFromGhost.push(el);
  }

  const ghostMergePlans: { emailLower: string; pgExists: boolean; upsert: GhostPriorityMemberInput }[] = [];
  for (const [emailLower, gm] of ghostByEmailLower.entries()) {
    ghostMergePlans.push({ emailLower, pgExists: pgByEmailLower.has(emailLower), upsert: buildGhostPriorityPayload(gm) });
  }

  const spotBase = matchingLowers.length > 0 ? pickSpotSample(matchingLowers, 10) : [];
  const spotCheck: {
    emailLower: string;
    ghost: { id: string; name: string | null; stripeCustomerId: string | null; tier: string | null; status: string | null };
    pgRows: { clerkId: string; visibility: string; tier: string | null; displayName: string | null }[];
    ghost_preferred_fields_for_merge: Record<string, unknown>;
  }[] = [];
  for (const emailLower of spotBase) {
    const g = ghostByEmailLower.get(emailLower)!;
    const pRows = pgByEmailLower.get(emailLower) || [];
    const p = buildGhostPriorityPayload(g);
    spotCheck.push({
      emailLower,
      ghost: {
        id: g.id,
        name: g.name || null,
        stripeCustomerId: g.stripe_customer_id || null,
        tier: g.tiers?.[0]?.name || null,
        status: g.status || null,
      },
      pgRows: pRows.map((r) => ({
        clerkId: r.clerkId,
        visibility: (r.visibility as string) || 'visible',
        tier: (r.membershipTier as string) || null,
        displayName: (r.displayName as string) || null,
      })),
      ghost_preferred_fields_for_merge: p.profile,
    });
  }

  const plan = {
    startedAt,
    operator: OPERATOR,
    mode: APPLY ? 'apply' : 'dry_run',
    counts: {
      ghost_members_total: ghostMembers.length,
      ghost_unique_emails: ghostByEmailLower.size,
      ghost_internal_duplicate_email_groups: ghostInternalDupes.length,
      pg_rows_total_all_visibility: pgMembers.length,
      pg_emails_to_set_invisible: toHideEmails.length,
      matching_emails_both_sides: matchingLowers.length,
      new_rows_to_insert_from_ghost_not_in_pg: newFromGhost.length,
      ghost_rows_to_upsert_ghost_priority: ghostMergePlans.length,
    },
    pg_emails_to_set_invisible: toHideEmails.sort(),
    new_rows_from_ghost_not_in_pg: newFromGhost.sort(),
    ghost_internal_duplicate_emails: ghostInternalDupes,
    spot_check_10_percent_sample: spotCheck,
    backups: {
      ghost_members_snapshot: ghostBackupPath,
    },
  };

  const planPath = writeBackup(`ghost-pg-sync-plan-${ts}.json`, plan);
  console.log(`plan_written=${planPath}`);

  const invisibleBeforeCounts = {
    pg_visible_now: pgMembers.filter((m) => (m.visibility as string) !== 'invisible').length,
    pg_invisible_now: pgMembers.filter((m) => (m.visibility as string) === 'invisible').length,
  };

  console.log('PLAN SUMMARY');
  console.log('  ghost_total                :', plan.counts.ghost_members_total);
  console.log('  pg_rows_total_all          :', plan.counts.pg_rows_total_all_visibility);
  console.log('  pg_emails_invisible        :', plan.counts.pg_emails_to_set_invisible, '(PG emails NOT in Ghost → invisible)');
  console.log('  matching_emails            :', plan.counts.matching_emails_both_sides);
  console.log('  new_ghost_only_rows_insert :', plan.counts.new_rows_to_insert_from_ghost_not_in_pg);
  console.log('  spot_check_size_10pct      :', spotCheck.length, 'emails');
  console.log('  current PG visibility      :', invisibleBeforeCounts);

  if (!APPLY) {
    console.log('DRY-RUN complete. Re-run with --apply to write (visibility + Ghost-priority upserts + audit rows).');
    process.exit(0);
  }

  console.log('APPLY mode: writing visibility invisible for PG emails NOT in Ghost...');
  const visResult = await store.setEmailsVisibility(toHideEmails, 'invisible', OPERATOR);
  console.log(
    `setEmailsVisibility done | rows_touched=${visResult.updatedRows} | actually_changed=${visResult.changedRows} | audit_ids_written=${visResult.auditLogIds.length}`,
  );
  if (visResult.auditLogIds.length) console.log('  audit_log_id_range_first_last=', visResult.auditLogIds[0], visResult.auditLogIds[visResult.auditLogIds.length - 1]);

  console.log('APPLY mode: upserting ALL Ghost members into PG (Ghost-priority wins all conflicts)...');
  let upsertedCount = 0;
  let changedCount = 0;
  const auditLogIdsFromMerge: number[] = [];
  for (const planRow of ghostMergePlans) {
    const res = await store.upsertGhostPriority(planRow.upsert, OPERATOR);
    if (res.upsertedRow) upsertedCount++;
    if (res.changed) changedCount++;
    if (res.auditLogId) auditLogIdsFromMerge.push(res.auditLogId);
  }
  console.log(
    `upsertGhostPriority done | inserted_new=${upsertedCount} | rows_changed=${changedCount} | audit_ids_written=${auditLogIdsFromMerge.length}`,
  );
  if (auditLogIdsFromMerge.length) console.log('  audit_log_id_first_last=', auditLogIdsFromMerge[0], auditLogIdsFromMerge[auditLogIdsFromMerge.length - 1]);

  const pgAfter: MemberProfile[] = await store.getAllAdmin();
  const afterCounts = {
    visible: pgAfter.filter((m) => (m.visibility as string) !== 'invisible').length,
    invisible: pgAfter.filter((m) => (m.visibility as string) === 'invisible').length,
  };
  const countsJsonPath = writeBackup(`ghost-pg-sync-applied-${ts}.json`, {
    before: invisibleBeforeCounts,
    after: afterCounts,
    visibilityApply: visResult,
    upsertCounts: { inserted_new: upsertedCount, rows_changed: changedCount, audit_logs: auditLogIdsFromMerge.length },
    operator: OPERATOR,
    completedAt: new Date().toISOString(),
  });
  console.log('post-apply PG visibility:', afterCounts);
  console.log(`full apply_results_json=${countsJsonPath}`);

  console.log('\n--- 10% spot check post-verify (random deterministic sample of matched rows) ---');
  let pass = 0;
  let fail = 0;
  for (const sc of spotCheck) {
    const ghostId = sc.ghost.id;
    const afterRows = pgAfter.filter((m) => normalizeEmail((m.emailLower as string) || (m.email as string)) === sc.emailLower);
    const anyRowMatches = afterRows.some((r) => {
      const profileHasGhostId =
        (r as any).ghostMemberId === ghostId ||
        String((r as any).stripeCustomerId || '') === String(sc.ghost.stripeCustomerId || '');
      const visOk = sc.ghost_preferred_fields_for_merge.deletedAt
        ? (r.visibility as string) === 'invisible'
        : true;
      return profileHasGhostId && visOk;
    });
    if (anyRowMatches) {
      console.log(`PASS spot email=${sc.emailLower} ghost_id=${ghostId} post-verify OK`);
      pass++;
    } else {
      console.log(
        `FAIL spot email=${sc.emailLower} ghost_id=${ghostId} no PG row carries ghostMemberId/stripeCustomerId after apply`,
      );
      fail++;
    }
  }
  console.log(`\nSPOT CHECK FINAL: PASS=${pass} FAIL=${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('ghost-pg-visibility-sync FATAL:', err);
  process.exit(1);
});
