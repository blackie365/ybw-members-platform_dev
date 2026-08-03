/**
 * One-off: find duplicate member docs in newMemberCollection (same email,
 * case-insensitive) and merge them into a single primary doc.
 *
 * Usage:
 *   npx tsx scripts/dedupe-members.ts            # dry-run: report only
 *   npx tsx scripts/dedupe-members.ts --apply    # merge + delete duplicates
 *
 * In --apply mode a backup JSON of every affected doc is written to
 * scripts/backups/dedupe-<timestamp>.json before any changes.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';

const COLLECTION = 'newMemberCollection';
const BATCH = 500;
const APPLY = process.argv.includes('--apply');

const PAID_RANK: Record<string, number> = {
  free: 0,
  comped: 1,
  paid_monthly: 2,
  paid_annual: 3,
};

async function fetchAllDocs(db: NonNullable<typeof adminDb>) {
  const docs: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }> = [];
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection(COLLECTION).orderBy('__name__').limit(BATCH);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      docs.push({ ref: d.ref, data: d.data() || {} });
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH) break;
  }
  return docs;
}

function emailKey(data: Record<string, any>): string | null {
  const raw = typeof data.email === 'string' ? data.email : typeof data.emailLower === 'string' ? data.emailLower : null;
  return raw ? raw.trim().toLowerCase() : null;
}

function isNewsletterDocId(id: string): boolean {
  return id.startsWith('newsletter_');
}

function scoreDoc(id: string, data: Record<string, any>): number {
  let score = 0;
  // Clerk-keyed docs (auth & server actions look up doc(clerkUserId)) must win.
  if (id.startsWith('user_')) score += 2000;
  else if (!isNewsletterDocId(id)) score += 1000; // legacy member doc
  score += (PAID_RANK[data.membershipTier as string] ?? 0) * 100;
  if (data.isNewsletterRecipient === true) score += 10;
  if (data.ghostSyncedAt) score += 5;
  if (data.stripeCustomerId || data.subscriptionId) score += 50;
  score += Object.keys(data).length;
  return score;
}

function pickPrimary(group: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }>) {
  return group.reduce((best, cur) => (scoreDoc(cur.ref.id, cur.data) > scoreDoc(best.ref.id, best.data) ? cur : best));
}

function mergeInto(primary: Record<string, any>, secondary: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...primary };
  const merges: Record<string, any> = {};

  const trueWins = [
    'isNewsletterRecipient',
    'isNewsletterAuthorized',
    'newsletterSubscribed',
    'userInactive',
    'isAdmin',
    'isFeatured',
  ];
  for (const f of trueWins) {
    if (secondary[f] === true && out[f] !== true) merges[f] = true;
  }

  if (Array.isArray(secondary.newsletterListLabels)) {
    const combined = new Set<string>([
      ...(Array.isArray(out.newsletterListLabels) ? out.newsletterListLabels : []),
      ...(secondary.newsletterListLabels as string[]),
    ]);
    if (combined.size > 0) merges.newsletterListLabels = Array.from(combined);
  }

  const primaryTier = PAID_RANK[out.membershipTier as string] ?? 0;
  const secondaryTier = PAID_RANK[secondary.membershipTier as string] ?? 0;
  if (secondaryTier > primaryTier) merges.membershipTier = secondary.membershipTier;

  if (secondary.status === 'active' && out.status !== 'active') merges.status = 'active';

  const createdA = Date.parse(out.createdAt as string) || Infinity;
  const createdB = Date.parse(secondary.createdAt as string) || Infinity;
  if (createdB < createdA) merges.createdAt = secondary.createdAt;

  const updatedA = Date.parse(out.updatedAt as string) || 0;
  const updatedB = Date.parse(secondary.updatedAt as string) || 0;
  if (updatedB > updatedA) merges.updatedAt = secondary.updatedAt;

  // Fill any gaps with the secondary's values (skip plain objects/timestamps).
  for (const [k, v] of Object.entries(secondary)) {
    if (v === undefined) continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) continue;
    if (out[k] === undefined) merges[k] = v;
  }

  return { ...out, ...merges };
}

async function main() {
  // Dynamic import so the .env.local values are loaded before firebase-admin
  // initializes (static imports are hoisted and would run too early).
  const { adminDb } = await import('../src/lib/firebase-admin');

  if (!adminDb) {
    console.error('Firestore Admin SDK not initialized — check FIREBASE_* env vars in .env.local');
    process.exit(1);
  }

  console.log(`Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);
  const docs = await fetchAllDocs(adminDb);
  console.log(`Scanned ${docs.length} docs in ${COLLECTION}`);

  const byEmail = new Map<string, Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }>>();
  for (const doc of docs) {
    const key = emailKey(doc.data);
    if (!key) continue;
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(doc);
  }

  const groups = Array.from(byEmail.entries()).filter(([, group]) => group.length > 1);
  console.log(`Found ${groups.length} email(s) with duplicate docs\n`);

  if (groups.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const backup: Record<string, Record<string, any>> = {};
  let toDelete = 0;

  for (const [email, group] of groups) {
    const primary = pickPrimary(group);
    const secondaries = group.filter((d) => d.ref.id !== primary.ref.id);

    console.log(`Email: ${email}`);
    console.log(`  keep   ${primary.ref.id}  (tier=${primary.data.membershipTier ?? '-'}, updatedAt=${primary.data.updatedAt ?? '-'})`);
    for (const d of secondaries) {
      console.log(`  delete ${d.ref.id}  (tier=${d.data.membershipTier ?? '-'}, updatedAt=${d.data.updatedAt ?? '-'})`);
    }

    if (APPLY) {
      const merged = secondaries.reduce((acc, d) => mergeInto(acc, d.data), { ...primary.data });
      const batch = adminDb.batch();
      batch.set(primary.ref, merged, { merge: true });
      for (const d of secondaries) batch.delete(d.ref);
      backup[primary.ref.id] = primary.data;
      for (const d of secondaries) backup[d.ref.id] = d.data;
      await batch.commit();
      toDelete += secondaries.length;
    }
  }

  if (APPLY) {
    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `dedupe-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), docs: backup }, null, 2));
    console.log(`\nDeleted ${toDelete} duplicate doc(s). Backup written to ${file}`);
    console.log('\nVerify, then re-run to confirm no duplicates remain.');
  } else {
    console.log(`\nDry-run complete. Re-run with --apply to merge and delete ${groups.reduce((n, [, g]) => n + g.length - 1, 0)} duplicate doc(s).`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
