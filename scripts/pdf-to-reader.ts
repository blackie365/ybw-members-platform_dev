#!/usr/bin/env tsx
/**
 * pdf-to-reader — Extract content from a PDF and store it as a magazine reader edition.
 *
 * Usage:
 *   pnpm magazine:pdf-to-reader <pdf-path> [issue-title]
 *
 * What it does:
 *   1. Reads the PDF and extracts text from each page
 *   2. Assigns templates based on page position (cover, contents, features, back cover)
 *   3. Stores a simple reader edition in Firestore (magazine_reader_editions collection)
 *   4. The MagazineShell renders it directly — no slots, no stories, no complexity
 *
 * Output: a slug you can visit at /magazine/read/<slug>
 */

import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import pdfParse from 'pdf-parse';
import { adminDb } from '../src/lib/firebase-admin';

interface ReaderPage {
  id: string;
  position: number;
  template: string;       // 'cover' | 'contents' | 'feature-left' | 'feature-right' | 'feature-full' | 'back-cover'
  title: string;
  body: string;
  imageUrls: string[];    // extracted image references if any
}

interface ReaderEdition {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  publishDate: string;
  pageCount: number;
  pages: ReaderPage[];
  createdAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractTitleFromBody(body: string): string {
  if (!body) return '';
  // Take first meaningful line (skip blank lines, headers like "COVER :", etc.)
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip import artifacts
    if (/^<\?ACE/.test(line)) continue;
    if (/\.(indd|idml|icml)$/i.test(line)) continue;
    if (/^imported from/i.test(line)) continue;
    if (/^printed by/i.test(line)) continue;
    if (/^cover\s*:/i.test(line)) continue;
    if (line.length < 5) continue;
    // Take first real line as title
    return line.slice(0, 120);
  }
  return lines[0]?.slice(0, 120) || '';
}

function assignTemplate(position: number, totalPages: number): ReaderPage['template'] {
  if (position === 1) return 'cover';
  if (position === 2) return 'contents';
  if (position === totalPages) return 'back-cover';
  // Alternate between left and right media for feature pages
  if (position % 3 === 0) return 'feature-left';
  if (position % 3 === 1) return 'feature-right';
  return 'feature-full';
}

function cleanText(text: string): string {
  return text
    // Remove common PDF artifacts
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Remove import artifacts
    .replace(/<\?ACE 18\?>/gi, '')
    .replace(/\.(indd|idml|icml)\s*$/gim, '')
    .replace(/^imported from .+$/gim, '')
    .replace(/^printed by[:\s].+$/gim, '')
    .trim();
}

function splitIntoSections(text: string): { title: string; body: string } {
  const cleaned = cleanText(text);
  const paragraphs = cleaned.split(/\n{2,}/).filter(p => p.trim());
  
  if (paragraphs.length === 0) return { title: '', body: '' };
  
  const title = extractTitleFromBody(cleaned);
  const body = paragraphs.join('\n\n');
  
  return { title, body };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: pnpm magazine:pdf-to-reader <pdf-path> [issue-title]');
    process.exit(1);
  }

  const pdfPath = args[0];
  const customTitle = args[1] || '';

  console.log(`Reading PDF: ${pdfPath}`);
  
  const pdfBuffer = readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  
  console.log(`PDF has ${pdfData.numpages} pages`);
  
  const issueTitle = customTitle || 
    basename(pdfPath, extname(pdfPath))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

  const slug = slugify(issueTitle);
  const editionId = `reader-${slug}-${Date.now()}`;
  
  const pages: ReaderPage[] = [];
  
  for (let i = 0; i < pdfData.numpages; i++) {
    const pageNum = i + 1;
    const pageText = pdfData.text || '';
    
    // pdf-parse gives us all text at once; split by page markers if possible
    // For now, divide text roughly evenly across pages
    const textPerPage = Math.ceil(pageText.length / pdfData.numpages);
    const start = i * textPerPage;
    const end = Math.min(start + textPerPage, pageText.length);
    const pageContent = pageText.slice(start, end);
    
    const { title, body } = splitIntoSections(pageContent);
    const template = assignTemplate(pageNum, pdfData.numpages);
    
    pages.push({
      id: `${editionId}-page-${String(pageNum).padStart(2, '0')}`,
      position: pageNum,
      template,
      title: title || `Page ${pageNum}`,
      body,
      imageUrls: [],
    });
  }

  const edition: ReaderEdition = {
    id: editionId,
    slug,
    title: issueTitle,
    description: `Digital edition: ${issueTitle}`,
    coverImage: '',
    publishDate: new Date().toISOString(),
    pageCount: pdfData.numpages,
    pages,
    createdAt: new Date().toISOString(),
  };

  // Store in Firestore
  if (!adminDb) {
    console.error('Firebase Admin not configured. Saving to local JSON instead.');
    const { writeFileSync } = await import('node:fs');
    const outPath = pdfPath.replace(/\.pdf$/i, '-reader.json');
    writeFileSync(outPath, JSON.stringify(edition, null, 2));
    console.log(`Saved to: ${outPath}`);
    console.log(`Visit: /magazine/read/${slug}`);
    return;
  }

  await adminDb.collection('magazine_reader_editions').doc(editionId).set(edition);
  
  // Also store each page as a subcollection for lazy loading
  const batch = adminDb.batch();
  for (const page of pages) {
    const pageRef = adminDb.collection('magazine_reader_editions').doc(editionId).collection('pages').doc(page.id);
    batch.set(pageRef, page);
  }
  await batch.commit();

  console.log(`\nDone! Edition stored in Firestore.`);
  console.log(`  Title: ${edition.title}`);
  console.log(`  Pages: ${edition.pageCount}`);
  console.log(`  Slug:  ${edition.slug}`);
  console.log(`\nVisit: /magazine/read/${edition.slug}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
