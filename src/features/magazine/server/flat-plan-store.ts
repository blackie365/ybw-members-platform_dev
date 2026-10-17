import { getMagazinePgPool } from './read-store/pg-client';
import { initMagazinePgSchema } from './read-store/pg-schema';
import {
  FlatPlan,
  FlatPlanSummary,
  normalizeFlatPlan,
  toFlatPlanSummary,
} from '../domain/flat-plan';

/**
 * Postgres-backed store for the lite flat-plan tool.
 *
 * Mirrors the magazine read/write store pattern (pg pool + idempotent schema),
 * but keeps flat-plan data in its own `magazine_flat_plans` table so it can
 * never interfere with the issue/page builder data.
 */

async function pool() {
  await initMagazinePgSchema();
  const p = getMagazinePgPool();
  if (!p) throw new Error('No Postgres pool configured for flat plans');
  return p;
}

export async function listFlatPlans(): Promise<FlatPlanSummary[]> {
  const p = await pool();
  const { rows } = await p.query(
    'SELECT data FROM magazine_flat_plans ORDER BY updated_at DESC NULLS LAST',
  );
  return rows
    .map((row) => normalizeFlatPlan(row.data))
    .filter((plan): plan is FlatPlan => Boolean(plan))
    .map(toFlatPlanSummary);
}

export async function getFlatPlan(id: string): Promise<FlatPlan | null> {
  if (!id) return null;
  const p = await pool();
  const { rows } = await p.query('SELECT data FROM magazine_flat_plans WHERE id = $1', [id]);
  return rows[0] ? normalizeFlatPlan(rows[0].data) : null;
}

export async function saveFlatPlan(plan: FlatPlan): Promise<FlatPlan> {
  const p = await pool();
  const normalized = normalizeFlatPlan({
    ...plan,
    updatedAt: new Date().toISOString(),
  });
  if (!normalized) throw new Error('Invalid flat plan payload');
  await p.query(
    `INSERT INTO magazine_flat_plans (id, updated_at, data) VALUES ($1,$2,$3::jsonb)
     ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
    [normalized.id, normalized.updatedAt, JSON.stringify(normalized)],
  );
  return normalized;
}

export async function deleteFlatPlan(id: string): Promise<void> {
  if (!id) return;
  const p = await pool();
  await p.query('DELETE FROM magazine_flat_plans WHERE id = $1', [id]);
}
