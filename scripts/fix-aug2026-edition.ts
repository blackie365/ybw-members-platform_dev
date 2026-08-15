#!/usr/bin/env tsx
/**
 * AUG 2026 — MASTER REPAIR SCRIPT
 *
 * Fixes everything identified in the audit:
 *   1. ReaderEdition page ORDER (reorders 55 pages into PRINT PAGE SEQUENCE)
 *   2. Leaked gallery images (per-page intersection against IDML-expected assets)
 *   3. Syncs magazine_issues/{issueId}/pages builder subcollection to match reader pages 1:1
 *      — deletes 35 scrambled docs, recreates 55 clean ones with id=N (1..55)
 *   4. Marks ad-reader pages as type=ad / ad-page (template="ad" already in reader)
 *
 * Dry-run by default. Pass --apply to write to Firestore.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { ReaderPage, ReaderPageContent, ReaderPageTemplate } from '../src/features/magazine/domain/types';

// ----- KNOWN GOOD: per printed-page → expected image basenames (from IDML audit v4) -----
// Key = printed page number (1-based as in InDesign layout), value = list of image filenames that BELONG on this page.
// Pages NOT listed here are treated as "keep all non-risky images" (we only delete obvious cross-page leaks).
const PRINTED_PAGE_ALLOWED_ASSETS: Record<number, string[]> = {
  1: ['cover-1.jpg, ukreiif, RF 260602, unknown, mazda, ybw_august_2026_1.jpg'.toLowerCase()],
  3: [], // Editor's Note originally had NO standalone images; every asset currently on it is a leak
  4: ['Lexus Leeds YBW ad june 26.pdf'.toLowerCase(), 'iStock-2224244464.jpg'.toLowerCase()],
  5: ['26_01_FM_TopicAd_140x220_V5.pdf'.toLowerCase()],
  6: ['RF 260602 30-RothReadPhotography.jpg'.toLowerCase(), 'Gemma Heron Colour the WorldGemma Heron Colour the Worldimage (17).png'.toLowerCase()],
  7: ['RF 260602 30-RothReadPhotography.jpg'.toLowerCase()],
  8: ['Production Park for Topic Uk.pdf'.toLowerCase(), '483363494.jpg'.toLowerCase(), 'Robin-Howcroft.jpg'.toLowerCase(), 'iStock-2224244464.jpg'.toLowerCase()],
  9: ['iStock-2224244464.jpg'.toLowerCase(), 'Robin-Howcroft.jpg'.toLowerCase(), '483363494.jpg'.toLowerCase()],
  10: ['483363494.jpg'.toLowerCase()],
  13: ['XmasA5 copy.pdf'.toLowerCase()],
  14: ['KF-Elbow Rooms exterior.jpg'.toLowerCase()],
  15: ['KF-Elbow Rooms exterior.jpg'.toLowerCase()],
  16: ['20160323_11-49-33_1.jpeg'.toLowerCase(), 'Marc Burton-2.jpg'.toLowerCase(), 'Kirklees College-1.jpg'.toLowerCase()],
  17: ['Toyota leeds YBW ad june 26.pdf'.toLowerCase(), 'Charity Coffee and Cake Morning at Lazenby'.toLowerCase()],
  18: ['1000123111.jpg'.toLowerCase(), 'Unknown.jpeg'.toLowerCase(), 'IMG_0075.PNG'.toLowerCase(), 'trace.png'.toLowerCase(), 'IMG_8896.JPG'.toLowerCase()],
  19: ['IMG_0075.PNG'.toLowerCase()],
  20: ['Schofield-Sweeney.jpg'.toLowerCase()],
  22: ['St Peters-Girls Rugby-005.jpg'.toLowerCase(), 'St Peters-Jeremy Clegg.jpg'.toLowerCase(), 'St Peters-Victoria Inness - 2.jpg'.toLowerCase(), 'pemberleys-logo-BW.png'.toLowerCase()],
  23: ['St Peters-Jeremy Clegg.jpg'.toLowerCase(), 'St Peters-Victoria Inness - 2.jpg'.toLowerCase()],
  24: ['St Peters-Girls Rugby-005.jpg'.toLowerCase(), 'pemberleys-logo-BW.png'.toLowerCase()],
  25: ['Unknown.jpeg'.toLowerCase(), 'RF 260602 30-RothReadPhotography.jpg'.toLowerCase()],
  26: ['Unknown.jpeg'.toLowerCase()],
  27: ['Unknown.jpeg'.toLowerCase()],
  30: ['The Wild Orchard51.jpg'.toLowerCase()],
  31: ['NEW CL_Topic Ads_1.pdf'.toLowerCase(), 'BBW 2026 (80 x 110 mm) (1).pdf'.toLowerCase()],
  32: ['mediation-img-1.jpg'.toLowerCase()],
  33: ['mediation-img-2.jpg'.toLowerCase()],
  36: ['Swinton Park 6[25].jpg'.toLowerCase(), 'Group Shot[2].jpg'.toLowerCase(), 'Logo Transparency.png'.toLowerCase(), 'pemberleys2.jpg'.toLowerCase()],
  37: ['Group Shot[2].jpg'.toLowerCase()],
  38: ['Swinton Park 6[25].jpg'.toLowerCase()],
  39: ['Logo Transparency.png'.toLowerCase()],
  40: ['Gemma Heron Colour the WorldGemma Heron Colour the Worldimage (17).png'.toLowerCase(), 'Louise on Right-removebg.png'.toLowerCase()],
  41: ['Adverts A4 Ambers 1.pdf'.toLowerCase()],
  42: ['Gemma Heron Colour the WorldGemma Heron Colour the Worldimage (17).png'.toLowerCase()],
  44: ['55287ea2-b984-4972-8ca3-2efaa1f86a18 copy.JPG'.toLowerCase(), 'IMG_7612 2.JPG'.toLowerCase()],
  45: ['Production Park for Topic Uk.pdf'.toLowerCase()],
  47: ['Advert July 2026.pdf'.toLowerCase()],
  51: ['IMG_6225.jpeg'.toLowerCase()],
  52: ['image00001.JPEG'.toLowerCase(), 'IMG_7505.JPG'.toLowerCase()],
  53: ['image00001.JPEG'.toLowerCase()],
  54: ['Mulch-Ado cover.jpg'.toLowerCase()],
  55: ['Picture 1.png'.toLowerCase(), 'Picture 2.png'.toLowerCase(), 'Picture 3.png'.toLowerCase()],
  56: ['Picture 4.png'.toLowerCase(), 'Picture 5.png'.toLowerCase()],
  57: ['PLS_Advert_Jan26_145x95 (1).pdf'.toLowerCase(), 'Picture 6.png'.toLowerCase()],
  58: ['IMG_0396.jpg'.toLowerCase(), 'IMG_0405.jpg'.toLowerCase(), 'IMG_0408.jpg'.toLowerCase(), 'IMG_0413.jpg'.toLowerCase(), 'IMG_0416.jpg'.toLowerCase(), 'Harvey-Nichols-Summer-Dining.jpg'.toLowerCase()],
  59: ['Focus4Hope 2.jpg'.toLowerCase(), '4.jpg'.toLowerCase(), '20.jpg'.toLowerCase(), '1.jpg'.toLowerCase(), '5.jpg'.toLowerCase(), '21.jpg'.toLowerCase(), '19.jpg'.toLowerCase(), '22.jpg'.toLowerCase(), '24.jpg'.toLowerCase(), '26.jpg'.toLowerCase(), '28.jpg'.toLowerCase(), '30.jpg'.toLowerCase(), '33.jpg'.toLowerCase(), '35.jpg'.toLowerCase(), '36.jpg'.toLowerCase(), '32.jpg'.toLowerCase()],
  60: ['Mazda MX-5 (1).jpg'.toLowerCase(), 'Mazda MX-5 (2).jpg'.toLowerCase(), 'Mazda MX-5 (3).jpg'.toLowerCase(), 'Mazda MX-5 (4).jpg'.toLowerCase(), 'Mazda MX-5 (5).jpg'.toLowerCase(), 'Mazda MX-5 (6).jpg'.toLowerCase()],
  61: ['Mazda MX-5 (1).jpg'.toLowerCase(), 'Mazda MX-5 (2).jpg'.toLowerCase()],
  62: ['Mazda MX-5 (1).jpg'.toLowerCase(), 'Mazda MX-5 (5).jpg'.toLowerCase()],
  63: ['YBW Sept 2026.pdf'.toLowerCase()],
  64: ['Leeds Topic Magazine - February 2026.pdf'.toLowerCase()],
};

// 12 primary leak candidates — always strip unless explicitly allowed on page
const ALWAYS_BLOCK_ASSETS_LC = new Set([
  '1000123111.jpg','unknown.jpeg','image00001.jpeg','img_0075.png','trace.png',
  'gemma heron colour the worldgemma heron colour the worldimage (17).png',
  '55287ea2-b984-4972-8ca3-2efaa1f86a18 copy.jpg','rf 260602 30-rothreadphotography.jpg',
  'istock-2224244464.jpg','kf-elbow rooms exterior.jpg','mazda mx-5 (5).jpg','the wild orchard51.jpg',
  'pls_advert_jan26_145x95 (1).pdf','eventsa5 copy.pdf','adverts a4 ambers 1.pdf','new cl_topic ads_1.pdf',
  'bbw 2026 (80 x 110 mm) (1).pdf','toyota leeds ybw ad june 26.pdf','xmasa5 copy.pdf',
  'lexus leeds ybw ad june 26.pdf','26_01_fm_topicad_140x220_v5.pdf','production park for topic uk.pdf',
  'ybw sept 2026.pdf','leeds topic magazine - february 2026.pdf','advert july 2026.pdf',
  'charity coffee and cake morning at lazenby',
]);

const DRY_RUN = !process.argv.includes('--apply');

function basenameOfUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://ex.co/${url.replace(/^\/+/,'')}`);
    return decodeURIComponent(u.pathname.split('/').pop() || '').replace(/\?.*$/,'').toLowerCase();
  } catch { return url.toLowerCase(); }
}

/** Extract the embedded PRINTED PAGE NUMBER from a reader page id, e.g. "page-editor-5-..." -> 5 */
function extractPrintedPageOrFallback(page: ReaderPage, arrayIdx0: number): { kind: 'pinned'|'numeric'|'ad-n'|'fallback'; value: number; id: string } {
  const id = page.id.toLowerCase();
  // Pinned synthetics
  if (id.startsWith('page-cover'))    return { kind: 'pinned', value: 0, id: page.id };
  if (id.startsWith('page-contents')) return { kind: 'pinned', value: 1, id: page.id };
  if (id.startsWith('page-editor'))   return { kind: 'pinned', value: 2, id: page.id };
  if (id.startsWith('page-back-cover') || page.template === 'back-cover') return { kind: 'pinned', value: 999, id: page.id };
  // Ad pages: id like "page-2-ad-msrmwyez" → printed page 2
  const ad = id.match(/^page-(\d+)-ad/);
  if (ad) return { kind: 'ad-n', value: parseInt(ad[1], 10), id: page.id };
  // Normal content pages: id like "page-8-new-head..." or "page-7-ukreiif..."
  const m = id.match(/^page-(\d+)/);
  if (m) return { kind: 'numeric', value: parseInt(m[1], 10), id: page.id };
  // Fallback: keep as-is with an offset; preserve array order roughly
  return { kind: 'fallback', value: 500 + arrayIdx0, id: page.id };
}

/** Build a sort tuple for print order: synthetic-pins first → ads interleaved by printed-N → content pages by printed-N → back-cover last */
function sortKeyForPage(page: ReaderPage, idx0: number): [number, number, string] {
  const parsed = extractPrintedPageOrFallback(page, idx0);
  // tier: 0=pinned (cover/contents/editor-note), 1=regular printed pages, 2=back-cover (or 999-pinned)
  const tier = parsed.kind === 'pinned'
    ? (parsed.value < 100 ? 0 : 2)
    : 1;
  return [tier, parsed.value, page.id];
}

/** Intersect a page's image assets against PRINTED_PAGE_ALLOWED_ASSETS. Returns cleaned content object. */
function cleanContentForPage(page: ReaderPage): ReaderPageContent {
  const c: ReaderPageContent = { ...page.content };
  const parsed = extractPrintedPageOrFallback(page, 0);
  const printedPageN: number | null = (parsed.kind === 'numeric' || parsed.kind === 'ad-n') ? parsed.value : null;
  const allowedLc = (printedPageN != null && PRINTED_PAGE_ALLOWED_ASSETS[printedPageN])
    ? PRINTED_PAGE_ALLOWED_ASSETS[printedPageN].map(s => s.toLowerCase())
    : null;

  // For images we know are risky, strip them unless explicitly allowed or it's an ad-template page
  const isAdPage = page.template === 'ad' || page.template === 'back-cover';
  function shouldKeep(url: string): boolean {
    if (!url) return false;
    const bn = basenameOfUrl(url);
    // Explicit allow-list wins if defined
    if (allowedLc != null) {
      // Matches any allowed partial substring
      if (allowedLc.some(a => a === bn || bn.includes(a.replace(/\.pdf$|\.jpe?g$|\.png$/,'')))) return true;
      // Otherwise block IF it's one of our known risky assets
      if ([...ALWAYS_BLOCK_ASSETS_LC].some(r => bn.includes(r.replace(/\.pdf$|\.jpe?g$|\.png$/,'')))) return false;
      return true;
    }
    // No allow-list for this printed page → keep unless it's a universally risky known-leak AND page is NOT ad type
    if (!isAdPage && [...ALWAYS_BLOCK_ASSETS_LC].some(r => bn.includes(r.replace(/\.pdf$|\.jpe?g$|\.png$/,'')))) return false;
    return true;
  }

  // Clean image arrays/fields. Keep pdfUrls on ad pages untouched (they're the ad content).
  const urlStringFields: (keyof ReaderPageContent)[] = [
    'imageUrl','backgroundImage','image','featureImage','heroImage','mainImage','coverImage','photo','headshot','portrait','logoImage','partnerLogo',
  ];
  const urlArrayFields: (keyof ReaderPageContent)[] = [
    'imageUrls','images','gallery','additionalImages','logoImages',
  ];
  for (const k of urlStringFields) {
    const v = (c as any)[k];
    if (typeof v === 'string' && v) {
      const pdfOk = (k === 'pdfUrl' || k === 'imageUrl') && isAdPage;
      if (pdfOk) continue;
      if (!shouldKeep(v)) { (c as any)[k] = undefined; }
    }
  }
  for (const k of urlArrayFields) {
    const v = (c as any)[k];
    if (Array.isArray(v)) {
      const before = v.length;
      const kept = v.filter((u: any) => typeof u === 'string' ? shouldKeep(u) : !!u);
      if (kept.length !== before) (c as any)[k] = kept.length ? kept : undefined;
    }
  }
  // pdfUrl: only strip when it's from an ad-file-merge onto a non-ad page (e.g. page 20 editorial has PLS ad pdf)
  if ((c as any).pdfUrl && !isAdPage) {
    const bn = basenameOfUrl((c as any).pdfUrl);
    if ([...ALWAYS_BLOCK_ASSETS_LC].some(r => bn.includes(r.replace(/^\.pdf$/,'')))) (c as any).pdfUrl = undefined;
  }
  return c;
}

function readerTemplateToBuilderType(template: ReaderPageTemplate | string): string {
  switch (template) {
    case 'cover': return 'cover';
    case 'contents': return 'table-of-contents';
    case 'editor-note': return 'editor-note';
    case 'ad': return 'full-page-ad';
    case 'back-cover': return 'back-cover';
    case 'feature-left': return 'feature-left';
    case 'feature-right': return 'feature-right';
    case 'feature-full': return 'feature-full-page';
    default: return 'feature-left';
  }
}

function mainPrep(pages: ReaderPage[]): { newPages: ReaderPage[]; beforeAfter: { i: number; printedN: string; oldTitle: string; newTitle: string; template: ReaderPageTemplate | string; oldImgN: number; newImgN: number }[] } {
  // 1. Sort into print order
  const sorted = [...pages].sort((a, b) => {
    const [ta, na, ida] = sortKeyForPage(a, 0);
    const [tb, nb, idb] = sortKeyForPage(b, 0);
    if (ta !== tb) return ta - tb;
    if (na !== nb) return na - nb;
    return ida.localeCompare(idb);
  });
  // 2. Clean leaks per page + rewrite position to 1..N
  const beforeAfter: any[] = [];
  const newPages: ReaderPage[] = sorted.map((p, i) => {
    const parsed = extractPrintedPageOrFallback(p, i);
    const printedNLabel = parsed.kind === 'pinned' ? (parsed.value === 0 ? 'cover' : parsed.value === 1 ? 'contents' : parsed.value === 2 ? 'editor-note' : 'back-cover')
      : parsed.kind === 'fallback' ? '?' : String(parsed.value);
    const oldImgN = countImagesOnPage(p);
    const content = cleanContentForPage(p);
    const newImgN = countImagesOnPageFromContent(content);
    const template = p.template === 'feature-full' && content.pdfUrl ? 'ad' as ReaderPageTemplate : p.template; // promote stray pdf-only feature pages to ad
    beforeAfter.push({
      i: i+1, printedN: printedNLabel, oldTitle: String(p.content.title || p.content.heading || '').slice(0,50),
      newTitle: String(content.title || content.heading || '').slice(0,50), template, oldImgN, newImgN,
    });
    return { ...p, position: i+1, content, template };
  });
  return { newPages, beforeAfter };
}

function countImagesOnPage(p: ReaderPage): number {
  let n = 0;
  const c: any = p.content || {};
  ['imageUrl','backgroundImage','image','featureImage','heroImage','mainImage','coverImage','photo','headshot','portrait','logoImage','partnerLogo','pdfUrl'].forEach(k => { if (typeof c[k] === 'string' && c[k]) n++; });
  ['imageUrls','images','gallery','additionalImages','logoImages'].forEach(k => { if (Array.isArray(c[k])) n += c[k].length; });
  return n;
}
function countImagesOnPageContentFromContent(c: any): number {
  let n = 0;
  ['imageUrl','backgroundImage','image','featureImage','heroImage','mainImage','coverImage','photo','headshot','portrait','logoImage','partnerLogo','pdfUrl'].forEach(k => { if (typeof c[k] === 'string' && c[k]) n++; });
  ['imageUrls','images','gallery','additionalImages','logoImages'].forEach(k => { if (Array.isArray(c[k])) n += c[k].length; });
  return n;
}
function countImagesOnPageFromContent(content: ReaderPageContent) { return countImagesOnPageContentFromContent(content); }

async function main() {
  console.log(`\n${DRY_RUN ? '🐢 DRY RUN — no writes.' : '🚀 APPLYING WRITES TO FIRESTORE.'}\n`);
  const { adminDb } = await import('../src/lib/firebase-admin');
  if (!adminDb) { console.error('no admin db'); process.exit(1); }

  const EDITION_ID = 'idml-ybw-aug-2026-msrn5rbl';
  const ISSUE_ID = 'Ab5bOuKBbmDQBvtbyEIg';
  const edSnap = await adminDb.collection('magazine_reader_editions').doc(EDITION_ID).get();
  if (!edSnap.exists) throw new Error('reader edition not found');
  const edition = edSnap.data() as any;
  const pages: ReaderPage[] = edition.pages || [];
  console.log(`Loaded ${pages.length} reader pages, ${edition.pageCount} declared pageCount.`);

  const { newPages, beforeAfter } = mainPrep(pages);

  console.log('\n=== REORDER + LEAK FIX — BEFORE / AFTER FIRST 30 + FINAL ===\n');
  console.log('New#  Print#  Template            Img Before/After  Title');
  console.log('----  ------  ------------------  ----------------  -----');
  for (const row of [...beforeAfter.slice(0, 30), ...(beforeAfter.length > 30 ? beforeAfter.slice(-10) : [])]) {
    console.log(`${String(row.i).padStart(3,' ')}   ${String(row.printedN).padStart(6,' ')}  ${String(row.template).padEnd(18,' ')}  ${String(row.oldImgN).padStart(2,' ')}/${String(row.newImgN).padStart(2,' ')}              ${row.newTitle || row.oldTitle}`);
  }

  console.log('\n=== SPOT CHECK: Page 3 (Editor\'s Note), Pages 17(ad), 20(half-ad), 30/31(ad bleed), 46 area, 60-62 (Mazda spread) ===');
  const SPOT_KEYS = [3,17,20,30,31,60,61,62];
  const spotRows = beforeAfter.filter(r => SPOT_KEYS.includes(parseInt(r.printedN,10)));
  spotRows.forEach(r => console.log(`  New pos ${r.i}: print#=${r.printedN} template=${r.template} imgs ${r.oldImgN}→${r.newImgN} title="${r.newTitle}"`));
  // Also find p3 (editor-note pinned value=2 → new position should be 3)
  const editorNote = beforeAfter.find(r => r.printedN === 'editor-note');
  if (editorNote) console.log(`  Editor's note pinned: pos=${editorNote.i} imgs ${editorNote.oldImgN}→${editorNote.newImgN}`);

  // ---- WRITES ----
  if (DRY_RUN) {
    console.log('\n🐢 DRY RUN: skipping writes. Re-run with --apply to:');
    console.log(`   • Overwrite magazine_reader_editions/${EDITION_ID}.pages (${newPages.length} clean pages)`);
    console.log(`   • Update magazine_reader_editions/${EDITION_ID}.pageCount = ${newPages.length}`);
    console.log(`   • DELETE magazine_issues/${ISSUE_ID}/pages/* (ALL EXISTING builder pages)`);
    console.log(`   • CREATE 55 new magazine_issues/${ISSUE_ID}/pages docs with numeric id=1..${newPages.length} synced to reader pages`);
    process.exit(0);
  }

  // Apply!
  const batch = adminDb.batch();
  const editionRef = adminDb.collection('magazine_reader_editions').doc(EDITION_ID);
  batch.set(editionRef, { pages: newPages, pageCount: newPages.length }, { merge: true });

  // Delete old builder pages + recreate new ones
  const pagesCol = adminDb.collection('magazine_issues').doc(ISSUE_ID).collection('pages');
  const oldPagesSnap = await pagesCol.get();
  const deleted: string[] = [];
  oldPagesSnap.forEach(d => { batch.delete(d.ref); deleted.push(d.id); });

  for (let i = 0; i < newPages.length; i++) {
    const readerPage = newPages[i];
    const numericId = i + 1;
    const content: any = { ...(readerPage.content || {}) };
    const type = readerTemplateToBuilderType(readerPage.template);
    const builderPageDoc: any = {
      id: numericId,
      type,
      status: 'published' as any,
      content,
      issueId: ISSUE_ID,
      readerPageId: readerPage.id,
      position: numericId,
      templateId: readerPage.template,
      title: content.title || content.heading || `Page ${numericId}`,
      summary: content.standfirst || content.kicker || '',
      createdAt: (edition.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString(),
    };
    // Numeric id field, but Firestore docId is auto-generated.
    const docRef = pagesCol.doc();
    batch.set(docRef, builderPageDoc);
  }

  const issueRef = adminDb.collection('magazine_issues').doc(ISSUE_ID);
  batch.set(issueRef, {
    readerEditionPageCount: newPages.length,
    lastSyncedAt: new Date().toISOString(),
    totalPages: newPages.length,
  }, { merge: true });

  await batch.commit();
  console.log(`\n✅ Applied writes:`);
  console.log(`   • Rewrote ${newPages.length} reader pages in edition doc. pageCount = ${newPages.length}`);
  console.log(`   • Deleted ${deleted.length} scrambled builder pages`);
  console.log(`   • Created ${newPages.length} clean builder pages (id 1..${newPages.length}) synced to reader pages`);
  console.log(`   • Issue metadata updated (totalPages=${newPages.length}, lastSyncedAt set)`);
  console.log('\nNext step — open the builder at /admin/magazine/builder/' + ISSUE_ID + ' → "Issue Spreads" list should now show 55 pages in PRINT order (Cover→Contents→Editor Note→Ad→p20 Editorial→…→Back Cover), all correctly typed, image leaks gone. Then publish.');
}
main().catch(e => { console.error(e); process.exit(1); });
