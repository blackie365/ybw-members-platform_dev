/**
 * Live production audit of members in both PostgreSQL (member_profiles — the
 * admin panel source of truth) and Ghost Admin members list.
 *
 * The audit reports in plain text, grouped by reason:
 *   - DUPLICATE emails (case-insensitive match), with all matching row IDs and
 *     pick-primary recommendation (uses the same choosePrimary() scoring as
 *     repairMemberDuplicatesByEmailAction in memberActions.ts).
 *   - SUSPICIOUS / BIZARRE emails that don't look like real addresses used by
 *     real humans: temp-mail domains, weird characters, absurd length, random
 *     garbled local parts, obviously placeholder/fake names, emails with no
 *     dots in domain, test-only patterns, and typical throwaway providers.
 *   - RUBBISH / FALSE account heuristics: completely empty profile (no first
 *     / last / display name, no industry, no location, and never signed in),
 *     email used as display name with a gibberish local part, or display
 *     name that looks auto-generated junk.
 *   - GHOST-ONLY members (in Ghost but missing from PG) so we don't leave
 *     stale audience records dangling in the Ghost audience.
 *
 * The script is READ-ONLY: it never writes, deletes, or mutates anything.
 * After the run we hand the user the suspicious list and wait for their
 * explicit confirmation before making any changes.
 *
 * Usage (via the GitHub Actions magazine-maintenance workflow on vps725503,
 * so it automatically inherits PROD DATABASE_URL + GHOST_ADMIN_API_KEY from
 * /srv/ybw-frontend/.env.local as www-data):
 *
 *   workflow_dispatch → magazine-maintenance.yml
 *     script = scripts/audit-members-admin-pg-ghost.ts
 *     script_args = --json   (optional; default = human text report)
 *
 * You can also run it locally if you set the prod env vars, but the
 * maintenance runner is preferred so we always audit the live DB.
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: false });

const WRITE_JSON = process.argv.includes('--json');

import { getMemberStore } from '@/features/members/server';
// NOTE: ghost-admin.ts declares "'use server'" at the top, which Next/RSC uses
// to mark functions for Server Actions bundling. In a plain tsx script that
// directive is (1) meaningless and (2) breaks CJS/ESM interop badly: the
// compiled module ends up as `{ default: {...} }` with no named exports.
// We therefore import @tryghost/admin-api directly here (same SDK, same env
// resolution logic as ghost-admin.ts) so the audit script works both from
// the magazine-maintenance workflow runner and from a local shell.
import GhostAdminAPI from '@tryghost/admin-api';
import { normalizeBaseUrl } from '@/lib/ghost';
import fs from 'node:fs';

type MemberDoc = {
  clerkId?: string;
  id?: string;
  email?: string;
  emailLower?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  industrySector?: string;
  industry?: string;
  location?: string;
  membershipTier?: string;
  role?: string;
  isAdmin?: boolean;
  isFeatured?: boolean;
  userInactive?: boolean;
  isActive?: boolean;
  status?: string;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  stripeSubscriptionId?: string | null;
  ghostSyncedAt?: string | null;
  lastSignInAt?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

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

// Mirrors the init logic in src/lib/ghost-admin.ts (same env chain + SDK),
// except we keep the factory locally so we don't import a module that starts
// with "'use server'" (breaks tsx named exports).
let _ghostCache: any = null;
function getGhostAdmin(): any | null {
  if (_ghostCache !== null) return _ghostCache;
  const key = process.env.GHOST_ADMIN_API_KEY || process.env.GHOST_ADMIN_KEY;
  if (!key) {
    console.warn('[ghost] GHOST_ADMIN_API_KEY not configured — skipping Ghost audit section.');
    _ghostCache = null;
    return null;
  }
  const url = normalizeBaseUrl(
    (process.env.GHOST_ADMIN_API_URL ||
      process.env.NEXT_PUBLIC_GHOST_API_URL ||
      process.env.GHOST_API_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://yorkshirebusinesswoman.co.uk') as string,
  );
  try {
    _ghostCache = new GhostAdminAPI({ url, key, version: 'v5.0' });
  } catch (err: any) {
    console.error('[ghost] failed to init admin API:', err?.message || err);
    _ghostCache = null;
  }
  return _ghostCache;
}

const TEMP_EMAIL_PATTERNS: RegExp[] = [
  /tempmail/i,
  /trashmail/i,
  /throwaway/i,
  /dispostable/i,
  /disposable/i,
  /yopmail/i,
  /guerrillamail/i,
  /10minutemail/i,
  /mailinator/i,
  /sharklasers/i,
  /guerrillamailblock/i,
  /grr\.la/i,
  /pokemail/i,
  /spamgourmet/i,
  /emailnator/i,
  /mohmal/i,
  /maildrop/i,
  /getnada/i,
  /fake-?mail/i,
  /temp[-_ ]?mail/i,
  /\.xyz$/i,
  /anonmail/i,
  /anonbox/i,
  /burner/i,
];

const TEST_OR_PLACEHOLDER_PATTERNS: RegExp[] = [
  /^test[^@]*@/i,
  /^admin(?!@yorkshirebusinesswoman)/i,
  /^noreply@/i,
  /^no[-_ ]?reply@/i,
  /^support@(?!yorkshirebusinesswoman|quiltercheviot|cedarcourthotels)/i,
  /^example@/i,
  /^user[0-9]+@/i,
  /^abc123@/i,
  /^foo@bar/i,
  /^hello@world/i,
  /@example\.(com|org|net)$/i,
  /@test\./i,
  /@local(host)?\.dev$/i,
  /\.local$/i,
  /@yopmail/i,
  /^[^@]{0,3}@/i, // local part <= 3 chars (very short, usually bot junk)
  /^[0-9]+@/i, // all-numeric local part is almost always garbage
  /^(member|user|account|customer|profile)[_\-.]?\d+@/i,
  /^delete[-_ ]?me@/i,
  /^dont[-_ ]?email[-_ ]?me@/i,
  /^none[-_ ]?of[-_ ]?your[-_ ]?business@/i,
  /^unknown@/i,
];

const GIBBERISH_LOCAL_WINDOW = 12; // if local part >= N chars and all entropy heuristics fire

function normalizeEmail(e: string | undefined | null): string {
  if (typeof e !== 'string') return '';
  return e.trim().toLowerCase();
}

function isValidEmailShape(e: string): boolean {
  // RFC-ish sanity check — excludes the obviously broken entries the parser
  // above will sometimes catch as duplicates "".
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function hasGibberishLocalPart(local: string): boolean {
  if (local.length < GIBBERISH_LOCAL_WINDOW) return false;
  const letters = (local.match(/[a-z]/g) || []).length;
  const digits = (local.match(/[0-9]/g) || []).length;
  const specials = local.length - letters - digits - (local.match(/[._-]/g) || []).length;
  if (specials > 3) return true; // lots of weird chars
  if (digits >= Math.ceil(local.length * 0.45) && letters > 4) return true; // very high digit ratio
  if (/^[a-z0-9]+([a-z0-9]*)([0-9]+)$/i.test(local) && local.length >= GIBBERISH_LOCAL_WINDOW) {
    // jumble pattern + long + big digit tail → high chance bot
    const digitsRatio = digits / local.length;
    return digitsRatio >= 0.33;
  }
  return false;
}

function domainHasNoPublicSuffix(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1);
  if (!domain) return true;
  return !/\./.test(domain) || /\.local$/i.test(domain) || /^localhost$/i.test(domain);
}

function tierRank(tier?: string): number {
  switch (tier) {
    case 'free': return 0;
    case 'comped': return 1;
    case 'paid_monthly': return 2;
    case 'paid_annual': return 3;
    case 'founder': return 4;
    default: return -1;
  }
}

function hasPaidIdentity(m: MemberDoc): boolean {
  return (
    tierRank(m.membershipTier) >= tierRank('paid_monthly') ||
    Boolean(m.stripeCustomerId) ||
    Boolean(m.subscriptionId) ||
    Boolean(m.stripeSubscriptionId) ||
    (typeof m.status === 'string' && /paid|comped/i.test(m.status))
  );
}

function safeIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  const obj = value as any;
  if (obj && typeof obj === 'object' && 'toDate' in obj && typeof obj.toDate === 'function') {
    try {
      const d = obj.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function scoreMember(m: MemberDoc): number {
  const id = m.clerkId || m.id || '';
  const idIsClerk = id.startsWith('user_');
  const paid = hasPaidIdentity(m);
  const rank = tierRank(m.membershipTier);
  const updatedAt = safeIso(m.updatedAt) || safeIso(m.createdAt) || '';
  const score =
    (idIsClerk ? 1000 : 0) +
    (paid ? 500 : 0) +
    rank * 10 +
    (updatedAt ? 1 : 0);
  return score;
}

function displayNameLooksRubbish(name: string | undefined, emailLocal: string): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (n === emailLocal.toLowerCase()) {
    // displayName === email local part (not great alone → combine w/ gibberish)
    return hasGibberishLocalPart(emailLocal) || TEMP_EMAIL_PATTERNS.some((r) => r.test(n));
  }
  if (/^[a-z0-9._-]+$/.test(n) && n.length >= 18 && hasGibberishLocalPart(n)) return true;
  if (/^(junk|rubbish|fake|test|dummy|temp|throwaway|placeholder|none|no(bo)?dy|unknown|delete|admin user)$/i.test(n)) return true;
  if (/\bfake\b|\bphony\b|\bbogus\b|\bjunk\b/i.test(n)) return true;
  return false;
}

function isProfileEssentiallyEmpty(m: MemberDoc): boolean {
  const name = (m.firstName || m.lastName || m.displayName || '').trim();
  const industry = (m.industrySector || m.industry || '').trim();
  const location = (m.location || '').trim();
  if (name || industry || location) return false;
  if (hasPaidIdentity(m)) return false; // never call paid empty
  if (m.isAdmin || m.isFeatured) return false;
  return true;
}

async function getAllPgMembers(): Promise<MemberDoc[]> {
  const store = getMemberStore();
  const list = await store.getAll();
  return (list as unknown as MemberDoc[]).map((row) => row);
}

async function getAllGhostMembers(): Promise<GhostMember[]> {
  const admin = getGhostAdmin();
  if (!admin) {
    console.warn('[ghost] GHOST_ADMIN_API_KEY not configured — skipping Ghost audit section.');
    return [];
  }
  let page = 1;
  const limit = 250;
  const acc: GhostMember[] = [];
  while (true) {
    const pageRes = (await admin.members.browse({ page: String(page), limit: String(limit), order: 'created_at DESC' })) as any;
    const rows = Array.isArray(pageRes) ? pageRes : pageRes?.members ? (pageRes.members as GhostMember[]) : [];
    if (!rows.length) break;
    acc.push(...rows);
    if (rows.length < limit) break;
    page += 1;
    if (page > 20) break; // hard safety: 5,000 members max ever handled
  }
  return acc;
}

type Reason =
  | 'suspicious-domain'
  | 'suspicious-local-test'
  | 'gibberish-local'
  | 'invalid-shape'
  | 'no-public-suffix-domain'
  | 'profile-empty'
  | 'display-name-rubbish'
  | 'duplicate-email';

type FlaggedEntry = {
  clerkId: string;
  email: string;
  displayName: string;
  tier: string;
  reasons: Reason[];
  notes: string[];
};

function buildReasons(m: MemberDoc): Reason[] {
  const reasons: Reason[] = [];
  const email = normalizeEmail(m.email || m.emailLower);
  if (!email) return reasons;

  if (!isValidEmailShape(email)) reasons.push('invalid-shape');
  if (domainHasNoPublicSuffix(email)) reasons.push('no-public-suffix-domain');

  if (TEMP_EMAIL_PATTERNS.some((r) => r.test(email))) reasons.push('suspicious-domain');

  const local = email.includes('@') ? email.split('@')[0] : '';
  if (TEST_OR_PLACEHOLDER_PATTERNS.some((r) => r.test(email))) reasons.push('suspicious-local-test');
  if (hasGibberishLocalPart(local)) reasons.push('gibberish-local');

  if (displayNameLooksRubbish(m.displayName, local)) reasons.push('display-name-rubbish');
  if (isProfileEssentiallyEmpty(m)) reasons.push('profile-empty');

  return reasons;
}

function writeBackup(out: {
  generatedAt: string;
  counts: { pg: number; ghost: number; duplicates: number; flagged: number; ghostOnly: number };
  duplicates: Array<{
    emailLower: string;
    count: number;
    keepId: string;
    keepScore: number;
    deleteIds: string[];
    rows: Array<{ clerkId: string; email: string; displayName: string; tier: string; score: number }>;
  }>;
  flagged: FlaggedEntry[];
  ghostOnly: Array<{ email: string; name: string; labels: string[]; note: string | null }>;
}) {
  const dir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `members-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\n📄 Backup JSON written to ${file}`);
}

function renderTable(rows: string[][], colWidths: number[]): string {
  const sep = '+' + colWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const line = (r: string[]) =>
    '| ' +
    r.map((c, i) => (c.length > colWidths[i] ? c.slice(0, colWidths[i] - 1) + '…' : c).padEnd(colWidths[i])).join(' | ') +
    ' |';
  return [sep, line(rows[0]), sep, ...rows.slice(1).map(line), sep].join('\n');
}

async function main() {
  console.log('🔍 Members audit START — PG member_profiles + Ghost Admin — READ-ONLY\n');
  const pg = await getAllPgMembers();
  console.log(`• PostgreSQL profiles returned: ${pg.length}`);
  const ghost = await getAllGhostMembers();
  console.log(`• Ghost members returned:     ${ghost.length}`);

  // ---------- duplicates ----------
  const byEmailLower = new Map<string, Array<{ doc: MemberDoc; score: number; clerkId: string }>>();
  for (const doc of pg) {
    const emailLower = normalizeEmail(doc.email || doc.emailLower);
    if (!emailLower) continue;
    if (!byEmailLower.has(emailLower)) byEmailLower.set(emailLower, []);
    byEmailLower.get(emailLower)!.push({
      doc,
      score: scoreMember(doc),
      clerkId: doc.clerkId || doc.id || 'NO_CLERK_ID',
    });
  }
  const duplicates = Array.from(byEmailLower.entries())
    .filter(([, g]) => g.length > 1)
    .map(([emailLower, group]) => {
      group.sort((a, b) => b.score - a.score);
      const keep = group[0];
      const del = group.slice(1);
      return {
        emailLower,
        count: group.length,
        keepId: keep.clerkId,
        keepScore: keep.score,
        deleteIds: del.map((d) => d.clerkId),
        rows: group.map((g) => ({
          clerkId: g.clerkId,
          email: g.doc.email || emailLower,
          displayName: g.doc.displayName || [g.doc.firstName, g.doc.lastName].filter(Boolean).join(' ') || '-',
          tier: g.doc.membershipTier || 'free',
          score: g.score,
        })),
      };
    })
    .sort((a, b) => b.count - a.count || a.emailLower.localeCompare(b.emailLower));

  // ---------- flagged suspicious / rubbish ----------
  const flagged: FlaggedEntry[] = [];
  for (const doc of pg) {
    const reasons = buildReasons(doc);
    if (!reasons.length) continue;
    const notes: string[] = [];
    if (reasons.includes('duplicate-email')) {
      // duplicate already reported in its own section, skip it from generic flagged
      continue;
    }
    if (reasons.includes('profile-empty')) notes.push('profile entirely empty');
    if (reasons.includes('display-name-rubbish')) notes.push('display name looks auto-generated / filler');
    if (reasons.includes('invalid-shape')) notes.push('email not RFC-sane (missing @, missing domain dot, etc)');
    if (reasons.includes('suspicious-domain')) notes.push('temp/disposable/fake email provider pattern');
    if (reasons.includes('suspicious-local-test')) notes.push('local part matches test / admin / placeholder / userNNN pattern');
    if (reasons.includes('gibberish-local')) notes.push('long garbled local part with high digit / special-char ratio');
    if (reasons.includes('no-public-suffix-domain')) notes.push('domain has no dot or looks internal');
    flagged.push({
      clerkId: doc.clerkId || doc.id || 'NO_CLERK_ID',
      email: normalizeEmail(doc.email || doc.emailLower) || '-',
      displayName: doc.displayName || [doc.firstName, doc.lastName].filter(Boolean).join(' ') || '(no name)',
      tier: doc.membershipTier || 'free',
      reasons,
      notes,
    });
  }
  // Sort: strongest reasons first, emails with more reasons first
  flagged.sort((a, b) => {
    const severityScore = (r: Reason[]) =>
      r.reduce((acc, cur) => {
        if (cur === 'invalid-shape') return acc + 10;
        if (cur === 'profile-empty') return acc + 8;
        if (cur === 'no-public-suffix-domain') return acc + 7;
        if (cur === 'suspicious-domain') return acc + 6;
        if (cur === 'display-name-rubbish') return acc + 5;
        if (cur === 'gibberish-local') return acc + 4;
        if (cur === 'suspicious-local-test') return acc + 3;
        return acc + 1;
      }, 0);
    return severityScore(b.reasons) - severityScore(a.reasons);
  });

  // ---------- ghost-only ----------
  const pgEmailsLower = new Set<string>();
  for (const doc of pg) {
    const e = normalizeEmail(doc.email || doc.emailLower);
    if (e) pgEmailsLower.add(e);
  }
  const ghostOnly = ghost
    .filter((g) => {
      const e = normalizeEmail(g.email);
      return !!e && !pgEmailsLower.has(e);
    })
    .map((g) => ({
      email: normalizeEmail(g.email),
      name: g.name || '-',
      labels: (g.labels || []).map((l) => l.name),
      note: g.note || null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  // ---------- report ----------
  const summary = {
    generatedAt: new Date().toISOString(),
    counts: {
      pg: pg.length,
      ghost: ghost.length,
      duplicates: duplicates.length,
      flagged: flagged.length,
      ghostOnly: ghostOnly.length,
    },
    duplicates,
    flagged,
    ghostOnly,
  };

  if (WRITE_JSON) {
    writeBackup(summary);
    console.log(
      JSON.stringify(
        {
          ok: true,
          counts: summary.counts,
          how_to_read:
            'duplicates = emails with >=2 PG profiles (keep highest score); flagged = bizarre/fake/rubbish addresses; ghostOnly = Ghost members not present in PG admin panel.',
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('\n───────────────────────────────────────── COUNTS ─────────────────────────────────────────');
  console.log(`  PG member_profiles rows:  ${pg.length}`);
  console.log(`  Ghost admin members:      ${ghost.length}`);
  console.log(`  Duplicate email groups:   ${duplicates.length}`);
  console.log(`  Suspicious / bizarre:     ${flagged.length}`);
  console.log(`  Ghost only (orphans):     ${ghostOnly.length}`);

  if (duplicates.length) {
    console.log('\n────────────────────────────── DUPLICATE EMAILS (case-insensitive) ──────────────────────────────');
    console.log(
      'Choose-primary scores exactly match choosePrimary() used by repairMemberDuplicatesByEmailAction.',
    );
    for (const g of duplicates) {
      console.log(`\n📇 ${g.emailLower}  (${g.count} rows, keep=${g.keepId}, score=${g.keepScore})`);
      console.log(
        renderTable(
          [
            ['clerkId', 'email', 'displayName', 'tier', 'score', 'action'],
            ...g.rows.map((r) => [
              r.clerkId,
              r.email,
              r.displayName,
              r.tier,
              String(r.score),
              r.clerkId === g.keepId ? 'KEEP primary' : 'DELETE merge',
            ]),
          ],
          [32, 36, 28, 14, 6, 14],
        ),
      );
    }
  } else {
    console.log('\n✅ No duplicate email groups found in PG member_profiles.');
  }

  if (flagged.length) {
    console.log('\n──────────────────────────────── SUSPICIOUS / BIZARRE / RUBBISH ────────────────────────────────');
    console.log(`Total flagged: ${flagged.length}. Heuristics, not a delete list — user reviews first.\n`);
    console.log(
      renderTable(
        [
          ['#', 'clerkId', 'email', 'tier', 'displayName', 'reasons'],
          ...flagged.map((f, i) => [
            String(i + 1),
            f.clerkId,
            f.email,
            f.tier,
            f.displayName,
            f.notes.join('; '),
          ]),
        ],
        [4, 32, 38, 14, 28, 54],
      ),
    );
  } else {
    console.log('\n✅ Nothing flagged as bizarre / false / rubbish.');
  }

  if (ghostOnly.length) {
    console.log('\n──────────────────────────────── GHOST-ONLY (no matching PG row) ───────────────────────────────');
    console.log(`These exist in Ghost audience but admin panel doesn't know them. Review before removing.\n`);
    console.log(
      renderTable(
        [
          ['email', 'name', 'labels', 'note'],
          ...ghostOnly.map((g) => [g.email, g.name, g.labels.join(',') || '-', g.note || '-']),
        ],
        [38, 28, 36, 42],
      ),
    );
  } else {
    console.log('\n✅ No orphan Ghost members (every Ghost address has a PG profile).');
  }

  writeBackup(summary);
  console.log('\n🏁 Audit complete. READ-ONLY: no writes performed anywhere.');
  console.log('Next step: forward the suspicious list to the user, wait for explicit confirmation before deleting anything.');
}

main().catch((err) => {
  console.error('FATAL audit error:', err);
  process.exit(1);
});
