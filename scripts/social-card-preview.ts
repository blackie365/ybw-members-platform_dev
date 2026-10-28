/**
 * DRY RUN — social card preview generator.
 *
 * Renders the shared YBW card for the most recent Ghost posts so the design can
 * be reviewed locally. NOTHING IS POSTED anywhere.
 *
 * Run with:  npx tsx scripts/social-card-preview.ts
 *
 * The rendering itself lives in src/features/social/server/card-renderer.ts and
 * is shared with the live queueing job, so previews always match production.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { fetchRecentPosts, renderCard, LAYOUTS } from '../src/features/social/server/card-renderer';

const OUT_DIR = path.join('scripts', 'social-preview');

function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

async function main() {
  console.log('DRY RUN — generating social card previews. Nothing will be posted.\n');

  const posts = await fetchRecentPosts(3);
  if (!posts.length) {
    throw new Error('No posts returned from Ghost — check the content API key and base URL.');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Clear stale previews so the folder always reflects the latest run.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  for (const post of posts) {
    for (const layout of Object.values(LAYOUTS)) {
      const buf = await renderCard(post, layout);
      const file = path.join(OUT_DIR, `${slugify(post.title)}-${layout.key}.png`);
      fs.writeFileSync(file, buf);
      console.log(`✓ ${file}`);
    }
    console.log(`    "${post.title}"`);
  }

  console.log(`\nDone. Previews written to ${OUT_DIR}/ — nothing was posted.`);
}

main().catch((err) => {
  console.error('Preview generation failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
