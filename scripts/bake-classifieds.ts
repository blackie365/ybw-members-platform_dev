#!/usr/bin/env tsx
/**
 * Magazine maintenance: re-bake the Classifieds page into a reader edition.
 *
 * Re-runs the exact snapshot the app uses (bakeClassifiedsIntoEdition): reads
 * the paid/featured active members from Postgres once, serialises them into
 * ClassifiedEntry rows and freezes them as the reader's "Classifieds" page.
 * Use after scripts/migrate-members-to-pg.ts to pick up refreshed details.
 *
 * Dry-run semantics: the bake is a pure upsert of member data onto the page,
 * so by default it WRITES (matches the API behaviour). Pass --latest-only by
 * default? No — pass a slug/edition id as the first positional arg to target a
 * specific edition; with no args it bakes into the most recently published one.
 *
 * Usage (run from repo root):
 *   source .env.local   (or rely on the maintenance workflow)
 *   pnpm exec tsx scripts/bake-classifieds.ts            # latest edition
 *   pnpm exec tsx scripts/bake-classifieds.ts <slug>     # by edition slug
 *   pnpm exec tsx scripts/bake-classifieds.ts <editionId>
 *
 * Errors out (exit 1) if no edition was found or the bake failed.
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: false });

async function main(): Promise<void> {
  const { bakeClassifiedsIntoEdition } = await import(
    '../src/features/magazine/server/bake-classifieds'
  );

  const arg = process.argv[2];
  const body: { editionId?: string; slug?: string } = {};
  if (arg) body[/^[a-z0-9-]{1,64}$/i.test(arg) ? 'slug' : 'editionId'] = arg;

  const result = await bakeClassifiedsIntoEdition(body);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    console.error('Bake failed:', result.reason ?? 'unknown');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Bake failed:', e);
  process.exit(1);
});