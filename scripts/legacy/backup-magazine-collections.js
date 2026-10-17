/**
 * Magazine Firestore Backup Script
 *
 * Snapshots every collection involved in the magazine builder/reader data
 * model into local JSON files before the planned store-consolidation
 * migration (collapsing magazine_reader_editions into magazine_issues/*
 * /pages). Run this immediately before any migration/deletion step.
 *
 * Captures:
 *   - magazine_issues/{issueId}            (issue metadata + storyLibrary[])
 *   - magazine_issues/{issueId}/pages/*     (the editable "builder" pages
 *                                            subcollection, per issue)
 *   - magazine_reader_editions/{editionId}  (the published reader edition,
 *                                            including its pages[] array)
 *
 * This is IN ADDITION to (not a replacement for) the managed
 * `gcloud firestore export` snapshot, which backs up the raw Firestore
 * data at the storage layer. This script produces a plain-JSON artifact
 * that's easy to diff/inspect/grep during migration verification.
 *
 * Uses the same serviceAccountKey.json convention as scripts/full-backup.js.
 */

require('dotenv')?.config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(process.cwd(), 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

try {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Loaded credentials from serviceAccountKey.json');
  } else {
    throw new Error('serviceAccountKey.json not found');
  }
} catch (e) {
  console.error('❌ Failed to initialize Firebase Admin:', e?.message);
  process.exit(1);
}

const db = admin.firestore();

function serializeValue(value) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    // Firestore Timestamp
    return value.toDate().toISOString();
  }
  return value;
}

function serializeDoc(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    out[key] = serializeValue(value);
  }
  return out;
}

async function createMagazineBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join(BACKUP_DIR, `magazine-backup-${timestamp}`);
  fs.mkdirSync(sessionDir);

  console.log(`\n📦 Starting magazine collections backup to: ${sessionDir}`);

  // 1) magazine_issues + nested pages subcollections
  const issuesOut = {};
  let totalPageDocs = 0;
  try {
    const issuesSnap = await db.collection('magazine_issues').get();
    for (const issueDoc of issuesSnap.docs) {
      const pagesSnap = await db
        .collection('magazine_issues')
        .doc(issueDoc.id)
        .collection('pages')
        .get();
      const pages = {};
      pagesSnap.docs.forEach((pageDoc) => {
        pages[pageDoc.id] = serializeDoc(pageDoc.data());
      });
      totalPageDocs += pagesSnap.size;
      issuesOut[issueDoc.id] = {
        ...serializeDoc(issueDoc.data()),
        pages,
      };
    }
    fs.writeFileSync(
      path.join(sessionDir, 'magazine_issues.json'),
      JSON.stringify(issuesOut, null, 2),
    );
    console.log(
      `✅ Exported ${issuesSnap.size} magazine_issues docs (+ ${totalPageDocs} nested pages docs) to magazine_issues.json`,
    );
  } catch (error) {
    console.error('❌ Failed to export magazine_issues:', error?.message);
  }

  // 2) magazine_reader_editions
  try {
    const editionsSnap = await db.collection('magazine_reader_editions').get();
    const editionsOut = {};
    editionsSnap.docs.forEach((doc) => {
      editionsOut[doc.id] = serializeDoc(doc.data());
    });
    fs.writeFileSync(
      path.join(sessionDir, 'magazine_reader_editions.json'),
      JSON.stringify(editionsOut, null, 2),
    );
    console.log(
      `✅ Exported ${editionsSnap.size} magazine_reader_editions docs to magazine_reader_editions.json`,
    );
  } catch (error) {
    console.error('❌ Failed to export magazine_reader_editions:', error?.message);
  }

  console.log(`\n✨ Magazine backup complete! All files are in ${sessionDir}`);
  return sessionDir;
}

createMagazineBackup().catch((err) => {
  console.error(err);
  process.exit(1);
});
