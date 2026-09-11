import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkAdmin } from '@/lib/server/auth-utils';
import {
  uploadBuffer,
  getGcsStorage,
  getGcsDefaultBucketName,
  buildPublicStorageUrl,
} from '@/features/storage/gcs-storage';

const MAX_IDML_SIZE = 100 * 1024 * 1024;
const SAFE_FOLDER = 'magazine-import';

function sanitizeFileName(name: string): string {
  return String(name || 'import.idml')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await checkAdmin();
    } catch {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!getGcsStorage()) {
      return NextResponse.json({ error: 'Storage not initialized' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const size = typeof file.size === 'number' ? file.size : 0;
    if (size > MAX_IDML_SIZE) {
      return NextResponse.json({ error: 'File exceeds 100MB size limit' }, { status: 400 });
    }

    const nameLower = String(file.name || '').toLowerCase();
    if (!nameLower.endsWith('.idml')) {
      return NextResponse.json({ error: 'Please upload a .idml file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Empty IDML file' }, { status: 400 });
    }

    const sanitizedName = sanitizeFileName(file.name);
    const timestamp = Date.now().toString();
    const objectName = `${SAFE_FOLDER}/${timestamp}-${sanitizedName}`;

    const uploaded = await uploadBuffer(objectName, buffer, {
      contentType: 'application/octet-stream',
      makePublic: true,
      metadata: {
        fileName: sanitizedName,
        uploadedAt: new Date().toISOString(),
        fileSizeBytes: String(buffer.length),
      },
    });

    const bucketName = uploaded.bucketName || getGcsDefaultBucketName() || '';
    const encodedPath = encodeURIComponent(objectName);
    const httpsFirebaseShapeUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;

    return NextResponse.json({
      success: true,
      data: {
        gsUrl: uploaded.gsUrl,
        httpsUrl: httpsFirebaseShapeUrl,
        publicUrl: uploaded.publicUrl,
        path: objectName,
        bucket: bucketName,
        sizeBytes: buffer.length,
        fileName: sanitizedName,
      },
    });
  } catch (error: any) {
    console.error('[Upload IDML API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 },
    );
  }
}
