#!/usr/bin/env tsx
/**
 * Magazine maintenance: set the FEATURE IMAGE of one builder page and rebuild
 * its reader edition exactly the way the app does (mapBuilderIssueToReaderEdition
 * -> ReaderEditionSchema -> upsertReaderEdition -> updateIssue).
 *
 * Use case: a user uploads a photo through the builder (it lands in the plain
 * image arrays) but the reader still shows the IDML-imported hero because the
 * single-image field the template reads (featureImage) was never set. This
 * script promotes an uploaded image URL to featureImage so the reader renders
 * it as the hero.
 *
 * Dry-run by default. Pass --apply to write to Postgres.
 *
 * Usage:
 *   tsx scripts/magazine-set-feature-image.ts \
 *     --issue-slug yorkshire-business-woman-summer-2026-edition \
 *     --needle 1788534610777 \
 *     --url 'https://firebasestorage.googleapis.com/...PNG?alt=media'
 *
 * Optional:
 *   --page-id <n>   pin a specific builder page when the needle matches several
 *   --old-url <url> also replace every occurrence of this URL in the page (string
 *                   fields and image-array entries) with --url, then dedupe the
 *                   arrays (handles placeholder SVGs the IDML import left behind).
 *                   Matching is by exact URL or by filename, so host/encoding/token
 *                   differences still get replaced.
 *   --no-backfill   only set content.featureImage (default also backfills empty
 *                   single-image fields image/heroImage/photo/mainImage)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { MagazinePage, MagazineIssue } from '../src/components/admin/magazine-builder/types';
import { mapBuilderIssueToReaderEdition } from '../src/features/magazine/domain/builder-to-reader';
import { ReaderEditionSchema } from '../src/features/magazine/domain/validation-schemas';
import { getReaderEditionById } from '../src/features/magazine/server/simple-reader';
import { getMagazineReadStore } from '../src/features/magazine/server/read-store';
import { getMagazineWriteStore } from '../src/features/magazine/server/write-store';
import type { ReaderEdition } from '../src/features/magazine/domain/types';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
const APPLY = process.argv.includes('--apply');
const BACKFILL = !process.argv.includes('--no-backfill');

const BACKFILL_FIELDS = ['image', 'heroImage', 'photo', 'mainImage'];

const IMAGE_ARRAY_FIELDS = ['images', 'gallery', 'imageUrls', 'additionalImages', 'logoImages'];

function isOldTarget(value: string, oldUrl: string, newUrl: string): boolean {
  if (value === newUrl) return false;
  if (value === oldUrl) return true;
  // Match by filename too ("IMG_0075.PNG") so we survive encoding/host/token
  // differences between the stored URL and the URL passed on the CLI.
  try {
    const oldBase = basenameUrl(oldUrl);
    return Boolean(oldBase) && basenameUrl(value) === oldBase;
  } catch {
    return false;
  }
}

function replaceInContent(content: Record<string, unknown>, oldUrl: string, newUrl: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(content || {})) {
    if (typeof v === 'string') {
      out[k] = isOldTarget(v, oldUrl, newUrl) ? newUrl : v;
    } else if (IMAGE_ARRAY_FIELDS.includes(k) && Array.isArray(v)) {
      const seen = new Set<string>();
      const next: unknown[] = [];
      for (const u of v) {
        const resolved = typeof u === 'string' && isOldTarget(u, oldUrl, newUrl) ? newUrl : u;
        if (typeof resolved !== 'string' || !seen.has(resolved)) {
          next.push(resolved);
          if (typeof resolved === 'string') seen.add(resolved);
        }
      }
      out[k] = next.length > 0 ? next : undefined;
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  const issueSlug = arg('--issue-slug');
  const needle = arg('--needle');
  const url = arg('--url');
  const pageId = arg('--page-id');
  const oldUrl = arg('--old-url');
  if (!issueSlug || !needle || !url) {
    console.error('Missing required arg. See header comment.');
    process.exit(1);
  }

  const readStore = getMagazineReadStore();
  const writeStore = getMagazineWriteStore();

  const issues = await readStore.getMagazineIssues();
  const issue = issues.find(
    (i) => String((i as any).readerEditionSlug || '') === issueSlug || String((i as any).slug || '') === issueSlug,
  );
  if (!issue) {
    console.error(`No issue found with slug '${issueSlug}'. Candidates:`);
    for (const i of issues) console.log(`  ${String((i as any).readerEditionSlug || (i as any).slug || '')} (${String((i as any).id || '')})`);
    process.exit(1);
  }
  const issueId = String((issue as any).id);
  console.log(`Issue: ${String((issue as any).title || '')} (id ${issueId})`);

  const pages = await readStore.getMagazinePages(issueId);
  const matches = pages.filter((p) => JSON.stringify(p).includes(needle));
  if (matches.length === 0) {
    console.error(`No page in issue ${issueId} contains '${needle}'.`);
    process.exit(1);
  }
  let target = matches[0];
  if (matches.length > 1) {
    if (pageId) {
      target = matches.find((p) => String((p as any).id) === String(pageId)) || target;
    } else {
      console.error(`Needle '${needle}' matched ${matches.length} pages. Use --page-id:`);
      for (const p of matches) {
        const c: any = p.content || {};
        console.log(`  id=${String((p as any).id)} type=${String((p as any).type || '')} pos=${String((p as any).position ?? (p as any).pageNumber ?? '')} title="${String(c.title || c.heading || '')}"`);
      }
      process.exit(1);
    }
  }

  const c0: any = target.content || {};
  console.log(`\nTarget page: id=${String((target as any).id)} type=${String((target as any).type || '')} title="${String(c0.title || c0.heading || '')}"`);
  console.log(`  current featureImage=${c0.featureImage || EMPTY}  image=${c0.image || EMPTY}`);
  console.log(`  needle found in: ${Object.keys(flatten(target)).filter((k) => String(flatten(target)[k]).includes(needle)).join(', ')}`);

  const patched: MagazinePage = JSON.parse(JSON.stringify(target));
  let content: any = patched.content || {};
  if (oldUrl) {
    const before = JSON.stringify(content);
    content = replaceInContent(content, oldUrl, url);
    const changed: string[] = [];
    for (const k of Object.keys(content)) {
      if (JSON.stringify(content[k]) !== JSON.stringify((patched.content as any)[k])) changed.push(k);
    }
    console.log(`  --old-url replacement (${basenameUrl(oldUrl)} -> ${basenameUrl(url)}) affected fields: ${changed.join(', ') || 'none'}`);
  }
  content.featureImage = url;
  if (BACKFILL) {
    for (const field of BACKFILL_FIELDS) {
      const existing = typeof content[field] === 'string' ? content[field] : '';
      if (!existing || existing === url) continue;
      content[field] = url;
    }
  }
  (patched as any).content = content;

  const projected = mapBuilderIssueToReaderEdition(issue as any, pages.map((p) => (p as any).id === (target as any).id ? patched : p));

  // Preserve the existing reader edition identity (mirrors syncBuilderToReaderEditionAction).
  let existingReaderEditionId = String((issue as any).readerEditionId || '') || undefined;
  const now = new Date().toISOString();
  if (existingReaderEditionId) {
    const existingSnap = await getReaderEditionById(existingReaderEditionId);
    if (existingSnap) {
      projected.id = (existingSnap as any).id;
      projected.readerEditionId = (existingSnap as any).id;
      projected.createdAt = (existingSnap as any).createdAt ?? projected.createdAt ?? now;
    } else {
      existingReaderEditionId = undefined;
    }
  }
  projected.updatedAt = now;

  const parseResult = ReaderEditionSchema.safeParse(projected);
  if (!parseResult.success) {
    console.error('\nReaderEditionSchema validation failed — aborting without writes:', (parseResult as any).error?.issues);
    process.exit(1);
  }
  const validated = parseResult.data as ReaderEdition & { schemaVersion?: number };

  const projTarget = (validated as any).pages?.find((rp: any) => {
    const c: any = rp.content || {};
    return rp.slug === (target as any).slug || rp.id === String((target as any).id) || c.title === c0.title;
  });
  console.log(`\nProjected reader page: id=${projTarget?.id} template=${projTarget?.template} featureImage=${projTarget?.content?.featureImage || projTarget?.content?.image}`);

  if (!APPLY) {
    console.log('\nDRY RUN — no writes. Re-run with --apply to:');
    console.log(`  • upsert magazine_pages row (page id ${String((target as any).id)}) with content.featureImage`);
    console.log('  • upsert magazine_reader_editions (rebuilt via mapBuilderIssueToReaderEdition)');
    console.log('  • patch magazine_issues (readerEditionId/slug/published/pageCount/updatedAt)');
    process.exit(0);
  }

  // Writes — order matters: page first, then reader edition, then issue meta.
  await writeStore.addPage(issueId, patched);
  await writeStore.upsertReaderEdition(validated as ReaderEdition);

  const publicSlug = String((validated as any).slug || (issue as any).readerEditionSlug || (issue as any).slug || '').trim();
  const issuePatch: Record<string, unknown> = {
    readerEditionId: existingReaderEditionId || String((validated as any).id || ''),
    slug: publicSlug || (issue as any).slug,
    readerEditionSlug: publicSlug || (issue as any).readerEditionSlug,
    published: (validated as any).published ?? (issue as any).published ?? true,
    title: validated.title || (issue as any).title,
    publishDate: validated.publishDate || (issue as any).publishDate,
    pageCount: Array.isArray((validated as any).pages) ? (validated as any).pages.length : 0,
    updatedAt: now,
  };
  await writeStore.updateIssue(issueId, issuePatch);

  console.log(`\nApplied. featureImage set on page ${String((target as any).id)}; reader edition ${String(existingReaderEditionId || (validated as any).id)} rebuilt (${(validated as any).pages?.length ?? 0} pages).`);
  console.log('Reader routes revalidate on their own (revalidate=60); no manual step needed.');
}

const EMPTY = '<empty>';
function basenameUrl(value: string): string {
  try {
    const u = new URL(value.startsWith('http') ? value : `https://x/${value}`);
    const decoded = decodeURIComponent(u.pathname);
    return decoded.split('/').filter(Boolean).pop()?.slice(0, 80) || '';
  } catch {
    return value.slice(0, 80);
  }
}
function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});