#!/usr/bin/env tsx
/**
 * Strip a finished edition IDML into a REUSABLE BLANK TEMPLATE IDML.
 *
 * PRESERVES (100% intact):
 *   - All Script Labels on frames/spreads (TitleFrame / AdFrame / EditorsFrame / ContentsFrame / BodyFrame)
 *   - Frame geometry (position, size, rotation, corner radius, stroke, fill)
 *   - Master pages, layers, swatches, paragraph/character/object styles, tags
 *   - Page count / spread structure / margins / columns
 *
 * DELETES / BLANKS:
 *   - All text content inside text frames (keeps applied paragraph/character styles on the empty frame)
 *   - All placed graphic/image links (frames stay; image content is removed)
 *   - Linked PDF / audio / video assets
 *
 * Usage:
 *   tsx scripts/strip-idml-to-template.ts <finished-edition.idml> [output.idml]
 *
 * Example:
 *   tsx scripts/strip-idml-to-template.ts ./aug-sep-2026.idml ./oct-nov-2026-TEMPLATE.idml
 */
import { readFileSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { basename, extname, resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: tsx scripts/strip-idml-to-template.ts <input.idml> [output.idml]');
  process.exit(1);
}

const [inputRel, outputRel] = args;
const inputPath = resolve(inputRel);
const defaultOutput = inputPath.replace(
  new RegExp(`${extname(inputRel)}$`),
  '-TEMPLATE.idml',
);
const outputPath = resolve(outputRel || defaultOutput);

console.log(`📥 Reading IDML: ${inputPath}`);
const zip = await JSZip.loadAsync(readFileSync(inputPath));

// ---------------------------------------------------------------------------
// 1. BLANK ALL STORIES — remove every <Content>...</Content> text node inside
//    <Story> files (frame styles + label links live in Spread XML, untouched).
// ---------------------------------------------------------------------------
const storyFileRegex = /^Stories\/Story_?u?[a-f0-9]+\.xml$/i;
let blankedStories = 0;
for (const filePath of Object.keys(zip.files)) {
  if (!storyFileRegex.test(filePath)) continue;
  let xml = await zip.file(filePath)!.async('string');
  // Delete text inside <Content>...</Content> — keep styling tags intact.
  xml = xml.replace(/<Content>[^<]*<\/Content>/g, '<Content/>');
  // Also nuke any lingering XMP metadata / notes content just in case.
  xml = xml.replace(/<Note>[^<]*<\/Note>/g, '<Note/>');
  zip.file(filePath, xml);
  blankedStories++;
}
console.log(`📝 Blanked ${blankedStories} story text files`);

// ---------------------------------------------------------------------------
// 2. BLANK ALL PLACED GRAPHIC LINKS in Spreads / Resources XML:
//    Keep <Rectangle> / <Polygon> / <Oval> / <Frame> geometry + their Labels,
//    but strip the <Link> href + <Image> data reference so frames are empty.
// ---------------------------------------------------------------------------
const spreadRegex = /^Spreads\/Spread_?u?[a-f0-9]+\.xml$/i;
let spreadsTouched = 0;
for (const filePath of Object.keys(zip.files)) {
  if (!spreadRegex.test(filePath)) continue;
  let xml = await zip.file(filePath)!.async('string');
  // Remove <Image> self-closing tag / block bodies (graphic pixel reference).
  xml = xml.replace(/<Image\b[^>]*\/>/g, '');
  xml = xml.replace(/<Image\b[\s\S]*?<\/Image>/g, '');
  // Strip <Link> href attribute inside <Rectangle> / <Polygon> / <Oval> etc.
  xml = xml.replace(/<Link\s+[^>]*>/g, '<Link>');
  // Nuke any <PDF> / <EPS> / <Video> / <Sound> placed content blocks too.
  for (const tag of ['PDF', 'EPS', 'Video', 'Sound', 'Movie', 'AI', 'INDD', 'SWF']) {
    const open = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'g');
    const self = new RegExp(`<${tag}\\b[^>]*\\/>`, 'g');
    xml = xml.replace(open, '').replace(self, '');
  }
  zip.file(filePath, xml);
  spreadsTouched++;
}
console.log(`🖼️  Stripped placed graphics from ${spreadsTouched} spread files`);

// ---------------------------------------------------------------------------
// 3. (Optional but safe) Drop the heavy Resources/Links folder (raw image data
//    references are already broken anyway; InDesign rebuilds it on next open).
// ---------------------------------------------------------------------------
let removedResources = 0;
const resourceRegex = /^Resources\/(Links|Graphics|Embedded)\/.+/i;
for (const filePath of Object.keys(zip.files)) {
  if (resourceRegex.test(filePath)) {
    zip.remove(filePath);
    removedResources++;
  }
}
if (removedResources > 0) console.log(`🧹 Removed ${removedResources} stale raw resource blobs`);

// ---------------------------------------------------------------------------
// 4. Write final template IDML.
// ---------------------------------------------------------------------------
const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(outputPath, buffer);

const beforeKB = Math.round(readFileSync(inputPath).length / 1024);
const afterKB = Math.round(buffer.length / 1024);

console.log(`\n✅ Done! Template saved → ${outputPath}`);
console.log(`   Size: ${beforeKB} KB → ${afterKB} KB (-${Math.round(100 - (afterKB / beforeKB) * 100)}%)`);
console.log(`   Next: 1) Open in InDesign 2) Drop new copy + images 3) Export → IDML 4) Run import-local-idml.ts`);
