import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { getMemberStore } from '../src/features/members/server';

/**
 * Export the newsletter recipient list exactly as the weekly send would use it:
 * the union of homepage popup sign-ups (isNewsletterRecipient) and registered
 * active members (userInactive !== true), deduplicated by email.
 *
 * Output: /tmp/ybw-newsletter-recipients-<date>.txt (one email per line, 644
 * so the deploy runner user can scp it off the box).
 *
 * Run via .github/workflows/magazine-maintenance.yml (tsx as www-data with the
 * prod .env.local on the VPS) — same store/deps as src/lib/newsletter-send.ts.
 */
async function exportNewsletterRecipients() {
  const allMembers = await getMemberStore().getAll();
  console.log(`Loaded ${allMembers.length} member profiles.\n`);

  const seen = new Set<string>();
  let popupCount = 0;
  let activeCount = 0;

  for (const m of allMembers as any[]) {
    const isPopup = m.isNewsletterRecipient === true;
    const isActive = m.userInactive !== true;
    if (isPopup) popupCount += 1;
    if (isActive) activeCount += 1;
    if (!(isPopup || isActive)) continue;

    const raw = m.email;
    if (typeof raw !== 'string') continue;
    const e = raw.trim().toLowerCase();
    if (!e || !e.includes('@')) continue;
    seen.add(e);
  }

  const emails = Array.from(seen).sort();

  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(os.tmpdir(), `ybw-newsletter-recipients-${stamp}.txt`);
  fs.writeFileSync(outPath, emails.join('\n') + '\n', 'utf8');
  fs.chmodSync(outPath, 0o644);

  console.log(`Homepage popup sign-ups flagged : ${popupCount}`);
  console.log(`Registered active members       : ${activeCount}`);
  console.log(`Unique recipients               : ${emails.length}`);
  console.log(`\nWrote ${outPath}`);
  console.log(`\nFirst 5:\n${emails.slice(0, 5).map((e) => `  ${e}`).join('\n')}`);
}

exportNewsletterRecipients().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});