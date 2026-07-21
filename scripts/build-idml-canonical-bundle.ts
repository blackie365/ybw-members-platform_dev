import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildCanonicalBundleFromManifest } from '@/features/magazine/importers/idml-canonical';
import { buildIdmlManifestFromFile } from '@/features/magazine/importers/idml-manifest';
import type { IdmlManifest } from '@/features/magazine/importers/idml-manifest';

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const options: Record<string, string> = {};

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      return { help: true, positional, options };
    }

    if (arg.startsWith('--')) {
      const [key, value = ''] = arg.slice(2).split('=');
      options[key] = value;
      continue;
    }

    positional.push(arg);
  }

  return { help: false, positional, options };
}

function defaultOutputPath(inputPath: string): string {
  const fileName = path.basename(inputPath).replace(/\.(idml|json)$/i, '.canonical.json');
  return path.join(process.cwd(), 'data', 'magazine', 'canonical-imports', fileName);
}

async function loadManifest(inputPath: string): Promise<IdmlManifest> {
  if (inputPath.toLowerCase().endsWith('.idml')) {
    return buildIdmlManifestFromFile(inputPath);
  }

  const raw = await fs.readFile(inputPath, 'utf8');
  return JSON.parse(raw) as IdmlManifest;
}

async function main() {
  const { help, positional, options } = parseArgs(process.argv.slice(2));

  if (help || positional.length === 0) {
    console.log(
      'Usage: pnpm tsx scripts/build-idml-canonical-bundle.ts <path-to-idml-or-manifest.json> [--out=./file.json] [--title=...] [--slug=...] [--editionId=...] [--publishDate=...]',
    );
    process.exit(help ? 0 : 1);
  }

  const inputPath = path.resolve(positional[0]);
  const outputPath = path.resolve(options.out || defaultOutputPath(inputPath));
  const manifest = await loadManifest(inputPath);
  const bundle = buildCanonicalBundleFromManifest(manifest, {
    title: options.title,
    slug: options.slug,
    editionId: options.editionId,
    publishDate: options.publishDate,
    themeVariant: options.themeVariant,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

  console.log(`Canonical bundle written: ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        editionId: bundle.edition.id,
        slug: bundle.edition.slug,
        title: bundle.edition.title,
        pages: bundle.summary.pageCount,
        slots: bundle.summary.slotCount,
        stories: bundle.stories.length,
        placedStories: bundle.summary.placedStoryCount,
        assets: bundle.summary.assetCount,
        warnings: bundle.summary.warnings.length,
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
