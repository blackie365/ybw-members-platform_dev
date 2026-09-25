export type StorageBackendKind = 'gcs' | 'vps';

export interface UploadBufferOptions {
  contentType?: string;
  makePublic?: boolean;
  metadata?: Record<string, string>;
  bucketName?: string;
}

export interface UploadResult {
  publicUrl: string;
  bucketName: string;
  objectPath: string;
  gsUrl?: string;
}

export interface StorageBackend {
  readonly kind: StorageBackendKind;
  isReady: () => boolean;
  uploadBuffer: (
    objectPath: string,
    buffer: Buffer,
    opts?: UploadBufferOptions,
  ) => Promise<UploadResult>;
  downloadBuffer: (objectPath: string, bucketName?: string) => Promise<Buffer>;
  buildPublicUrl: (objectPath: string, bucketName?: string) => string;
  getSignedUploadUrl: (
    objectPath: string,
    opts?: { contentType?: string; bucketName?: string; expiresMs?: number },
  ) => Promise<{ url: string; bucketName: string; objectPath: string; publicUrl: string }>;
  getSignedReadUrl: (
    objectPath: string,
    opts?: { bucketName?: string; expiresMs?: number },
  ) => Promise<string>;
}
