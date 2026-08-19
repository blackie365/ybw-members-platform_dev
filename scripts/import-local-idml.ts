#!/usr/bin/env tsx
/**
 * Import a local IDML as a magazine reader edition — replicates the admin
 * builder's import + publish pipeline (importIdmlFromUrlAction →
 * publishIdmlEditionAction) against the local file system.
 *
 * Usage:
 *   tsx scripts/import-local-idml.ts <path-to.idml> <issue-title> <publish-date>
 */
import { readFileSync } from 'node:fs';
import { parseIdml } from '../src/lib/idml-parser';
import {
  mapIdmlToReaderPages,
  buildEditionMetadata,
} from '../src/lib/idml-template-mapper';
import { adminDb, adminStorage } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildPublicStorageUrl(bucketName: string, filePath: string): string {
  const encodedPath = String(filePath || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: tsx scripts/import-local-idml.ts <idml-path> <title> <publishDate>');
    process.exit(1);
  }
  const [idmlPath, title, publishDate] = args;

  if (!adminDb || !adminStorage) {
    console.error('Firebase Admin not configured.');
    process.exit(1);
  }

  console.log(`Reading IDML: ${idmlPath}`);
  const buffer = readFileSync(idmlPath);

  console.log('Parsing IDML…');
  const parsed = await parseIdml(buffer);
  if (parsed.pages.length === 0) {
    throw new Error('No readable content found in the IDML file');
  }
  console.log(`Parsed ${parsed.pageCount} pages, ${parsed.images.length} images, ${parsed.pages.reduce((s, p) => s + p.stories.length, 0)} stories`);

  const fileName = idmlPath.split('/').pop() || 'import';
  const bucket = adminStorage.bucket();

  console.log('Uploading parsed images…');
  const imageUrls: Record<string, string> = {};
  const uploadPromises = parsed.images.map(async (img) => {
    const filePath = `magazine-import/${fileName}/${img.fileName}`;
    const storageFile = bucket.file(filePath);
    await storageFile.save(img.data, { metadata: { contentType: img.mimeType } });
    await storageFile.makePublic();
    return { fileName: img.fileName, url: buildPublicStorageUrl(bucket.name, filePath) };
  });
  const uploadResults = await Promise.all(uploadPromises);
  for (const result of uploadResults) {
    imageUrls[result.fileName] = result.url;
  }
  console.log(`Uploaded ${uploadResults.length} images`);

  console.log('Mapping pages to reader templates…');
  let pages = mapIdmlToReaderPages(parsed.pages);
  const resolve = (name: string): string =>
    name && imageUrls[name] ? imageUrls[name] : name;
  pages = pages.map((page) => ({
    ...page,
    content: {
      ...page.content,
      imageUrl: resolve(page.content.imageUrl || ''),
      imageUrls: (page.content.imageUrls || []).map(resolve),
      backgroundImage: resolve(page.content.backgroundImage || ''),
      // Logo image resolution (separate key; never mixed into hero/gallery)
      logoImage: resolve(page.content.logoImage || ''),
      logoImages: (page.content.logoImages || []).map(resolve),
      partnerLogo: resolve(page.content.partnerLogo || page.content.logoImage || ''),
      // Canonical aliases (already resolved by mapper, re-resolve for safety)
      image: resolve(page.content.image || ''),
      featureImage: resolve(page.content.featureImage || ''),
      heroImage: resolve(page.content.heroImage || ''),
      mainImage: resolve(page.content.mainImage || ''),
      coverImage: resolve(page.content.coverImage || ''),
      images: (page.content.images || []).map(resolve),
      gallery: (page.content.gallery || []).map(resolve),
      additionalImages: (page.content.additionalImages || []).map(resolve),
    },
  }));

  const metadata = buildEditionMetadata(pages, fileName);
  console.log(`Metadata: title=${metadata.title} coverImage=${metadata.coverImage ? 'yes' : 'NO'}`);

  const slug = slugify(title) || `edition-${Date.now().toString(36)}`;
  const editionId = `reader-${slug}-${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  const edition = {
    id: editionId,
    slug,
    title,
    description: metadata.description || title,
    coverImage: metadata.coverImage,
    publishDate,
    pageCount: pages.length,
    pages,
    createdAt: now,
  };

  console.log(`Upserting reader edition ${editionId} …`);
  await adminDb.collection('magazine_reader_editions').doc(editionId).set(edition, { merge: true });
  console.log('\nDone!');
  console.log(`  Title:       ${edition.title}`);
  console.log(`  Pages:       ${edition.pageCount}`);
  console.log(`  Slug:        ${edition.slug}`);
  console.log(`  PublishDate: ${edition.publishDate}`);
  console.log(`\nVisit: /magazine/read/${edition.slug}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
