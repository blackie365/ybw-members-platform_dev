process.env.NEXT_TELEMETRY_DISABLED = '1';

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const projectRoot = process.cwd();
for (const f of ['.env.local', '.env']) {
  const p = resolve(projectRoot, f);
  if (!existsSync(p)) continue;
  const lines = readFileSync(p, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let [, k, v] = m; v = v.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;

  if (privateKey) {
    if (privateKey.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(privateKey);
        if (parsed?.private_key) privateKey = parsed.private_key;
      } catch { /* ignore */ }
    }
    privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey.trim()}\n-----END PRIVATE KEY-----\n`;
    }
  }

  if (!privateKey || !clientEmail || !projectId) {
    console.error('❌ Missing FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL / FIREBASE_PROJECT_ID in env');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
    storageBucket,
  });
}

const dbIdRaw = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;
const dbId = typeof dbIdRaw === 'string' && dbIdRaw.trim() ? dbIdRaw.trim() : '(default)';
const adminDb = getFirestore(admin.app(), dbId);
try { adminDb.settings({ ignoreUndefinedProperties: true }); } catch { /* ignore */ }

const ISSUE_ID_TO_FIX = 'Ab5bOuKBbmDQBvtbyEIg';
const KEEP_JUNE_ID = 'reader-yorkshire-businesswoman-june-2026-edition';

interface ReaderEditionDoc {
  id: string;
  title?: string;
  slug?: string;
  issueId?: string;
  pageCount?: number;
  pages?: any[];
  publishDate?: any;
  coverImage?: string;
}

async function main() {
  if (!adminDb) {
    console.error('❌ Firebase Admin not initialized. Check .env.local variables.');
    process.exit(1);
  }

  console.log('\n📋 STEP 1: Listing ALL magazine_reader_editions documents...\n');
  const editionsSnap = await adminDb.collection('magazine_reader_editions').get();
  const editions: ReaderEditionDoc[] = editionsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  for (const e of editions) {
    const pageCount = Array.isArray(e.pages) ? e.pages.length : e.pageCount ?? 'N/A';
    const linkedIssue = e.issueId || '(not linked to issue)';
    console.log(`  📄 ID: ${e.id}`);
    console.log(`     Title: ${e.title || '(no title)'}`);
    console.log(`     Slug:  ${e.slug || '(no slug)'}`);
    console.log(`     Pages: ${pageCount}`);
    console.log(`     Issue: ${linkedIssue}`);
    console.log();
  }

  console.log(`\n🔍 STEP 2: Fetching magazine_issue/${ISSUE_ID_TO_FIX} (the live issue)...\n`);
  const issueSnap = await adminDb.collection('magazine_issues').doc(ISSUE_ID_TO_FIX).get();
  if (!issueSnap.exists) {
    console.error(`❌ Issue ${ISSUE_ID_TO_FIX} not found!`);
    process.exit(1);
  }
  const issueData = issueSnap.data() as any;
  console.log(`  📰 Issue title: ${issueData.title || '(no title)'}`);
  console.log(`     Current readerEditionId: ${issueData.readerEditionId || '(not set)'}`);
  console.log(`     readerEditionTitle:      ${issueData.readerEditionTitle || '(not set)'}`);
  console.log(`     readerEditionSlug:       ${issueData.readerEditionSlug || '(not set)'}`);
  console.log(`     readerEditionPageCount:  ${issueData.readerEditionPageCount ?? '(not set)'}`);
  console.log();

  // --- DECIDE WHAT TO KEEP ---
  // Strategy:
  //  - Keep the edition with the most pages for Aug/Sept 2026
  //  - Keep June 2026 edition as-is (historic)
  //  - Delete the other 2 duplicates for Aug/Sept
  //  - Update the live issue's readerEditionId to point to the kept one
  const juneEdition = editions.find((e) => e.id === KEEP_JUNE_ID);
  const augSeptEditions = editions.filter((e) => e.id !== KEEP_JUNE_ID);

  if (augSeptEditions.length === 0) {
    console.log('✅ No duplicate Aug/Sept editions found to clean up.');
    process.exit(0);
  }

  // Pick the one with the most pages as the canonical edition
  augSeptEditions.sort((a, b) => {
    const pa = Array.isArray(a.pages) ? a.pages.length : a.pageCount ?? 0;
    const pb = Array.isArray(b.pages) ? b.pages.length : b.pageCount ?? 0;
    return pb - pa;
  });

  const canonical = augSeptEditions[0];
  const toDelete = augSeptEditions.slice(1);

  const canonicalPages = Array.isArray(canonical.pages) ? canonical.pages.length : canonical.pageCount ?? 0;
  console.log(`\n🏆 STEP 3: Canonical edition chosen (most pages = ${canonicalPages}):`);
  console.log(`     ID:    ${canonical.id}`);
  console.log(`     Title: ${canonical.title || '(no title)'}`);
  console.log(`     Slug:  ${canonical.slug || '(no slug)'}`);
  console.log();

  console.log(`🗑️  Editions to DELETE (${toDelete.length}):`);
  for (const d of toDelete) {
    const p = Array.isArray(d.pages) ? d.pages.length : d.pageCount ?? '?';
    console.log(`     • ${d.id}  (${p} pages)  title="${d.title || '(no title)'}"`);
  }
  console.log();

  if (juneEdition) {
    console.log(`✅ Keeping June 2026 edition: ${juneEdition.id} (${Array.isArray(juneEdition.pages) ? juneEdition.pages.length : juneEdition.pageCount ?? '?'} pages)`);
  }

  // --- ENSURE CANONICAL HAS A CORRECT TITLE ---
  let correctedTitle = canonical.title;
  if (canonical.title && /ukreiif/i.test(canonical.title) && augSeptEditions.length > 1) {
    // If the "most pages" one actually has the UKREiiF wrong title, fall back to the edition
    // that has the correct YBW title in its name if available, else fix it
    const ybwTitled = augSeptEditions.find(
      (e) => e.title && /yorkshire|ybw|august|september/i.test(e.title) && !/ukreiif/i.test(e.title),
    );
    if (ybwTitled && canonicalPages === (Array.isArray(ybwTitled.pages) ? ybwTitled.pages.length : ybwTitled.pageCount ?? 0)) {
      console.log(`\n⚠️  Canonical has UKREiiF title but YBW-titled edition exists with same page count — switching canonical to YBW-titled.`);
      console.log(`     Switching from: ${canonical.id}  title="${canonical.title}"`);
      console.log(`     Switching to:   ${ybwTitled.id}  title="${ybwTitled.title}"`);
      toDelete.splice(toDelete.indexOf(ybwTitled), 1);
      toDelete.push(canonical);
      // @ts-ignore reassign
      canonical = ybwTitled;
      correctedTitle = ybwTitled.title;
    } else if (/ukreiif/i.test(canonical.title || '')) {
      // Fix the title in place if this is the only/winner edition but wrong title
      correctedTitle = 'Yorkshire BusinessWoman August / September 2026';
      console.log(`\n✏️  Fixing edition title (was UKREiiF single-article):`);
      console.log(`     OLD: "${canonical.title}"`);
      console.log(`     NEW: "${correctedTitle}"`);
    }
  }

  // If still no good title, set one
  if (!correctedTitle || /^idml-|ukreiif/i.test(correctedTitle)) {
    correctedTitle = 'Yorkshire BusinessWoman August / September 2026';
    console.log(`\n✏️  Setting canonical edition title to: "${correctedTitle}"`);
  }

  console.log(`\n🚀 STEP 4: Applying changes to Firestore...\n`);

  // 1. Update canonical edition (fix title if needed, ensure issueId set)
  const canonicalPatch: any = {
    title: correctedTitle,
    issueId: ISSUE_ID_TO_FIX,
    updatedAt: new Date().toISOString(),
  };
  if (!canonical.slug) {
    canonicalPatch.slug = 'ybw-august-september-2026';
  }
  await adminDb
    .collection('magazine_reader_editions')
    .doc(canonical.id)
    .set(canonicalPatch, { merge: true });
  console.log(`  ✅ Updated canonical edition: ${canonical.id}`);
  console.log(`     title → "${correctedTitle}"`);
  console.log(`     issueId → ${ISSUE_ID_TO_FIX}`);
  console.log();

  // 2. Update the live magazine_issue to link to canonical
  const issuePatch: any = {
    readerEditionId: canonical.id,
    readerEditionTitle: correctedTitle,
    readerEditionSlug: canonical.slug || canonicalPatch.slug,
    readerEditionPublished: true,
    readerEditionPublishDate: canonical.publishDate ?? new Date().toISOString(),
    readerEditionPageCount: canonicalPages,
    updatedAt: new Date().toISOString(),
  };
  await adminDb.collection('magazine_issues').doc(ISSUE_ID_TO_FIX).set(issuePatch, { merge: true });
  console.log(`  ✅ Updated live issue ${ISSUE_ID_TO_FIX}:`);
  console.log(`     readerEditionId → ${canonical.id}`);
  console.log(`     readerEditionTitle → "${correctedTitle}"`);
  console.log(`     readerEditionPageCount → ${canonicalPages}`);
  console.log();

  // 3. Delete duplicates
  for (const victim of toDelete) {
    // First, unlink from any magazine_issues that might point to this id
    try {
      const linkedSnap = await adminDb
        .collection('magazine_issues')
        .where('readerEditionId', '==', victim.id)
        .limit(20)
        .get();
      for (const doc of linkedSnap.docs) {
        await adminDb.collection('magazine_issues').doc(doc.id).set(
          {
            readerEditionId: null,
            readerEditionTitle: null,
            readerEditionSlug: null,
            readerEditionPublished: false,
            readerEditionPageCount: null,
          },
          { merge: true },
        );
        console.log(`     🔗 Unlinked issue ${doc.id} from deleted edition ${victim.id}`);
      }
    } catch {
      /* ignore */
    }

    await adminDb.collection('magazine_reader_editions').doc(victim.id).delete();
    console.log(`  🗑️  Deleted: ${victim.id}`);
  }

  console.log(`\n🎉 STEP 5: Done! Firestore now clean.\n`);
  console.log(`   Summary:`);
  console.log(`   • 1 canonical Aug/Sept reader edition:  ${canonical.id}  (${canonicalPages} pages)`);
  console.log(`   • Live issue ${ISSUE_ID_TO_FIX} now points to it`);
  console.log(`   • ${toDelete.length} duplicate reader editions removed`);
  console.log(`   • June 2026 historic edition preserved: ${juneEdition ? 'yes' : 'n/a'}`);
  console.log();
  console.log(`   Next: go to /admin/magazine to verify, then hard-refresh /new-edition + /magazine/issue/${ISSUE_ID_TO_FIX}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
