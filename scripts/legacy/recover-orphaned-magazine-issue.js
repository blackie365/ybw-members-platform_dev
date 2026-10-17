/**
 * Recover an orphaned magazine_reader_editions document.
 *
 * Discovered during the magazine store-consolidation project: the
 * ReaderEdition doc "idml-ybw-aug-2026-msrn5rbl" (55 pages, "Yorkshire
 * Business Woman — August 2026") points at issueId "Ab5bOuKBbmDQBvtbyEIg",
 * but NO magazine_issues document with that id exists. This makes the
 * edition invisible in the admin builder list (it can never be opened,
 * edited, or promoted to "latest").
 *
 * This script:
 *   1. Creates the missing magazine_issues/{issueId} doc using metadata
 *      from the ReaderEdition (title, slug, coverImage, publishDate),
 *      linked via readerEditionId. isLatest is left false so an admin
 *      reviews/promotes it deliberately.
 *   2. Converts every ReaderEdition page into an editable
 *      magazine_issues/{issueId}/pages/{docId} document (readOnly: false),
 *      and builds matching Story Library items — replicating the exact
 *      mapping already used (and proven in production) by
 *      syncReaderEditionToLegacyIssue in
 *      src/app/actions/magazine/reader-edition-actions.ts, so the result
 *      is indistinguishable from clicking "Sync Published IDML -> Builder".
 *
 * This is idempotent-ish: re-running it will skip issue-doc creation if it
 * already exists, but will ADD another batch of pages/story items if run
 * twice (mirrors the real syncReaderEditionToLegacyIssue behavior, which
 * replaces spreads 1..N — this script does not attempt that replace-range
 * logic since it's meant for exactly this one-time recovery).
 */

require('dotenv')?.config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const ISSUE_ID = 'Ab5bOuKBbmDQBvtbyEIg';
const EDITION_ID = 'idml-ybw-aug-2026-msrn5rbl';

try {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Loaded credentials from serviceAccountKey.json');
  } else {
    throw new Error('serviceAccountKey.json not found');
  }
} catch (e) {
  console.error('❌ Failed to initialize Firebase Admin:', e?.message);
  process.exit(1);
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

function normalizeStoryText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Mirrors src/app/actions/magazine/reader-edition-actions.ts SOURCE_TEMPLATE_TO_PAGE_TYPE
const SOURCE_TEMPLATE_TO_PAGE_TYPE = {
  cover: 'cover',
  contents: 'contents',
  'editor-note': 'editorial',
  'letter-from-editor': 'editorial',
  masthead: 'editorial',
  'news-in-brief': 'column',
  'news-in-brief-page': 'column',
  'news-brief': 'column',
  'feature-full': 'feature-full',
  'feature-left': 'feature-left',
  'feature-right': 'feature-right',
  'two-column': 'column',
  'three-column': 'column',
  'listing-directory': 'partner',
  'directory-page': 'partner',
  'member-profile': 'spotlight',
  gallery: 'lifestyle',
  'gallery-grid': 'lifestyle',
  'photo-essay': 'lifestyle',
  advertisement: 'full-page-ad',
  'full-page-ad': 'full-page-ad',
  ad: 'full-page-ad',
  'sponsor-spotlight': 'partner',
  'back-cover': 'back-cover',
};

function pickImageFromReaderPageContent(content) {
  if (!content || typeof content !== 'object') return '';
  const candidates = [
    content.imageUrl, content.coverImage, content.heroImage, content.featureImage,
    content.mainImage, content.backgroundImage, content.image,
    Array.isArray(content.imageUrls) ? content.imageUrls[0] : undefined,
    Array.isArray(content.images) ? content.images[0] : undefined,
    Array.isArray(content.gallery) ? content.gallery[0] : undefined,
  ];
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
  }
  return '';
}

function slugifyStoryId(text) {
  return (
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || `story-${Math.random().toString(36).slice(2, 8)}`
  );
}

function buildStoryLibraryItemsFromReaderPages(issueId, editionId, readerPages) {
  const now = new Date().toISOString();
  const arr = Array.isArray(readerPages) ? readerPages : [];
  const out = [];
  const usedSlugs = new Set();
  const skipTemplates = new Set(['ad', 'full-page-ad', 'cover', 'contents', 'back-cover']);

  for (let i = 0; i < arr.length; i++) {
    const rp = arr[i];
    const template = String(rp.template || '').toLowerCase();
    const content = rp.content || {};
    if (skipTemplates.has(template)) continue;

    const title = String(content.title || content.headline || content.name || content.brand || rp.title || '').trim();
    if (!title) continue;

    const standfirst = String(content.standfirst || content.subtitle || content.intro || content.description || content.kicker || '').trim() || undefined;
    const author = String(content.author || content.byline || '').trim() || undefined;
    const text = String(content.body || content.text || content.article || content.storyText || '').trim();
    const imageUrl = pickImageFromReaderPageContent(content) || undefined;
    const position = typeof rp.position === 'number' ? rp.position : i + 1;

    let slug = slugifyStoryId(title);
    let n = 2;
    while (usedSlugs.has(slug)) { slug = `${slugifyStoryId(title)}-${n}`; n += 1; }
    usedSlugs.add(slug);

    const id = `${issueId}-library-reader-edition-${editionId}-${String(position).padStart(4, '0')}-${slug}`;
    out.push({
      id,
      title,
      author,
      standfirst,
      text,
      imageUrl,
      includedInPremiumReader: true,
      premiumReaderPriority: position,
      premiumReaderContentType:
        template === 'editor-note' ? 'editorial'
        : (template === 'feature-full' || template === 'feature-left' || template === 'feature-right') ? 'feature'
        : template === 'spotlight' ? 'spotlight'
        : template === 'column' ? 'column'
        : template === 'lifestyle' ? 'lifestyle'
        : template === 'partner' ? 'partner'
        : 'feature',
      premiumReaderPlacementPreference: template,
      sourceRef: `reader-edition:${editionId}:page:${position}`,
      source: { type: 'reader-edition', fileName: '', path: `readerPages[${i}]@${editionId}` },
      createdAt: rp.createdAt || rp.updatedAt || now,
    });
  }
  return out;
}

async function main() {
  const issueRef = db.collection('magazine_issues').doc(ISSUE_ID);
  const issueSnap = await issueRef.get();

  if (issueSnap.exists) {
    console.log(`ℹ️  magazine_issues/${ISSUE_ID} already exists — skipping issue doc creation.`);
  } else {
    const now = new Date().toISOString();
    await issueRef.set({
      id: ISSUE_ID,
      title: 'Yorkshire Business Woman — August 2026',
      slug: 'ybw-aug-2026',
      description: '',
      coverImage:
        'https://storage.googleapis.com/newmembersdirectory130325.firebasestorage.app/magazine-import/ybw_August_2026.idml/story-library/ybw_August_2026%2023.15.05.jpg',
      publishDate: '2026-08-16',
      pdfUrl: '',
      downloadUrl: '',
      isLatest: false,
      tags: [],
      readerType: 'custom',
      autoSyncCover: true,
      flipbookUrl: '',
      featureInFlipbook: false,
      storyLibrary: [],
      readerEditionId: EDITION_ID,
      readerEditionSlug: 'ybw-aug-2026',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`✅ Created recovery magazine_issues/${ISSUE_ID} doc, linked to readerEditionId=${EDITION_ID}`);
  }

  const editionSnap = await db.collection('magazine_reader_editions').doc(EDITION_ID).get();
  if (!editionSnap.exists) {
    throw new Error(`magazine_reader_editions/${EDITION_ID} not found`);
  }
  const edition = editionSnap.data();
  const flatPages = Array.isArray(edition.pages) ? edition.pages : [];
  if (flatPages.length === 0) throw new Error(`ReaderEdition ${EDITION_ID} has an empty pages array`);
  console.log(`📄 Found ${flatPages.length} pages in ReaderEdition ${EDITION_ID}`);

  const nextStoryLibrary = buildStoryLibraryItemsFromReaderPages(ISSUE_ID, EDITION_ID, flatPages);

  const now = new Date().toISOString();
  const pagesRef = issueRef.collection('pages');
  const existingPagesSnap = await pagesRef.get();
  if (existingPagesSnap.size > 0) {
    console.log(`⚠️  magazine_issues/${ISSUE_ID}/pages already has ${existingPagesSnap.size} docs — aborting to avoid duplicates. Delete them first if you intend to re-run this recovery.`);
    process.exit(1);
  }

  const batch = db.batch();
  for (let i = 0; i < flatPages.length; i++) {
    const rp = flatPages[i];
    const pos = typeof rp.position === 'number' ? rp.position : i + 1;
    const sourceTemplate = String(rp.template || '').toLowerCase();
    const type = SOURCE_TEMPLATE_TO_PAGE_TYPE[sourceTemplate] || 'feature-full';
    let content = rp.content && typeof rp.content === 'object' ? { ...rp.content } : {};
    const title = String(content.title || rp.title || '').trim();
    const body = String(content.body || content.text || '').trim();
    if (title) content.title = title;
    if (body) { content.body = body; content.text = body; }
    content.position = pos;
    content.template = rp.template;

    const storyLibraryForPosition = nextStoryLibrary.find((s) => s.sourceRef === `reader-edition:${EDITION_ID}:page:${pos}`);
    const storyId = storyLibraryForPosition?.id || String(rp.storyId || content.storyId || '').trim() || undefined;

    const legacyDoc = {
      id: pos,
      type,
      pageNumber: pos,
      position: pos,
      readOnly: false,
      storyId,
      sourceReaderEditionId: EDITION_ID,
      sourceTemplate: rp.template || '',
      generatedFromStoryLibrary: true,
      sourceRef: `reader-edition:${EDITION_ID}:page:${pos}`,
      content,
      createdAt: rp.createdAt || now,
      updatedAt: now,
      name: title || `${String(rp.template || 'Page')} ${pos}`,
    };
    const docRef = pagesRef.doc();
    batch.set(docRef, legacyDoc);
  }
  await batch.commit();
  console.log(`✅ Wrote ${flatPages.length} editable pages to magazine_issues/${ISSUE_ID}/pages`);

  // Mirror story library onto the issue doc (same shape used elsewhere in the app).
  await issueRef.set({ storyLibrary: nextStoryLibrary, storyLibraryCount: nextStoryLibrary.length, updatedAt: now }, { merge: true });
  console.log(`✅ Wrote ${nextStoryLibrary.length} Story Library items to magazine_issues/${ISSUE_ID}`);

  console.log('\n✨ Recovery complete. The issue should now appear in /admin/magazine and be fully editable.');
}

main().catch((err) => {
  console.error('❌ Recovery failed:', err);
  process.exit(1);
});
