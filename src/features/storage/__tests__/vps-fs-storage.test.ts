import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtemp, rm, readFile, access, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { vpsStorageBackend } from '@/features/storage/vps-fs-storage';
import type { UploadBufferOptions } from '@/features/storage/types';
import { parseGoogleStoragePath } from '@/app/actions/magazine/idml-import-actions';

function makeEnv(rootEnvPath: string | undefined): () => void {
  const original = process.env.STORAGE_VPS_ROOT;
  process.env.STORAGE_VPS_ROOT = rootEnvPath;
  process.env.NEXT_PUBLIC_SITE_URL = '';
  return () => {
    if (original === undefined) delete process.env.STORAGE_VPS_ROOT;
    else process.env.STORAGE_VPS_ROOT = original;
  };
}

describe('VPS storage backend (drop-in for GCS uploads)', () => {
  let tmpRoot: string | undefined;
  let revert: (() => void) | undefined;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'ybw-vps-storage-'));
    revert = makeEnv(tmpRoot);
  });

  afterEach(async () => {
    revert?.();
    if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  });

  it('isReady always true (local filesystem, no init required)', () => {
    expect(vpsStorageBackend.kind).toBe('vps');
    expect(vpsStorageBackend.isReady()).toBe(true);
  });

  it('uploadBuffer writes a binary file into STORAGE_VPS_ROOT and returns relative publicUrl', async () => {
    const buffer = Buffer.from('hello vps storage', 'utf8');
    const objectPath = 'uploads/userA-1000.jpg';

    const opts: UploadBufferOptions = { contentType: 'image/jpeg', makePublic: true };
    const uploaded = await vpsStorageBackend.uploadBuffer(objectPath, buffer, opts);

    expect(uploaded.bucketName).toBe('local');
    expect(uploaded.objectPath).toBe(objectPath);
    expect(uploaded.gsUrl).toBeUndefined();
    expect(uploaded.publicUrl).toMatch(/^\/uploads\/userA-1000\.jpg$/);

    const written = await readFile(join(tmpRoot!, 'uploads', 'userA-1000.jpg'));
    expect(written).toEqual(buffer);
  });

  it('publicUrl prefixes site URL when NEXT_PUBLIC_SITE_URL is present', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://yorkshirebusinesswoman.co.uk';
    try {
      const buffer = Buffer.from('siteurl check', 'utf8');
      const uploaded = await vpsStorageBackend.uploadBuffer('magazine-import/x/img.png', buffer);
      expect(uploaded.publicUrl).toBe('https://yorkshirebusinesswoman.co.uk/uploads/magazine-import/x/img.png');
    } finally {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });

  it('downloadBuffer reads back bytes from a previous upload', async () => {
    const raw = Buffer.from('roundtrip payload', 'utf8');
    const path = 'uploads/rt-1.bin';
    await vpsStorageBackend.uploadBuffer(path, raw);

    const got = await vpsStorageBackend.downloadBuffer(path);
    expect(got).toEqual(raw);
  });

  it('path escape attempts via ../ are rejected', async () => {
    const evil = 'uploads/../../../../etc/evil.bin';
    await expect(
      vpsStorageBackend.uploadBuffer(evil, Buffer.from('nope', 'utf8')),
    ).rejects.toThrow(/Path escape/);
  });

  it('buildPublicUrl returns the same as publicUrl result for uploaded object path', () => {
    expect(vpsStorageBackend.buildPublicUrl('magazine-import/id.jpg')).toBe('/uploads/magazine-import/id.jpg');
  });
});

describe('parseGoogleStoragePath (VPS /uploads/ passthrough branch)', () => {
  it('recognises /uploads/ relative paths and sets bucket local', () => {
    expect(parseGoogleStoragePath('/uploads/magazine-import/x.img')).toEqual({
      bucketName: 'local',
      objectPath: 'magazine-import/x.img',
    });
    expect(parseGoogleStoragePath('uploads/pic.jpg')).toEqual({
      bucketName: 'local',
      objectPath: 'pic.jpg',
    });
  });

  it('recognises absolute NEXT_PUBLIC_SITE_URL uploads', () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ybw.co.uk';
    try {
      expect(
        parseGoogleStoragePath('https://ybw.co.uk/uploads/abc/1.jpg'),
      ).toEqual({ bucketName: 'local', objectPath: 'abc/1.jpg' });
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });

  it('legacy gs:// URIs still parse correctly unchanged', () => {
    expect(parseGoogleStoragePath('gs://fire.appspot.com/magazine-import/file.idml')).toEqual({
      bucketName: 'fire.appspot.com',
      objectPath: 'magazine-import/file.idml',
    });
  });
});

describe('storage backend downloadBuffer dispatch (/uploads/ → VPS)', async () => {
  let tmpRoot: string | undefined;
  let revert: (() => void) | undefined;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'ybw-router-'));
    revert = makeEnv(tmpRoot);
  });

  afterEach(async () => {
    revert?.();
    if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  });

  it('storage router downloadBuffer treats /uploads/ path as VPS-local (no GCS credentials needed)', async () => {
    const { uploadBuffer, downloadBuffer } = await import('@/features/storage');
    process.env.STORAGE_BACKEND = 'gcs'; // Even with BACKEND=gcs, /uploads/ path uses VPS backend
    try {
      const payload = Buffer.from('router dispatch test', 'utf8');
      await uploadBuffer('uploads/router-test.bin', payload);
      const got = await downloadBuffer('/uploads/router-test.bin');
      expect(got).toEqual(payload);
    } finally {
      delete process.env.STORAGE_BACKEND;
    }
  });
});
