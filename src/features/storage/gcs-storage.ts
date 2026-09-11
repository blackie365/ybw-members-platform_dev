import { Storage } from '@google-cloud/storage';

let storageSingleton: Storage | null = null;
let defaultBucketNameSingleton: string | null = null;
let initErrorSingleton: Error | null = null;

function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw;
  if (key.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed?.private_key) key = parsed.private_key;
    } catch {
      // ignore
    }
  }
  key = key.replace(/^"|"$/g, '');
  key = key.replace(/\\n/g, '\n');
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
    key = `-----BEGIN PRIVATE KEY-----\n${key.trim()}\n-----END PRIVATE KEY-----\n`;
  }
  return key;
}

function initStorage(): Storage | null {
  if (storageSingleton) return storageSingleton;
  if (initErrorSingleton) return null;

  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    const defaultBucketFromEnv =
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      (projectId ? `${projectId}.firebasestorage.app` : null);
    defaultBucketNameSingleton = defaultBucketFromEnv;

    if (!projectId || !clientEmail || !privateKey) {
      const missing = [
        !projectId && 'FIREBASE_PROJECT_ID',
        !clientEmail && 'FIREBASE_CLIENT_EMAIL',
        !privateKey && 'FIREBASE_PRIVATE_KEY',
      ]
        .filter(Boolean)
        .join(', ');
      initErrorSingleton = new Error(
        `[GCS Storage] Missing service-account credentials: ${missing}`,
      );
      console.warn(initErrorSingleton.message);
      return null;
    }

    const credentials = {
      client_email: clientEmail,
      private_key: privateKey,
    };

    storageSingleton = new Storage({
      projectId,
      credentials,
    });

    const keyMasked = (() => {
      const core = privateKey.replace(/\n/g, '').match(
        /-----BEGIN PRIVATE KEY-----(.*)-----END PRIVATE KEY-----/,
      )?.[1] || privateKey.replace(/\n/g, '');
      if (core.length <= 12) return '***';
      return core.slice(0, 6) + '\u2026' + core.slice(-6);
    })();
    const emailMasked =
      clientEmail.length <= 8
        ? '***'
        : clientEmail.slice(0, 3) + '\u2026' + clientEmail.slice(-6);

    console.info(
      `[GCS Storage] init projectId=${JSON.stringify(projectId)} ` +
        `clientEmail=${emailMasked} privateKey=${keyMasked} ` +
        `defaultBucket=${JSON.stringify(defaultBucketNameSingleton || '(unset)')}`,
    );

    return storageSingleton;
  } catch (err: any) {
    initErrorSingleton = err;
    console.error('[GCS Storage] init failed:', err?.message || err);
    return null;
  }
}

export function getGcsStorage(): Storage | null {
  return initStorage();
}

export function getGcsDefaultBucketName(): string | null {
  initStorage();
  return defaultBucketNameSingleton;
}

export function getGcsBucket(bucketName?: string) {
  const storage = initStorage();
  if (!storage) return null;
  const name = bucketName || defaultBucketNameSingleton;
  if (!name) {
    console.warn('[GCS Storage] No bucket name provided and no default bucket configured');
    return null;
  }
  return storage.bucket(name);
}

export function buildPublicStorageUrl(bucketName: string, filePath: string): string {
  const bucket = String(bucketName || '').trim();
  const path = String(filePath || '');
  const safeSegmentEncodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://storage.googleapis.com/${bucket}/${safeSegmentEncodedPath}`;
}

export interface UploadBufferOptions {
  contentType?: string;
  makePublic?: boolean;
  metadata?: Record<string, string>;
  bucketName?: string;
}

export async function uploadBuffer(
  objectPath: string,
  buffer: Buffer,
  opts: UploadBufferOptions = {},
): Promise<{
  publicUrl: string;
  bucketName: string;
  objectPath: string;
  gsUrl: string;
}> {
  const bucket = getGcsBucket(opts.bucketName);
  if (!bucket) {
    throw new Error('[GCS Storage] Cannot upload: storage or bucket not available');
  }
  const makePublic = opts.makePublic !== false;
  const file = bucket.file(objectPath);

  const metadata: any = {};
  if (opts.contentType) metadata.contentType = opts.contentType;
  if (opts.metadata && Object.keys(opts.metadata).length > 0) {
    metadata.metadata = opts.metadata;
  }

  await file.save(buffer, Object.keys(metadata).length > 0 ? { metadata } : undefined);

  if (makePublic) {
    try {
      await file.makePublic();
    } catch (err: any) {
      console.warn(
        `[GCS Storage] makePublic failed for gs://${bucket.name}/${objectPath}: ` +
          `${err?.message || err} — bucket likely already has uniform public-read ACL.`,
      );
    }
  }

  const publicUrl = buildPublicStorageUrl(bucket.name, objectPath);
  return {
    publicUrl,
    bucketName: bucket.name,
    objectPath,
    gsUrl: `gs://${bucket.name}/${objectPath}`,
  };
}

export async function downloadBuffer(
  objectPath: string,
  bucketName?: string,
): Promise<Buffer> {
  const bucket = getGcsBucket(bucketName);
  if (!bucket) {
    throw new Error('[GCS Storage] Cannot download: storage or bucket not available');
  }
  const file = bucket.file(objectPath);
  const [buffer] = await file.download();
  if (!buffer || buffer.length === 0) {
    throw new Error(`Downloaded file is empty: gs://${bucket.name}/${objectPath}`);
  }
  return buffer;
}

export async function getSignedUploadUrl(
  objectPath: string,
  opts: { contentType?: string; bucketName?: string; expiresMs?: number } = {},
): Promise<{ url: string; bucketName: string; objectPath: string; publicUrl: string }> {
  const bucket = getGcsBucket(opts.bucketName);
  if (!bucket) {
    throw new Error('[GCS Storage] Cannot sign URL: storage or bucket not available');
  }
  const expires = opts.expiresMs ? Date.now() + opts.expiresMs : Date.now() + 15 * 60 * 1000;
  const file = bucket.file(objectPath);
  const actionCfg: any = {
    version: 'v4',
    action: 'write' as const,
    expires,
  };
  if (opts.contentType) actionCfg.contentType = opts.contentType;
  const [url] = await file.getSignedUrl(actionCfg);
  return {
    url,
    bucketName: bucket.name,
    objectPath,
    publicUrl: buildPublicStorageUrl(bucket.name, objectPath),
  };
}

export async function getSignedReadUrl(
  objectPath: string,
  opts: { bucketName?: string; expiresMs?: number } = {},
): Promise<string> {
  const bucket = getGcsBucket(opts.bucketName);
  if (!bucket) {
    throw new Error('[GCS Storage] Cannot sign URL: storage or bucket not available');
  }
  const expires = opts.expiresMs ? Date.now() + opts.expiresMs : Date.now() + 7 * 24 * 60 * 60 * 1000;
  const file = bucket.file(objectPath);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires,
  });
  return url;
}
