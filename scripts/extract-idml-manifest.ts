import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildIdmlManifestFromFile } from '@/features/magazine/importers/idml-manifest';

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let outputPath: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--out=')) {
      outputPath = arg.slice('--out='.length);
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      return { help: true, positional, outputPath };
    }

    positional.push(arg);
  }

  return { help: false, positional, outputPath };
}

function defaultOutputPath(inputPath: string): string {
  const fileName = path.basename(inputPath).replace(/\.idml$/i, '.manifest.json');
  return path.join(process.cwd(), 'data', 'magazine', 'idml-manifests', fileName);
}

async function main() {
  const { help, positional, outputPath } = parseArgs(process.argv.slice(2));

  if (help || positional.length === 0) {
    console.log('Usage: pnpm tsx scripts/extract-idml-manifest.ts <path-to-idml> [--out=/absolute/or/relative/output.json]');
    process.exit(help ? 0 : 1);
  }

  const inputPath = path.resolve(positional[0]);
  const manifest = await buildIdmlManifestFromFile(inputPath);
  const resolvedOutputPath = path.resolve(outputPath || defaultOutputPath(inputPath));

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await fs.writeFile(resolvedOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Manifest written: ${resolvedOutputPath}`);
  console.log(
    JSON.stringify(
      {
        document: manifest.document.name,
        pages: manifest.document.pageCount,
        spreads: manifest.document.spreadCount,
        stories: manifest.document.storyCount,
        assets: manifest.assets.length,
        candidateStories: manifest.stories.filter((story) => story.candidateForStoryPool).length,
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
