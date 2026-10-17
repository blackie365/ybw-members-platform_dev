'use server';

import { checkAdmin } from '@/lib/server/auth-utils';
import {
  deleteFlatPlan,
  getFlatPlan,
  listFlatPlans,
  saveFlatPlan,
} from '@/features/magazine/server/flat-plan-store';
import {
  FlatPlan,
  FlatPlanPage,
  getFlatPlanStatus,
  newFlatPlanPageId,
  normalizeFlatPlan,
} from '@/features/magazine/domain/flat-plan';
import { safeRevalidatePath } from './_helpers';

function sanitizePages(pages: unknown): FlatPlanPage[] {
  if (!Array.isArray(pages)) return [];
  return pages.map((page) => {
    const p = (page || {}) as Partial<FlatPlanPage>;
    return {
      id: String(p.id || newFlatPlanPageId()),
      label: String(p.label || '').slice(0, 160),
      status: getFlatPlanStatus(p.status as string).key,
      notes: String(p.notes || '').slice(0, 2000),
    };
  });
}

export async function listFlatPlansAction() {
  try {
    await checkAdmin();
    const plans = await listFlatPlans();
    return { success: true as const, data: plans };
  } catch (error: any) {
    console.error('Error in listFlatPlansAction:', error);
    return { success: false as const, error: error?.message || 'Failed to list flat plans' };
  }
}

export async function getFlatPlanAction(id: string) {
  try {
    await checkAdmin();
    const plan = await getFlatPlan(String(id || ''));
    if (!plan) return { success: false as const, error: 'Flat plan not found' };
    return { success: true as const, data: plan };
  } catch (error: any) {
    console.error('Error in getFlatPlanAction:', error);
    return { success: false as const, error: error?.message || 'Failed to load flat plan' };
  }
}

export async function saveFlatPlanAction(input: {
  id?: string;
  title?: string;
  publication?: string;
  pages?: unknown;
}) {
  try {
    await checkAdmin();
    const now = new Date().toISOString();
    const candidate = normalizeFlatPlan({
      id: input?.id || `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(input?.title || '').trim() || 'Untitled flat plan',
      publication: input?.publication ? String(input.publication).trim() : undefined,
      pages: sanitizePages(input?.pages),
      createdAt: now,
      updatedAt: now,
    });
    if (!candidate) return { success: false as const, error: 'Invalid flat plan payload' };

    const saved = await saveFlatPlan(candidate);
    safeRevalidatePath('/admin/magazine/plan');
    return { success: true as const, id: saved.id, data: saved };
  } catch (error: any) {
    console.error('Error in saveFlatPlanAction:', error);
    return { success: false as const, error: error?.message || 'Failed to save flat plan' };
  }
}

export async function deleteFlatPlanAction(id: string) {
  try {
    await checkAdmin();
    await deleteFlatPlan(String(id || ''));
    safeRevalidatePath('/admin/magazine/plan');
    return { success: true as const };
  } catch (error: any) {
    console.error('Error in deleteFlatPlanAction:', error);
    return { success: false as const, error: error?.message || 'Failed to delete flat plan' };
  }
}
