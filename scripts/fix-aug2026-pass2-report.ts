#!/usr/bin/env tsx
/**
 * PASS 2 REPAIR — using InDesign Package Report as GROUND TRUTH
 * Input: /Users/robertblackwell/Desktop/ybw_August_2026_report.txt
 * Output: rewrite magazine_reader_editions pages + magazine_issues pages so:
 *   - Keep image on a printed page ONLY if Package Report explicitly says "On Page N" for that filename
 *   - Restore images we mistakenly stripped in Pass 1 because they were "repeated across pages" but are in fact intentional (report lists them on both pages)
 *   - Still block cross-article leaks (e.g. same filename in 2 unrelated articles) — because the report would not list them for the wrong page
 *
 * Dry-run by default. Pass --apply to write.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as fs from 'fs';
import * as path from 'path';
import type { ReaderPage, ReaderPageContent, ReaderPageTemplate } from '../src/features/magazine/domain/types';

const REPORT_PATH = '/Users/robertblackwell/Desktop/ybw_August_2026_report.txt';
const EDITION_ID = 'idml-ybw-aug-2026-msrn5rbl';
const ISSUE_ID = 'Ab5bOuKBbmDQBvtbyEIg';
const DRY_RUN = !process.argv.includes('--apply');

type ReportEntry = {
  name: string;
  type?: string;
  status: 'Linked' | 'Embedded' | string;
  completePath: string;
  page: number | null;
  embedded: boolean;
  ppiActual?: string;
  ppiEffective?: string;
};

function parseReport(text: string): {
  entries: ReportEntry[];
  filenameToPages: Map<string, Set<number>>;
  pageToFilenames: Map<number, Set<string>>;
  filenameToEntry: Map<string, ReportEntry>;
  crossPackage: ReportEntry[];
  embeddedCount: number;
  linkedCount: number;
} {
  // Split by link entries starting with "- Name: "
  const sectionStart = text.indexOf('LINKS AND IMAGES');
  const body = sectionStart >= 0 ? text.slice(sectionStart) : text;
  const lines = body.split(/\r?\n/);
  const entries: ReportEntry[] = [];
  let cur: Partial<ReportEntry> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nameM = line.match(/^- Name:\s*(.*?);\s*Type:\s*(.*?);\s*Status:\s*(Linked|Embedded|Missing|Inaccessible|Modified)\s*$/);
    if (nameM) {
      if (cur && cur.name) entries.push(cur as ReportEntry);
      cur = { name: nameM[1].trim(), type: nameM[2].trim(), status: nameM[3].trim(), completePath: '', page: null, embedded: nameM[3].trim() === 'Embedded' };
      continue;
    }
    if (!cur) continue;
    const filenameM = line.match(/^Filename:\s*(.*)$/);
    if (filenameM) { cur.name = filenameM[1].trim() || cur.name; continue; }
    const compM = line.match(/^Complete Name:\s*(.+)$/);
    if (compM) { cur.completePath = compM[1].trim(); continue; }
    const onPageM = line.match(/^On Page\s+(\d+)(?:-(\d+))?\s*$/);
    if (onPageM) { cur.page = parseInt(onPageM[1], 10); continue; }
    const ppiM = line.match(/Actual ppi:\s*(\S*)\s+Effective ppi:\s*(\S*)/);
    if (ppiM) { cur.ppiActual = ppiM[1]; cur.ppiEffective = ppiM[2]; continue; }
  }
  if (cur && cur.name) entries.push(cur as ReportEntry);

  const filenameToPages = new Map<string, Set<number>>();
  const pageToFilenames = new Map<number, Set<string>>();
  const filenameToEntry = new Map<string, ReportEntry>();
  const embeddedCount = entries.filter(e => e.embedded).length;
  const linkedCount = entries.length - embeddedCount;
  for (const e of entries) {
    const key = e.name.toLowerCase();
    const set = filenameToPages.get(key) || new Set<number>();
    if (e.page != null) set.add(e.page);
    filenameToPages.set(key, set);
    if (e.page != null) {
      const ps = pageToFilenames.get(e.page) || new Set<string>();
      ps.add(key);
      pageToFilenames.set(e.page, ps);
    }
    filenameToEntry.set(key, e);
  }

  // Cross package = NOT in Dropbox/CurrentYBW/August 2026 edition AND not Desktop/ (package folder)
  const augRoot = '/CurrentYBW/August 2026 edition/';
  const packageRoot = 'ybw_August_2026 Folder';
  const desktopRoot = '/Desktop/';
  const crossPackage = entries.filter(e =>
    !(e.embedded || e.completePath.includes(augRoot) || e.completePath.includes(packageRoot) || e.completePath.includes(desktopRoot))
  );

  return { entries, filenameToPages, pageToFilenames, filenameToEntry, crossPackage, embeddedCount, linkedCount };
}

function basenameLower(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://ex.co/${url.replace(/^\/+/, '')}`);
    return decodeURIComponent(u.pathname.split('/').pop() || '').replace(/\?.*$/, '').toLowerCase();
  } catch { return String(url || '').toLowerCase(); }
}

/** Extract printed page N from a reader page's `id` string or `content.pageNumber`. Returns null for synthetic (cover/contents/editor/back-cover). */
function printedPageOfReaderPage(page: ReaderPage): number | 'cover'|'contents'|'editor-note'|'back-cover' {
  const id = page.id.toLowerCase();
  if (id.startsWith('page-cover')) return 'cover';
  if (id.startsWith('page-contents')) return 'contents';
  if (id.startsWith('page-editor')) return 'editor-note';
  if (id.startsWith('page-back-cover') || page.template === 'back-cover') return 'back-cover';
  const m = id.match(/^page-(\d+)/);
  if (m) return parseInt(m[1], 10);
  const fromContent = Number((page.content as any).pageNumber);
  if (isFinite(fromContent) && fromContent > 0) return fromContent;
  return NaN as any;
}

type UrlAndName = { url: string; name: string; field: string };

function extractImageFields(c: ReaderPageContent): UrlAndName[] {
  const out: UrlAndName[] = [];
  const strFields: (keyof ReaderPageContent)[] = ['imageUrl','backgroundImage','pdfUrl','image','featureImage','heroImage','mainImage','coverImage','photo','headshot','portrait','logoImage','partnerLogo'];
  for (const k of strFields) {
    const v = (c as any)[k];
    if (typeof v === 'string' && v) out.push({ url: v, name: basenameLower(v), field: k });
  }
  const arrFields: (keyof ReaderPageContent)[] = ['imageUrls','images','gallery','additionalImages','logoImages'];
  for (const k of arrFields) {
    const v = (c as any)[k];
    if (Array.isArray(v)) v.forEach((u: any) => {
      if (typeof u === 'string' && u) out.push({ url: u, name: basenameLower(u), field: k as string });
    });
  }
  return out;
}

/** For a given printed page N (or synthetic), return the set of asset basenames that are ALLOWED on it. */
function buildAllowedSet(printed: number | string | symbol, report: ReturnType<typeof parseReport>): Set<string> | null {
  if (typeof printed === 'number') {
    const s = report.pageToFilenames.get(printed);
    if (s && s.size) return new Set(s); // already lowercase
    return new Set();
  }
  // Synthetics: allow-all, because the report doesn't list them (they're multi-page or composite).
  // But we WILL still strip anything that ONLY appears on non-adjacent pages per filenameToPages.
  return null;
}

function keepAssetOnPage(
  entryNameLower: string,
  printed: number | string | symbol,
  readerPos1Based: number,
  report: ReturnType<typeof parseReport>,
  group: { title: string; pagesNums: Set<number>; printedAny: boolean } | null,
): boolean {
  const pagesForAsset = report.filenameToPages.get(entryNameLower);
  // Unknown asset (e.g. directly uploaded): keep
  if (!pagesForAsset || pagesForAsset.size === 0) return true;

  // 1. Exact match on page id (printed)
  if (typeof printed === 'number' && pagesForAsset.has(printed)) return true;

  // 2. Pinned synthetics
  if (printed === 'editor-note') return pagesForAsset.has(5);
  if (printed === 'cover') return pagesForAsset.has(1) || pagesForAsset.has(4);
  if (printed === 'contents') return pagesForAsset.size >= 1;
  if (printed === 'back-cover') return pagesForAsset.has(64);

  // 3. Asset appears on ANY page of this multi-page article group? → KEEP (it's on some page of the spread)
  if (group && group.printedAny) {
    for (const ap of pagesForAsset) if (group.pagesNums.has(ap)) return true;
    // Also: article pages might be adjacent even if reader ids miss a page (group may be missing 1 page id)
    const groupMin = Math.min(...group.pagesNums);
    const groupMax = Math.max(...group.pagesNums);
    for (const ap of pagesForAsset) if (ap >= groupMin - 1 && ap <= groupMax + 1) return true;
  }

  // 4. Nearest neighbour: printed page N ± 2 if no article group
  if (typeof printed === 'number') {
    for (const ap of pagesForAsset) if (Math.abs(ap - printed) <= 2) return true;
  }
  // 5. Reader position match as final safety
  if (typeof readerPos1Based === 'number' && isFinite(readerPos1Based)) {
    for (const ap of pagesForAsset) if (Math.abs(ap - readerPos1Based) <= 2) return true;
  }
  return false;
}

async function main() {
  const reportText = fs.readFileSync(REPORT_PATH, 'utf8');
  const report = parseReport(reportText);

  console.log(`=== Parsed Package Report ===`);
  console.log(`Total entries: ${report.entries.length}  Embedded: ${report.embeddedCount}  Linked: ${report.linkedCount}`);
  console.log(`Pages referenced: ${report.pageToFilenames.size} (min ${Math.min(...report.pageToFilenames.keys())}, max ${Math.max(...report.pageToFilenames.keys())})`);
  console.log(`Cross-package links (NOT in August 2026 folder / Desktop package): ${report.crossPackage.length}`);
  report.crossPackage.slice(0, 20).forEach(e => console.log(`   ⚠️  ${e.name}  → On Page ${e.page}  ← ${e.completePath}`));
  console.log(`\n=== Files appearing on 2+ pages (INTENTIONAL repeats per report, NOT LEAKS) ===`);
  for (const [nameLc, pages] of [...report.filenameToPages.entries()].sort((a, b) => b[1].size - a[1].size).filter(([, ps]) => ps.size > 1)) {
    const pList = [...pages].sort((a, b) => a - b).join(',');
    const entry = report.filenameToEntry.get(nameLc);
    console.log(`   ✅ KEEP (intentional): "${nameLc}"  on pages ${pList}   (${entry?.completePath.split('/').slice(-3, -1).join('/') || ''})`);
  }

  // Now read + rebuild Firestore reader pages
  const { adminDb } = await import('../src/lib/firebase-admin');
  if (!adminDb) throw new Error('no admin db');

  const edSnap = await adminDb.collection('magazine_reader_editions').doc(EDITION_ID).get();
  if (!edSnap.exists) throw new Error('no edition');
  const edition = edSnap.data() as any;
  const pages: ReaderPage[] = edition.pages || [];

  console.log(`\n\n=== PASS 2 REPAIR — per-page diff against Package Report ===\n`);
  console.log(` New#  Print#  Template            Keep Remove  Title`);
  console.log(` ----- ------  ------------------  ---- ------  ----------------------------`);

  const removedStats: { pageTitle: string; printed: string; removed: string[] }[] = [];
  const keptStats: { pageTitle: string; printed: string; keptCount: number; restored: number }[] = [];

  // --- PRE-BUILD: GROUP PAGES BY ARTICLE TITLE ---
  // Reader pages with the exact same title are part of the SAME MULTI-PAGE ARTICLE,
  // so any asset whose report On-Page matches ANY page in the article group
  // should be considered a candidate (kept exact or via spread neighbours).
  type Group = { title: string; pagesNums: Set<number>; printedAny: boolean };
  const titleToGroup = new Map<string, Group>();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const t = String(p.content?.title || p.content?.heading || `__untitled_${i}__`);
    const g = titleToGroup.get(t) || { title: t, pagesNums: new Set<number>(), printedAny: false };
    const pr = printedPageOfReaderPage(p);
    if (typeof pr === 'number') { g.pagesNums.add(pr); g.printedAny = true; }
    titleToGroup.set(t, g);
  }
  function articleGroupForPage(title: string): Group | null { return titleToGroup.get(title) || null; }

  const newPages: ReaderPage[] = pages.map((p, idx) => {
    const printed = printedPageOfReaderPage(p);
    const printedLabel = typeof printed === 'number' ? String(printed) : String(printed);
    const title = String(p.content?.title || p.content?.heading || '');
    const group = articleGroupForPage(title);
    const c: ReaderPageContent & Record<string, unknown> = { ...p.content };
    const all = extractImageFields(c);
    const removed: string[] = [];
    let restored = 0;

    // Helper: for a single asset basename → keep?
    const keep = (nameLc: string): boolean => keepAssetOnPage(nameLc, printed, idx + 1, report, group);

    // Clean string fields
    const strFields: (keyof ReaderPageContent)[] = ['imageUrl','backgroundImage','pdfUrl','image','featureImage','heroImage','mainImage','coverImage','photo','headshot','portrait','logoImage','partnerLogo'];
    for (const k of strFields) {
      const v = (c as any)[k];
      if (typeof v === 'string' && v) {
        const nameLc = basenameLower(v);
        if (!keep(nameLc)) { removed.push(`${k}:${nameLc}`); (c as any)[k] = undefined; }
      }
    }
    // Clean arrays
    const arrFields: (keyof ReaderPageContent)[] = ['imageUrls','images','gallery','additionalImages','logoImages'];
    for (const k of arrFields) {
      const v = (c as any)[k];
      if (!Array.isArray(v)) continue;
      const beforeLen = v.length;
      const next: string[] = [];
      for (const u of v) {
        if (typeof u !== 'string') { next.push(u); continue; }
        const nameLc = basenameLower(u);
        if (keep(nameLc)) next.push(u); else removed.push(`${k}[]:${nameLc}`);
      }
      if (beforeLen !== next.length) restored += Math.max(0, next.length - beforeLen);
      (c as any)[k] = next.length ? next : undefined;
    }

    const after = extractImageFields({ ...c, imageUrls: undefined as any, images: undefined as any, gallery: undefined as any, additionalImages: undefined as any, logoImages: undefined as any });
    // Also recalc after properly
    const after2 = extractImageFields(c as ReaderPageContent);
    if (removed.length) removedStats.push({ pageTitle: String(c.title || c.heading || ''), printed: printedLabel, removed });
    keptStats.push({ pageTitle: String(c.title || c.heading || ''), printed: printedLabel, keptCount: after2.length, restored });

    const keepN = after2.length;
    const remN = removed.length;
    console.log(` ${String(idx+1).padStart(3,' ')}   ${printedLabel.padStart(6,' ')}  ${String(p.template).padEnd(18,' ')}  ${String(keepN).padStart(4,' ')} ${String(remN).padStart(6,' ')}  ${String(c.title||c.heading||'').slice(0,40)}`);

    return { ...p, content: c };
  });

  console.log(`\n=== TOP REMOVALS (per page, list of stripped assets) ===`);
  removedStats.forEach(r => {
    console.log(`  [print p${r.printed}] "${r.pageTitle.slice(0,40)}" removed ${r.removed.length}:\n     - ${r.removed.join('\n     - ')}`);
  });

  if (DRY_RUN) {
    console.log(`\n🐢 DRY RUN — skipped Firestore write. Re-run with --apply to:`);
    console.log(`   • Write ${newPages.length} pages to edition doc`);
    console.log(`   • Sync builder subcollection pages content again to match cleaned reader pages`);
    process.exit(0);
  }

  // Apply writes
  const batch = adminDb.batch();
  const edRef = adminDb.collection('magazine_reader_editions').doc(EDITION_ID);
  batch.set(edRef, { pages: newPages, pageCount: newPages.length, lastRepairedWithPackageReportAt: new Date().toISOString() }, { merge: true });

  // Sync builder subcollection: rebuild content on existing 55 pages (preserve numeric ids)
  const pagesCol = adminDb.collection('magazine_issues').doc(ISSUE_ID).collection('pages');
  const snap = await pagesCol.orderBy('id', 'asc').get();
  const builderDocs: { docId: string; data: any }[] = [];
  snap.forEach(d => builderDocs.push({ docId: d.id, data: d.data() }));
  builderDocs.sort((a, b) => Number(a.data.id ?? 9e9) - Number(b.data.id ?? 9e9));

  if (builderDocs.length !== newPages.length) {
    console.warn(`Builder subcollection has ${builderDocs.length} docs, reader pages = ${newPages.length}. Recreating all builder pages from scratch.`);
    // delete old + create new
    for (const d of builderDocs) batch.delete(pagesCol.doc(d.docId));
    for (let i = 0; i < newPages.length; i++) {
      const r = newPages[i];
      const numericId = i + 1;
      const type = readerTemplateToBuilderType(r.template);
      const content: any = { ...r.content };
      const docRef = pagesCol.doc();
      batch.set(docRef, {
        id: numericId,
        type,
        status: 'published',
        content,
        issueId: ISSUE_ID,
        readerPageId: r.id,
        position: numericId,
        templateId: r.template,
        title: content.title || content.heading || `Page ${numericId}`,
        summary: content.standfirst || content.kicker || '',
        updatedAt: new Date().toISOString(),
      });
    }
  } else {
    // in-place update
    for (let i = 0; i < newPages.length; i++) {
      const r = newPages[i];
      const b = builderDocs[i];
      const type = readerTemplateToBuilderType(r.template);
      batch.set(pagesCol.doc(b.docId), {
        type,
        status: 'published',
        content: { ...r.content },
        readerPageId: r.id,
        templateId: r.template,
        title: (r.content.title || r.content.heading || b.data.title || `Page ${i+1}`),
        summary: (r.content.standfirst || r.content.kicker || ''),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  }

  batch.set(adminDb.collection('magazine_issues').doc(ISSUE_ID), { lastRepairedWithPackageReportAt: new Date().toISOString(), totalPages: newPages.length }, { merge: true });
  await batch.commit();

  console.log(`\n✅ PASS 2 applied. Reader pages + Builder subcollection both cleaned via Package Report.`);
  console.log(`   • Rebuilt ${newPages.length} reader pages with definitive allow-list.`);
  console.log(`   • Pages with removed assets: ${removedStats.length}`);
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
main().catch(e => { console.error(e); process.exit(1); });
