import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildCanonicalBundleFromManifest } from '@/features/magazine/importers/idml-canonical';
import { buildIdmlManifestFromFile } from '@/features/magazine/importers/idml-manifest';
import { importCanonicalBundle } from '@/features/magazine/server/idml-import-service';
import type { IdmlCanonicalBundle } from '@/features/magazine/importers/idml-canonical';
import type { IdmlManifest } from '@/features/magazine/importers/idml-manifest';
import { adminDbInit } from '@/lib/firebase-admin';

type InputKind = 'idml' | 'manifest' | 'bundle';

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      return { help: true, positional, options };
    }

    if (arg.startsWith('--')) {
      const trimmed = arg.slice(2);
      const [key, value] = trimmed.split('=');
      options[key] = value === undefined ? true : value;
      continue;
    }

    positional.push(arg);
  }

  return { help: false, positional, options };
}

function getInputKind(inputPath: string): InputKind {
  const lower = inputPath.toLowerCase();
  if (lower.endsWith('.idml')) return 'idml';
  if (lower.endsWith('.canonical.json')) return 'bundle';
  return 'manifest';
}

async function loadBundle(inputPath: string): Promise<IdmlCanonicalBundle> {
  const kind = getInputKind(inputPath);

  if (kind === 'bundle') {
    return JSON.parse(await fs.readFile(inputPath, 'utf8')) as IdmlCanonicalBundle;
  }

  const manifest =
    kind === 'idml'
      ? await buildIdmlManifestFromFile(inputPath)
      : (JSON.parse(await fs.readFile(inputPath, 'utf8')) as IdmlManifest);

  return buildCanonicalBundleFromManifest(manifest);
}

async function main() {
  const { help, positional, options } = parseArgs(process.argv.slice(2));

  if (help || positional.length === 0) {
    console.log(
      'Usage: pnpm tsx scripts/import-idml-canonical-bundle.ts <path-to-idml|manifest.json|canonical.json> [--write] [--overwrite] [--publish]',
    );
    process.exit(help ? 0 : 1);
  }

  const inputPath = path.resolve(positional[0]);
  const bundle = await loadBundle(inputPath);

  if (!options.write) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          firebaseAdminConfigured: adminDbInit.ok,
          editionId: bundle.edition.id,
          slug: bundle.edition.slug,
          title: bundle.edition.title,
          previewHref: `/magazine/v2/${bundle.edition.slug}`,
          pageCount: bundle.pages.length,
          slotCount: bundle.slots.length,
          storyCount: bundle.stories.length,
          assetCount: bundle.assets.length,
          warnings: bundle.summary.warnings,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!adminDbInit.ok) {
    throw new Error(`Firebase Admin is not configured: ${adminDbInit.error || 'unknown error'}`);
  }

  const result = await importCanonicalBundle(bundle, {
    overwriteExistingEdition: Boolean(options.overwrite),
    publish: Boolean(options.publish),
    sourceFilePath: inputPath,
  });

  console.log(
    JSON.stringify(
      {
        imported: true,
        created: result.created,
        editionId: result.edition.id,
        slug: result.edition.slug,
        title: result.edition.title,
        previewHref: result.previewHref,
        pageCount: result.pageCount,
        slotCount: result.slotCount,
        storyCount: result.storyCount,
        assetCount: result.assetCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
