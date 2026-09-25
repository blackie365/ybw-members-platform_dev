import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, isAbsolute } from 'node:path';
import type { StorageBackend, UploadBufferOptions, UploadResult } from './types';

export const VPS_BACKEND_BUCKET_SENTINEL = 'local';

export function getVpsStorageRoot(): string {
  const envRoot = process.env.STORAGE_VPS_ROOT;
  if (envRoot && envRoot.trim()) {
    return envRoot.trim();
  }
  const nextRoot = process.cwd();
  return join(nextRoot, '.uploads');
}

function resolveFsPath(objectPath: string): string {
  const root = getVpsStorageRoot();
  const cleanPath = String(objectPath || '').replace(/^\/+/, '');
  const resolved = join(root, cleanPath);
  if (!isAbsolute(resolved)) {
    throw new Error(`[VPS Storage] Resolved path is not absolute: ${resolved}`);
  }
  const normalizedRoot = root.endsWith('/') ? root : `${root}/`;
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`[VPS Storage] Path escape detected: ${objectPath}`);
  }
  return resolved;
}

function buildPublicVpsUrl(objectPath: string): string {
  const path = String(objectPath || '').replace(/^\/+/, '');
  const pathAlreadyHasUploads = path.startsWith('uploads/');
  const prefix = pathAlreadyHasUploads ? '' : 'uploads';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  const rel = prefix ? `/${prefix}/${path}`.replace(/\/+/g, '/') : `/${path}`.replace(/\/+/g, '/');
  if (siteUrl) {
    return `${siteUrl.replace(/\/+$/, '')}${rel}`;
  }
  return rel;
}

function buildAbsolutePath(objectPath: string): string {
  const path = String(objectPath || '').replace(/^\/+/, '');
  const pathAlreadyHasUploads = path.startsWith('uploads/');
  if (pathAlreadyHasUploads) {
    return `/${path}`.replace(/\/+/g, '/');
  }
  return `/uploads/${path}`.replace(/\/+/g, '/');
}

function resolvePublicAbsoluteUrl(objectPath: string): string {
  const rel = buildAbsolutePath(objectPath);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  if (siteUrl) {
    return `${siteUrl.replace(/\/+$/, '')}${rel}`;
  }
  return rel;
}

export const vpsStorageBackend: StorageBackend = {
  kind: 'vps',
  isReady: () => true,
  async uploadBuffer(
    objectPath: string,
    buffer: Buffer,
    opts: UploadBufferOptions = {},
  ): Promise<UploadResult> {
    if (!buffer || buffer.length === 0) {
      throw new Error('[VPS Storage] Empty buffer cannot be uploaded');
    }
    const fsPath = resolveFsPath(objectPath);
    await mkdir(dirname(fsPath), { recursive: true });
    await writeFile(fsPath, buffer);
    const publicUrl = buildPublicVpsUrl(objectPath);
    return {
      publicUrl,
      bucketName: VPS_BACKEND_BUCKET_SENTINEL,
      objectPath,
    };
  },
  async downloadBuffer(objectPath: string): Promise<Buffer> {
    const fsPath = resolveFsPath(objectPath);
    const buffer = await readFile(fsPath);
    if (!buffer || buffer.length === 0) {
      throw new Error(`[VPS Storage] Downloaded file is empty: ${objectPath}`);
    }
    return buffer;
  },
  buildPublicUrl: (objectPath) => resolvePublicAbsoluteUrl(objectPath),
  async getSignedUploadUrl(objectPath, opts) {
    const publicUrl = buildPublicVpsUrl(objectPath);
    return {
      url: publicUrl,
      bucketName: VPS_BACKEND_BUCKET_SENTINEL,
      objectPath,
      publicUrl,
    };
  },
  async getSignedReadUrl(objectPath) {
    return buildPublicVpsUrl(objectPath);
  },
};

export function buildPublicVpsStorageUrl(objectPath: string): string {
  return vpsStorageBackend.buildPublicUrl(objectPath);
}
