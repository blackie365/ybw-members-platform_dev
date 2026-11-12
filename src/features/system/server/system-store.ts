import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initSystemPgSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getMagazinePgPool();
      if (!pool) return;
      await pool.query(SCHEMA_SQL);
      schemaReady = true;
    })();
  }
  await schemaPromise;
}

export interface SystemSettingRecord {
  key: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

function toRecord(row: { key: string; data: unknown; updated_at?: Date | string | null } | undefined): SystemSettingRecord | null {
  if (!row) return null;
  const dataRaw = row.data ?? {};
  const data =
    dataRaw && typeof dataRaw === 'object' ? (dataRaw as Record<string, unknown>) : {};
  const updatedAt =
    typeof row.updated_at === 'string'
      ? row.updated_at
      : row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(0).toISOString();
  return { key: row.key, data, updatedAt };
}

export class PgSystemStore {
  private async ready(): Promise<boolean> {
    try {
      await initSystemPgSchema();
      return getMagazinePgPool() !== null;
    } catch (err) {
      console.warn('[PgSystemStore] schema init failed:', err);
      return false;
    }
  }

  async health(): Promise<boolean> {
    return this.ready();
  }

  async get(key: string): Promise<SystemSettingRecord | null> {
    if (!key) return null;
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        'SELECT key, data, updated_at FROM system_settings WHERE key = $1',
        [key],
      );
      return toRecord(rows[0]);
    } catch (err) {
      console.warn(`[PgSystemStore] get(${key}) PG failed:`, err);
      return null;
    }
  }

  async set(
    key: string,
    data: Record<string, unknown>,
    opts: { merge?: boolean } = {},
  ): Promise<void> {
    if (!key) return;
    const merge = opts.merge ?? false;
    if (!(await this.ready())) {
      throw new Error('[PgSystemStore] Postgres not ready — cannot write system setting');
    }
    const pool = getMagazinePgPool()!;

    if (merge) {
      await pool.query(
        `INSERT INTO system_settings (key, data, updated_at) VALUES ($1,$2::jsonb,NOW())
         ON CONFLICT (key) DO UPDATE
           SET data = COALESCE(system_settings.data, '{}'::jsonb) || EXCLUDED.data,
               updated_at = NOW()`,
        [key, JSON.stringify(data ?? {})],
      );
    } else {
      await pool.query(
        `INSERT INTO system_settings (key, data, updated_at) VALUES ($1,$2::jsonb,NOW())
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [key, JSON.stringify(data ?? {})],
      );
    }
  }

  async delete(key: string): Promise<void> {
    if (!key) return;
    if (!(await this.ready())) return;
    try {
      const pool = getMagazinePgPool()!;
      await pool.query('DELETE FROM system_settings WHERE key = $1', [key]);
    } catch (err) {
      console.warn(`[PgSystemStore] delete(${key}) PG delete failed:`, err);
    }
  }
}

let _singleton: PgSystemStore | null = null;

export function getSystemStore(): PgSystemStore {
  if (!_singleton) _singleton = new PgSystemStore();
  return _singleton;
}

function normalizeStringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAdRotationItem(
  value: unknown,
  index: number,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  return {
    ...item,
    id: normalizeStringField(item.id) || `header-rotation-${index + 1}`,
    enabled: item.enabled !== false,
    imageUrl: fixMagazineImageUrl(normalizeStringField(item.imageUrl)),
    iframeUrl: normalizeStringField(item.iframeUrl),
    linkUrl: normalizeStringField(item.linkUrl),
    altText: normalizeStringField(item.altText),
  };
}

function normalizeHeaderLeaderboardConfig(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const rotationRaw =
    value.rotation && typeof value.rotation === 'object' && !Array.isArray(value.rotation)
      ? (value.rotation as Record<string, unknown>)
      : null;

  const rotationItems = Array.isArray(rotationRaw?.items)
    ? rotationRaw.items
        .map((item, index) => normalizeAdRotationItem(item, index))
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];

  return {
    ...value,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    imageUrl: fixMagazineImageUrl(normalizeStringField(value.imageUrl)),
    iframeUrl: normalizeStringField(value.iframeUrl),
    linkUrl: normalizeStringField(value.linkUrl),
    altText: normalizeStringField(value.altText) || 'Advertisement',
    rotation: rotationRaw
      ? {
          ...rotationRaw,
          enabled: rotationRaw.enabled === true,
          intervalSeconds:
            typeof rotationRaw.intervalSeconds === 'number' ? rotationRaw.intervalSeconds : 30,
          items: rotationItems,
        }
      : undefined,
  };
}

export async function getSystemSettingData(key: string): Promise<Record<string, unknown>> {
  const rec = await getSystemStore().get(key);
  const data = (rec?.data && typeof rec.data === 'object'
    ? (rec.data as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  if (key === 'system:ads') {
    const existingHeader =
      data.headerLeaderboard && typeof data.headerLeaderboard === 'object'
        ? (data.headerLeaderboard as Record<string, unknown>)
        : null;

    if (existingHeader) {
      return {
        ...data,
        headerLeaderboard: normalizeHeaderLeaderboardConfig(existingHeader),
      };
    }
  }

  return data;
}

export const _internals = {
  pgSchemaReady: () => schemaReady,
};
