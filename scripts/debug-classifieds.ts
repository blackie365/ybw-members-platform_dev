import { execSync } from 'node:child_process';
import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import { getMemberStore } from '@/features/members/server';

/**
 * One-off diagnostics for the classifieds enrichment rollout.
 */

function sh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 20000 }).trim();
  } catch (err) {
    return `(error: ${(err as Error).message.split('\n')[0]})`;
  }
}

async function main() {
  console.log('=== appdir ===');
  console.log('HEAD:', sh('git rev-parse --short HEAD'));
  const classifieds = sh('grep -c "resolveBio" src/features/magazine/domain/classifieds.ts');
  console.log('classifieds.ts resolveBio matches:', classifieds);
  const bake = sh('grep -c "entries" scripts/bake-classifieds.ts');
  console.log('bake-classifieds.ts present:', bake);

  console.log('=== latest reader edition ===');
  const read = getMagazineReadStore();
  const editions = await read.listReaderEditions(1);
  const edition = editions[0] ?? null;
  if (!edition) {
    console.log('no editions found');
    return;
  }
  console.log('slug:', edition.slug, '| id:', edition.id, '| pages:', edition.pages?.length);
  const cls = (Array.isArray(edition.pages) ? edition.pages : [])
    .find((p) => String((p as { template?: unknown }).template || '').toLowerCase() === 'classifieds');
  if (!cls) {
    console.log('no classifieds page in edition');
    return;
  }
  const content = (cls as { content?: Record<string, unknown> }).content ?? {};
  const entries = Array.isArray(content.entries) ? content.entries : [];
  console.log('classifieds entries:', entries.length);
  console.log('first entry keys:', Object.keys(entries[0] ?? {}).join(','));
  console.log('first entry:', JSON.stringify(entries[0] ?? null));
  console.log('generatedAt:', String(content.generatedAt || ''));

  console.log('=== member_profiles sample (first 3, all fields) ===');
  const members = await getMemberStore().getAllActive();
  for (const m of members.slice(0, 3)) {
    const f = {
      headline: String(m.headline ?? '').slice(0, 40),
      bio: String(m.bio ?? '').slice(0, 40),
      services: Array.isArray(m.services) ? m.services : m.services,
      industrySector: String(m.industrySector ?? ''),
      tags: Array.isArray(m.tags) ? m.tags : m.tags,
      linkedinUrl: String(m.linkedinUrl ?? ''),
    };
    console.log(JSON.stringify(f));
  }
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});