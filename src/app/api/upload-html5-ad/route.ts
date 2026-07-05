import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import JSZip from 'jszip';

function getContentType(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

function safeZipPath(path: string) {
  const cleaned = path.replace(/^\/+/, '').replace(/\\/g, '/');
  const parts = cleaned.split('/').filter(Boolean);
  const safeParts = parts.filter((p) => p !== '.' && p !== '..');
  return safeParts.join('/');
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminStorage) {
      return NextResponse.json({ error: 'Storage not initialized' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'ads/html5';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const nameLower = String(file.name || '').toLowerCase();
    if (!nameLower.endsWith('.zip')) {
      return NextResponse.json({ error: 'Please upload a .zip file' }, { status: 400 });
    }

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entryNames = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    if (entryNames.length === 0) {
      return NextResponse.json({ error: 'Zip contains no files' }, { status: 400 });
    }

    const prefix = `${folder}/${userId}-${Date.now()}`;
    const bucket = adminStorage.bucket();

    let indexPath: string | null = null;
    const normalizedEntries: Array<{ name: string; fullPath: string }> = [];

    for (const rawName of entryNames) {
      const safeName = safeZipPath(rawName);
      if (!safeName) continue;
      const fullPath = `${prefix}/${safeName}`;
      normalizedEntries.push({ name: safeName, fullPath });
      if (!indexPath) {
        if (safeName.toLowerCase() === 'index.html') indexPath = fullPath;
      }
    }

    if (!indexPath) {
      const candidate = normalizedEntries.find((e) => e.name.toLowerCase().endsWith('/index.html'));
      if (candidate) indexPath = candidate.fullPath;
    }

    if (!indexPath) {
      const htmlCandidate = normalizedEntries.find((e) => e.name.toLowerCase().endsWith('.html'));
      if (htmlCandidate) indexPath = htmlCandidate.fullPath;
    }

    const uploads = normalizedEntries.map(async ({ name, fullPath }) => {
      const entry = zip.files[name];
      if (!entry) return;
      const buffer = Buffer.from(await entry.async('arraybuffer'));
      const storageFile = bucket.file(fullPath);
      await storageFile.save(buffer, {
        metadata: {
          contentType: getContentType(name),
        },
      });
      await storageFile.makePublic();
    });

    await Promise.all(uploads);

    const baseUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(prefix)}`;
    const indexUrlRaw = indexPath ? `https://storage.googleapis.com/${bucket.name}/${encodeURI(indexPath)}` : '';
    const indexUrl = indexUrlRaw ? `${indexUrlRaw}?v=${Date.now()}` : '';

    if (!indexUrl) {
      return NextResponse.json({ error: 'Could not find an index.html in the zip' }, { status: 400 });
    }

    return NextResponse.json({
      baseUrl,
      indexUrl,
    });
  } catch (error: any) {
    console.error('[Upload HTML5 Ad API] Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
