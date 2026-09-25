#!/usr/bin/env tsx
/**
 * Magazine maintenance: rebuild a reader edition from clean builder rows and
 * carry the frozen Classifieds page across the rebuild idempotently.
 *
 * Mirrors syncBuilderToReaderEditionAction without the admin-auth/revalidate
 * layers: reads the issue + builder pages, maps them into reader pages,
 * carries the existing baked Classifieds page (replacing the builder's empty
 * "Classifieds" placeholder instead of splicing a duplicate), then upserts the
 * edition and back-patches magazine_issues.
 *
 * Usage (run from repo root):
 *   pnpm exec tsx scripts/rebuild-reader-edition.ts            # apply
 *   pnpm exec tsx scripts/rebuild-reader-edition.ts --dry-run  # report only
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: false });

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const { getMagazineReadStore } = await import('../src/features/magazine/server/read-store');
  const { getMagazineWriteStore } = await import('../src/features/magazine/server/write-store');
  const { mapBuilderIssueToReaderEdition, mergeClassifiedsIntoPages } = await import(
    '../src/features/magazine/domain/builder-to-reader'
  );
  const { ReaderEditionSchema } = await import(
    '../src/features/magazine/domain/validation-schemas'
  );
  const { getReaderEditionById, upsertReaderEdition } = await import(
    '../src/features/magazine/server/simple-reader'
  );
  const { CURRENT_READER_SCHEMA_VERSION } = await import(
    '../src/features/magazine/server/simple-reader'
  );
  const type = (await import('../src/features/magazine/domain/types')) as any;

  const readStore = getMagazineReadStore();
  const writeStore = await getMagazineWriteStore();

  const issues = await readStore.getMagazineIssues();
  const issue = issues[0];
  if (!issue) throw new Error('No magazine issue found');
  const issueId = String(issue.id);

  const builderPages = await readStore.getMagazinePages(issueId);
  console.log(`issue ${issueId}: ${builderPages.length} builder pages`);

  const projected = mapBuilderIssueToReaderEdition(issue as any, builderPages);

  let existingReaderEditionId = String((issue as any).readerEditionId || '').trim() || undefined;
  if (existingReaderEditionId) {
    const existingSnap = await getReaderEditionById(existingReaderEditionId);
    if (existingSnap) {
      projected.id = existingSnap.id;
      (projected as any).readerEditionId = existingSnap.id;
      (projected as any).createdAt =
        (existingSnap as any).createdAt ?? (projected as any).createdAt ?? new Date().toISOString();
    } else {
      existingReaderEditionId = undefined;
    }
  }
  (projected as any).updatedAt = new Date().toISOString();
  (projected as any).schemaVersion = CURRENT_READER_SCHEMA_VERSION;

  const parseResult = ReaderEditionSchema.safeParse(projected);
  if (!parseResult.success) {
    console.error('ReaderEditionSchema validation failed');
    console.error(JSON.stringify((parseResult as any).error?.issues || [], null, 2));
    process.exit(1);
  }
  const validated = parseResult.data as any;

  let existingClassifieds: type.ReaderPage | null = null;
  try {
    const currentId = String((issue as any).readerEditionId || '');
    if (currentId) {
      const currentEdition = await getReaderEditionById(currentId);
      existingClassifieds =
        (Array.isArray(currentEdition?.pages) &&
          (currentEdition.pages as type.ReaderPage[]).find(
            (p) => String(p.template || '').trim().toLowerCase() === 'classifieds',
          )) ||
        null;
    }
  } catch {
    existingClassifieds = null;
  }

  if (existingClassifieds) {
    const before = validated.pages.length;
    const nextPages = mergeClassifiedsIntoPages(validated.pages, existingClassifieds);
    validated.pages = nextPages;
    validated.pageCount = nextPages.length;
    console.log(`classifieds carried over: ${before} -> ${nextPages.length} pages`);
  } else {
    console.log('no existing classifieds page found (none carried)');
  }

  console.log(`reader edition will have ${validated.pages.length} pages`);
  const classifiedsPage = (validated.pages as type.ReaderPage[]).filter(
    (p: any) => String(p.template || '').trim().toLowerCase() === 'classifieds',
  ).length;
  const videoPages = (validated.pages as type.ReaderPage[]).filter(
    (p: any) => Boolean((p as any).content?.videoUrl),
  ).length;
  console.log(`classifieds pages: ${classifiedsPage}, video pages: ${videoPages}`);

  if (dryRun) {
    console.log('DRY RUN — not writing');
    return;
  }

  await upsertReaderEdition(validated as type.ReaderEdition);
  const publicSlug = String((validated as any).slug || (issue as any).readerEditionSlug || (issue as any).slug || '').trim();
  const issuePatch: Record<string, unknown> = {
    readerEditionId: existingReaderEditionId || String((validated as any).id || ''),
    slug: publicSlug || (issue as any).slug,
    readerEditionSlug: publicSlug || (issue as any).readerEditionSlug,
    published: (validated as any).published ?? (issue as any).published ?? true,
    title: validated.title || (issue as any).title,
    publishDate: validated.publishDate || (issue as any).publishDate,
    pageCount: Array.isArray(validated.pages) ? validated.pages.length : 0,
    updatedAt: new Date().toISOString(),
  };
  await writeStore.updateIssue(issueId, issuePatch);
  console.log('reader edition rebuilt and issue patched');
}

main().catch((e) => {
  console.error('Rebuild failed:', e);
  process.exit(1);
});