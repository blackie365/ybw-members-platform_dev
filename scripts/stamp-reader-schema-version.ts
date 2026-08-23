/**
 * Backfills `schemaVersion: CURRENT_READER_SCHEMA_VERSION` on every
 * magazine_reader_editions doc and every magazine_issues doc that has a
 * `pages[]` array (so the fast-path in hydrateEditionWithLegacyPages kicks
 * in on the very NEXT reader visit instead of the slow full-hydrate path).
 *
 * Run locally:
 *   source .env.local  # or wherever FIREBASE_PRIVATE_KEY is set
 *   npx tsx scripts/stamp-reader-schema-version.ts --dry
 *   npx tsx scripts/stamp-reader-schema-version.ts --apply
 */
import 'dotenv/config';
import { CURRENT_READER_SCHEMA_VERSION } from '../src/lib/magazine-utils';

const DRY_RUN = process.argv.includes('--apply') === false;

type AdminFirestore = ReturnType<typeof import('firebase-admin/firestore').getFirestore>;

async function getAdminDb(): Promise<AdminFirestore> {
  const admin = await import('firebase-admin');
  if (admin.apps.length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID;
    if (privateKey && clientEmail && projectId) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      admin.initializeApp();
    }
  }
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore();
}

async function stampCollection(
  db: AdminFirestore,
  collection: string,
  label: string,
) {
  const snap = await db.collection(collection).get();
  const docs = snap.docs;
  let stamped = 0;
  let skipped = 0;

  for (const doc of docs) {
    const data = (doc.data() || {}) as Record<string, unknown>;
    const current = Number(data.schemaVersion || 0);
    const needsPages = collection === 'magazine_issues';
    const hasPages =
      !needsPages ||
      (Array.isArray((data as any).pages) && (data as any).pages.length > 0);
    if (current >= CURRENT_READER_SCHEMA_VERSION) {
      skipped += 1;
      continue;
    }
    if (needsPages && !hasPages) {
      skipped += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(
        `  [dry] ${label}/${doc.id}: schemaVersion ${current} -> ${CURRENT_READER_SCHEMA_VERSION}`,
      );
    } else {
      await doc.ref.set(
        { schemaVersion: CURRENT_READER_SCHEMA_VERSION },
        { merge: true },
      );
    }
    stamped += 1;
  }

  console.log(
    `${label}: total=${docs.length} stamped=${stamped} skipped=${skipped} (dry=${DRY_RUN})`,
  );
  return { stamped, skipped };
}

async function main() {
  console.log(
    `\nStamp Reader schemaVersion=${CURRENT_READER_SCHEMA_VERSION} on magazine editions.\nMode: ${DRY_RUN ? 'DRY RUN (pass --apply to write)' : 'APPLY'}\n`,
  );
  const db = await getAdminDb();
  await stampCollection(db, 'magazine_reader_editions', 'ReaderEditions');
  await stampCollection(db, 'magazine_issues', 'BuilderIssues');
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
