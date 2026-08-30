/**
 * One-time backfill: Firestore → Postgres for the magazine READ STORE (Phase 3).
 *
 * It resolves content through the SAME read functions the public reader uses
 * (getMagazineIssuesServer / getMagazinePagesServer / listReaderEditions /
 * getReaderEditionById) and writes that RESOLVED output into the Postgres
 * JSONB tables. This guarantees the Pg store returns byte-for-byte identical
 * shapes to what the Firestore reader would have produced — no fragile
 * hydration/merge logic is reimplemented in SQL.
 *
 * Usage (run from repo root):
 *   source .env.local                       # FIREBASE_* + NEXT_PUBLIC_* for reader access
 *   PGPASSWORD='...' PGUSER=ybw_app PGDATABASE=ybw_magazine \
 *     npx tsx scripts/backfill-firestore-to-pg.ts [--dry]
 *
 *   --dry  print what would be written without writing.
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

// Load .env.local BEFORE importing any firebase-dependent module. dotenv
// unescapes "\n" in the quoted FIREBASE_PRIVATE_KEY into real newlines, which
// the Admin SDK requires. Static imports are hoisted above this call, so the
// firebase-backed read modules are imported dynamically inside main() instead.
dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: false });

const DRY = process.argv.includes('--dry');

async function main(): Promise<void> {
  const { initMagazinePgSchema, toPgDate } = await import(
    '../src/features/magazine/server/read-store/pg-schema'
  );
  const { getMagazinePgPool } = await import(
    '../src/features/magazine/server/read-store/pg-client'
  );
  const {
    getMagazineIssuesServer,
    getMagazinePagesServer,
  } = await import('../src/lib/magazine-service-server');
  const {
    listReaderEditions,
    getReaderEditionById,
    getReaderEditionBySlug,
  } = await import('../src/features/magazine/server/simple-reader');
  const { adminDb } = await import('../src/lib/firebase-admin');

  const pool = getMagazinePgPool();
  if (!pool) {
    console.error('No Postgres pool. Set PGPASSWORD/PGUUSER/PGDATABASE (or DATABASE_URL). Aborting.');
    process.exit(1);
  }

  if (DRY) {
    console.log('DRY RUN — nothing will be written.');
  } else {
    await initMagazinePgSchema();
    console.log('Schema ensured.');
  }

  const upsertIssue = async (issue: any) => {
    const data = issue;
    const id = String(issue.id ?? '');
    if (!id) return 0;
    const publish = toPgDate(issue.publishDate);
    if (DRY) {
      console.log(`  [issue] would write ${id} (publish=${publish ?? 'null'})`);
      return 0;
    }
    await pool.query(
      `INSERT INTO magazine_issues (id, data, publish_date) VALUES ($1,$2::jsonb,$3)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, publish_date = EXCLUDED.publish_date`,
      [id, JSON.stringify(data), publish],
    );
    return 1;
  };

  const upsertPage = async (issueId: string, page: any, idx: number) => {
    const id = String(page.id ?? idx);
    const sortKey = Number(page.id ?? idx);
    if (DRY) {
      console.log(`  [page] would write ${issueId}/${id}`);
      return 0;
    }
    await pool.query(
      `INSERT INTO magazine_pages (issue_id, id, sort_key, data) VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (issue_id, id) DO UPDATE SET sort_key = EXCLUDED.sort_key, data = EXCLUDED.data`,
      [issueId, id, sortKey, JSON.stringify(page)],
    );
    return 1;
  };

  const upsertReaderEdition = async (full: any, dataLight: any) => {
    // The row's identity comes from the LIST item (dataLight) — NOT from the
    // full/authoritative shape, because getReaderEditionBySlug returns the
    // shared slug's authoritative edition whose .id differs for duplicate-slug
    // rows. Using full.id here would overwrite the wrong row.
    const identity = dataLight ?? full;
    const id = String(identity.id ?? '');
    if (!id) return 0;
    const slug = full.slug ? String(full.slug) : null;
    const issueId = full.issueId ? String(full.issueId) : null;
    const publish = toPgDate(full.publishDate);
    if (DRY) {
      console.log(`  [edition] would write ${id} slug=${slug ?? 'null'} pages=${full.pages?.length ?? '?'}/light=${dataLight?.pages?.length ?? '?'}`);
      return 0;
    }
    const dataJson = JSON.stringify(full);
    const lightJson = JSON.stringify(dataLight ?? full);
    await pool.query(
      `INSERT INTO magazine_reader_editions (id, data, data_light, slug, issue_id, publish_date)
       VALUES ($1,$2::jsonb,$3::jsonb,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, data_light = EXCLUDED.data_light,
         slug = EXCLUDED.slug, issue_id = EXCLUDED.issue_id, publish_date = EXCLUDED.publish_date`,
      [id, dataJson, lightJson, slug, issueId, publish],
    );
    return 1;
  };

  const upsertStoryLibraryItem = async (issueId: string, item: any) => {
    const id = String(item.id ?? '');
    if (!id) return 0;
    const data = { ...(item as any), issueId };
    if (DRY) {
      console.log(`  [story] would write ${issueId}/${id}`);
      return 0;
    }
    await pool.query(
      `INSERT INTO magazine_story_library (id, issue_id, data) VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (id) DO UPDATE SET issue_id = EXCLUDED.issue_id, data = EXCLUDED.data`,
      [id, issueId, JSON.stringify(data)],
    );
    return 1;
  };

  let nIssues = 0;
  let nPages = 0;
  let nEditions = 0;
  let nStory = 0;
  let nDrafts = 0;

  // 1. Issues
  console.log('Backfilling issues…');
  try {
    const issues = await getMagazineIssuesServer();
    for (const issue of issues) nIssues += await upsertIssue(issue);
  } catch (e) {
    console.warn('issue backfill failed:', e);
  }

  // 2. Pages per issue
  console.log('Backfilling pages…');
  for (const issue of await getMagazineIssuesServer()) {
    const issueId = String(issue.id ?? '');
    if (!issueId) continue;
    try {
      const pages = await getMagazinePagesServer(issueId);
      // NOTE: getMagazinePagesServer returns pages WITHOUT docId. Use page.id for
      // the row id; fall back to index if absent.
      for (let i = 0; i < pages.length; i++) nPages += await upsertPage(issueId, pages[i], i);
    } catch (e) {
      console.warn(`  page backfill failed for ${issueId}:`, e);
    }
  }

  // 3. Reader editions (resolved shapes)
  console.log('Backfilling reader editions…');
  try {
    const editions = await listReaderEditions(1000);
    for (const edition of editions) {
      // The Firestore read layer resolves the SAME edition to two different
      // shapes depending on method:
      //   - full  : getReaderEditionBySlug / getReaderEditionByIssueId (the
      //             reader-serving AUTHORITY-hydrated shape, more pages) -> data
      //   - light : listReaderEditions / getReaderEditionById (lighter listing
      //             shape) -> data_light
      // Store BOTH so the Pg store can return byte-identical output per method.
      const slug = (edition as any)?.slug;
      let full: any = edition;
      if (slug) {
        full = (await getReaderEditionBySlug(String(slug)).catch(() => null)) ?? edition;
      }
      if (full === edition && (edition as any)?.id) {
        full =
          (await getReaderEditionById(String((edition as any).id)).catch(() => null)) ?? edition;
      }
      nEditions += await upsertReaderEdition(full, edition);
    }
  } catch (e) {
    console.warn('reader edition backfill failed:', e);
  }

  // 4. Story library per issue (direct Firestore query, since the read-store
  //    getStoryLibrary now routes PG-first and this script POPULATES PG).
  console.log('Backfilling story library…');
  if (adminDb) {
    for (const issue of await getMagazineIssuesServer()) {
      const issueId = String(issue.id ?? '');
      if (!issueId) continue;
      try {
        const collectionRef = adminDb.collection('magazine_story_library');
        const [sourceRefSnapshot, issueIdSnapshot] = await Promise.all([
          collectionRef
            .where('sourceRef', '>=', `${issueId}:`)
            .where('sourceRef', '<', `${issueId}:\uf8ff`)
            .get().catch(() => null),
          collectionRef.where('issueId', '==', issueId).get().catch(() => null),
        ]);
        const map = new Map<string, any>();
        for (const snapshot of [sourceRefSnapshot, issueIdSnapshot]) {
          if (!snapshot) continue;
          for (const doc of snapshot.docs) {
            map.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
          }
        }
        for (const item of map.values()) nStory += await upsertStoryLibraryItem(issueId, item);
      } catch (e) {
        console.warn(`  story library backfill failed for ${issueId}:`, e);
      }
    }
  } else {
    console.warn('  adminDb not available — skipping story library backfill');
  }

  // 5. IDML drafts (top-level collection).
  console.log('Backfilling IDML drafts…');
  if (adminDb) {
    try {
      const snapshot = await adminDb.collection('magazine_idml_drafts').get();
      for (const doc of snapshot.docs) {
        const data = { id: doc.id, ...doc.data() };
        const updatedAt = (data as any).updatedAt || null;
        if (DRY) {
          console.log(`  [draft] would write ${doc.id}`);
          nDrafts += 1;
          continue;
        }
        await pool.query(
          `INSERT INTO magazine_idml_drafts (id, updated_at, data) VALUES ($1,$2,$3::jsonb)
           ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
          [doc.id, toPgDate(updatedAt), JSON.stringify(data)],
        );
        nDrafts += 1;
      }
    } catch (e) {
      console.warn('IDML draft backfill failed:', e);
    }
  } else {
    console.warn('  adminDb not available — skipping IDML draft backfill');
  }

  console.log('\nBackfill summary:');
  console.log(`  issues: ${nIssues}`);
  console.log(`  pages:  ${nPages}`);
  console.log(`  reader_editions: ${nEditions}`);
  console.log(`  story_library:   ${nStory}`);
  console.log(`  idml_drafts:     ${nDrafts}`);
  await pool.end();
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
