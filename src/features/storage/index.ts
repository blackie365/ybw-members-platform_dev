import type { StorageBackend, StorageBackendKind, UploadBufferOptions, UploadResult } from './types';
import { vpsStorageBackend, buildPublicVpsStorageUrl } from './vps-fs-storage';
import {
  getGcsStorage,
  getGcsDefaultBucketName,
  getGcsBucket,
  uploadBuffer as uploadBufferGcs,
  downloadBuffer as downloadBufferGcs,
  getSignedUploadUrl as getSignedUploadUrlGcs,
  getSignedReadUrl as getSignedReadUrlGcs,
  buildPublicStorageUrl,
} from './gcs-storage';

export type { StorageBackend, StorageBackendKind, UploadBufferOptions, UploadResult } from './types';

export const GCS_BACKEND_KIND: StorageBackendKind = 'gcs';
export const VPS_BACKEND_KIND: StorageBackendKind = 'vps';

export function getStorageBackendKind(): StorageBackendKind {
  const env = String(process.env.STORAGE_BACKEND || 'gcs').toLowerCase().trim();
  if (env === 'vps' || env === 'fs' || env === 'local') return 'vps';
  return 'gcs';
}

export function getStorageBackend(): StorageBackend {
  const kind = getStorageBackendKind();
  if (kind === 'vps') return vpsStorageBackend;
  return gcsBackendAdapter;
}

const gcsBackendAdapter: StorageBackend = {
  kind: 'gcs',
  isReady: () => Boolean(getGcsStorage()),
  uploadBuffer: async (objectPath, buffer, opts) => {
    const res = await uploadBufferGcs(objectPath, buffer, opts);
    return {
      publicUrl: res.publicUrl,
      bucketName: res.bucketName,
      objectPath: res.objectPath,
      gsUrl: res.gsUrl,
    };
  },
  downloadBuffer: async (objectPath, bucketName) => downloadBufferGcs(objectPath, bucketName),
  buildPublicUrl: (objectPath, bucketName) => {
    const bucket = bucketName || getGcsDefaultBucketName() || '';
    return buildPublicStorageUrl(bucket, objectPath);
  },
  getSignedUploadUrl: async (objectPath, opts) => getSignedUploadUrlGcs(objectPath, opts),
  getSignedReadUrl: async (objectPath, opts) => getSignedReadUrlGcs(objectPath, opts),
};

export function isStorageReady(): boolean {
  return getStorageBackend().isReady();
}

export async function uploadBuffer(
  objectPath: string,
  buffer: Buffer,
  opts: UploadBufferOptions = {},
): Promise<UploadResult> {
  const path = String(objectPath || '').trim();
  if (path.startsWith('/uploads/') || path.startsWith('uploads/')) {
    return vpsStorageBackend.uploadBuffer(objectPath, buffer, opts);
  }
  const backend = getStorageBackend();
  return backend.uploadBuffer(objectPath, buffer, opts);
}

export async function downloadBuffer(
  objectPath: string,
  bucketName?: string,
): Promise<Buffer> {
  const path = String(objectPath || '').trim();
  if (path.startsWith('/uploads/') || path.startsWith('uploads/')) {
    return vpsStorageBackend.downloadBuffer(path);
  }
  const backend = getStorageBackend();
  return backend.downloadBuffer(objectPath, bucketName);
}

export function buildPublicUrl(objectPath: string, bucketName?: string): string {
  const backend = getStorageBackend();
  if (backend.kind === 'vps') {
    return buildPublicVpsStorageUrl(objectPath);
  }
  const bucket = bucketName || getGcsDefaultBucketName() || '';
  return buildPublicStorageUrl(bucket, objectPath);
}

export function getDefaultBucketName(): string | null {
  const kind = getStorageBackendKind();
  if (kind === 'vps') return 'local';
  return getGcsDefaultBucketName();
}

export async function getSignedUploadUrl(
  objectPath: string,
  opts: { contentType?: string; bucketName?: string; expiresMs?: number } = {},
) {
  return getStorageBackend().getSignedUploadUrl(objectPath, opts);
}

export async function getSignedReadUrl(
  objectPath: string,
  opts: { bucketName?: string; expiresMs?: number } = {},
) {
  return getStorageBackend().getSignedReadUrl(objectPath, opts);
}

export { buildPublicStorageUrl, getGcsStorage, getGcsDefaultBucketName, getGcsBucket };
