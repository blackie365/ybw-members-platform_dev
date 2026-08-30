import { Pool } from 'pg';

/**
 * Server-only Postgres connection for the magazine read store (Phase 3).
 *
 * Connection is configured purely from env vars (never compiled into client
 * bundles — this module is only imported from server code):
 *   - DATABASE_URL  (optional — a full postgres:// connection string)
 *   - or PG* vars:  PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
 *
 * The module exports a lazy singleton pool. If no Postgres env is configured
 * the pool is null and the caller falls back to the Firestore store.
 */
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
  return new Pool(
    url
      ? { connectionString: url, max: 10, idleTimeoutMillis: 30_000 }
      : {
          host: process.env.PGHOST || '127.0.0.1',
          port: Number(process.env.PGPORT || 5432),
          database: process.env.PGDATABASE || 'ybw_magazine',
          user: process.env.PGUSER || 'ybw_app',
          password: process.env.PGPASSWORD,
          max: 10,
          idleTimeoutMillis: 30_000,
        },
  );
}

/**
 * Lazily-created singleton pool (reused across HMR in dev, survives across
 * serverless warm instances within the same process).
 */
export function getMagazinePgPool(): Pool | null {
  if (process.env.NODE_ENV === 'production') {
    if (!globalThis.__ybwMagPgPool) {
      globalThis.__ybwMagPgPool = buildPool();
    }
    return globalThis.__ybwMagPgPool;
  }
  return buildPool();
}
