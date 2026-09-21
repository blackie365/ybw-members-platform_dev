import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';

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

const QC00922_LEADERBOARD_IFRAME_URL =
  '/ad-creatives/qc00922/HTML5%20-%20Version%201/QC00922%20-%20780x90px%20-%20HTML5_v1.html';

function buildHeaderRotationItems(
  legacyImageUrl: string,
  legacyLinkUrl: string,
  legacyAltText: string,
) {
  const cedarCourtLegacyItem = {
    id: 'cedar-court-legacy-header',
    enabled: true,
    imageUrl: legacyImageUrl,
    iframeUrl: '',
    linkUrl: legacyLinkUrl,
    altText: legacyAltText,
  };

  const qc00922Html5Item = {
    id: 'qc00922-780x90-html5-v1',
    enabled: true,
    imageUrl: '',
    iframeUrl: QC00922_LEADERBOARD_IFRAME_URL,
    linkUrl: legacyLinkUrl,
    altText: 'QC00922 Advertisement',
  };

  const hasCedarCourt = Boolean(cedarCourtLegacyItem.imageUrl);
  const rotationItems = [];
  if (hasCedarCourt) rotationItems.push(cedarCourtLegacyItem);
  rotationItems.push(qc00922Html5Item);

  if (rotationItems.length < 2) return null;
  return rotationItems;
}

export async function getSystemSettingData(key: string): Promise<Record<string, unknown>> {
  const rec = await getSystemStore().get(key);
  const data = (rec?.data && typeof rec.data === 'object'
    ? (rec.data as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  if (key === 'system:ads') {
    const envImageUrl = process.env.NEXT_PUBLIC_HEADER_AD_IMAGE_URL || '';
    const envIframeUrl = process.env.NEXT_PUBLIC_HEADER_AD_IFRAME_URL || '';
    const envLinkUrl = process.env.NEXT_PUBLIC_HEADER_AD_LINK_URL || '';
    const envAltText = process.env.NEXT_PUBLIC_HEADER_AD_ALT_TEXT || 'Advertisement';

    const dataIsEmpty = Object.keys(data).length === 0;

    const existingHeader =
      !dataIsEmpty && data.headerLeaderboard && typeof data.headerLeaderboard === 'object'
        ? (data.headerLeaderboard as Record<string, unknown>)
        : null;

    const shouldSeedHeaderRotation = dataIsEmpty || !!existingHeader;

    if (shouldSeedHeaderRotation) {
      const effectiveImageUrl = existingHeader
        ? String((existingHeader.imageUrl as string) ?? envImageUrl ?? '')
        : envImageUrl;
      const effectiveLinkUrl = existingHeader
        ? String((existingHeader.linkUrl as string) ?? envLinkUrl ?? '')
        : envLinkUrl;
      const effectiveAltText = existingHeader
        ? String((existingHeader.altText as string) ?? envAltText ?? 'Advertisement')
        : envAltText;

      const rotationItems = buildHeaderRotationItems(
        effectiveImageUrl,
        effectiveLinkUrl,
        effectiveAltText,
      );
      if (rotationItems) {
        const headerEnabled =
          existingHeader && typeof existingHeader.enabled === 'boolean'
            ? existingHeader.enabled
            : true;
        const upgradedHeader = {
          ...(existingHeader || {}),
          enabled: headerEnabled,
          imageUrl: effectiveImageUrl,
          iframeUrl: envIframeUrl,
          linkUrl: effectiveLinkUrl,
          altText: effectiveAltText,
          rotation: {
            enabled: true,
            intervalSeconds: 30,
            items: rotationItems,
          },
          updatedAt: (existingHeader?.updatedAt as string | undefined) ?? new Date(0).toISOString(),
        };
        if (dataIsEmpty) {
          return { headerLeaderboard: upgradedHeader };
        }
        return { ...data, headerLeaderboard: upgradedHeader };
      }
    }
  }

  return data;
}

export const _internals = {
  pgSchemaReady: () => schemaReady,
};
