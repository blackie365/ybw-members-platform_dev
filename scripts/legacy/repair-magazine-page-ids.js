/**
 * Repair magazine page sort-order `id` corruption.
 *
 * Root cause (fixed in src/app/actions/magazine/page-actions.ts
 * updateMagazinePageAction): every plain content-only page save called
 * updateMagazinePageAction(issueId, pageId, { content }) with no `id`
 * field. The action defaulted missing `id` to 0, and because
 * MagazinePageSchema requires `id`, that 0 was always present in the
 * Firestore merge payload — silently overwriting the page's real
 * sort-order id (used everywhere via `.orderBy('id', 'asc')`) on every
 * single content save.
 *
 * This script repairs already-corrupted data: for every
 * magazine_issues/{issueId}/pages/{pageId} doc where `id` does not match
 * the (reliably-maintained-by-reorder-logic) `position` field, it sets
 * `id = position`. It also reports any issue where two pages now share the
 * same `position` (a sign of a genuine duplicate spread needing manual
 * review — this script does NOT delete/merge content automatically).
 *
 * Safe to re-run: no-ops once id === position everywhere.
 */

require('dotenv')?.config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

try {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Loaded credentials from serviceAccountKey.json');
  } else {
    throw new Error('serviceAccountKey.json not found');
  }
} catch (e) {
  console.error('❌ Failed to initialize Firebase Admin:', e?.message);
  process.exit(1);
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function main() {
  const issuesSnap = await db.collection('magazine_issues').get();
  let totalFixed = 0;
  const duplicateWarnings = [];

  for (const issueDoc of issuesSnap.docs) {
    const issueId = issueDoc.id;
    const pagesSnap = await db.collection('magazine_issues').doc(issueId).collection('pages').get();
    if (pagesSnap.empty) continue;

    const batch = db.batch();
    let fixedInIssue = 0;
    const positionCounts = new Map();

    for (const pageDoc of pagesSnap.docs) {
      const data = pageDoc.data();
      const position = typeof data.position === 'number' ? data.position : Number(data.position || 0);
      const currentId = typeof data.id === 'number' ? data.id : Number(data.id || 0);

      if (Number.isFinite(position) && position > 0) {
        positionCounts.set(position, (positionCounts.get(position) || 0) + 1);
        if (currentId !== position) {
          batch.update(pageDoc.ref, { id: position });
          fixedInIssue += 1;
        }
      }
    }

    if (fixedInIssue > 0) {
      await batch.commit();
      totalFixed += fixedInIssue;
      console.log(`✅ ${issueId}: repaired id field on ${fixedInIssue} page(s)`);
    }

    for (const [position, count] of positionCounts) {
      if (count > 1) {
        duplicateWarnings.push({ issueId, position, count });
      }
    }
  }

  console.log(`\n✨ Repair complete. Total pages fixed: ${totalFixed}`);
  if (duplicateWarnings.length > 0) {
    console.log('\n⚠️  Duplicate positions found (needs manual review, not auto-fixed):');
    for (const w of duplicateWarnings) {
      console.log(`   magazine_issues/${w.issueId}: position ${w.position} has ${w.count} pages`);
    }
  } else {
    console.log('No duplicate positions found.');
  }
}

main().catch((err) => {
  console.error('❌ Repair failed:', err);
  process.exit(1);
});
