import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __ybwMagPgPool: Pool | null | undefined;
}

function buildPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  const hasPgVars =
    process.env.PGHOST || process.env.PGDATABASE || process.env.PGUSER || process.env.PGPASSWORD;
  if (!url && !hasPgVars) {
    return null;
  }
  const cfg = url
    ? { connectionString: url, max: 4, idleTimeoutMillis: 30_000 }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'ybw_magazine',
        user: process.env.PGUSER || 'ybw_app',
        password: process.env.PGPASSWORD,
        max: 4,
        idleTimeoutMillis: 30_000,
      };
  return new Pool(cfg);
}

export function getMagazinePgPool(): Pool | null {
  if (!globalThis.__ybwMagPgPool) {
    globalThis.__ybwMagPgPool = buildPool();
  }
  return globalThis.__ybwMagPgPool;
}

export async function closeMagazinePgPool(): Promise<void> {
  const pool = globalThis.__ybwMagPgPool;
  globalThis.__ybwMagPgPool = null;
  if (pool) await pool.end().catch(() => {});
}
