/**
 * Flat-plan (page planning) domain model.
 *
 * A deliberately "lite" model: an ordered list of page slots, each with an
 * optional label, a production status, and a free-text note. The array order
 * IS the pagination, so page numbers are derived as index + 1.
 */

export type FlatPlanStatusKey =
  | "empty"
  | "copy-due"
  | "copy-in"
  | "design"
  | "proof"
  | "approved"
  | "ad";

export interface FlatPlanStatus {
  key: FlatPlanStatusKey;
  label: string;
  /** Tile background + border + text classes (Tailwind). */
  tileClass: string;
  /** Small swatch class used in legends / pickers. */
  swatchClass: string;
}

export const FLAT_PLAN_STATUSES: FlatPlanStatus[] = [
  {
    key: "empty",
    label: "Empty",
    tileClass: "bg-zinc-50 border-zinc-200 text-zinc-600",
    swatchClass: "bg-zinc-300",
  },
  {
    key: "copy-due",
    label: "Copy due",
    tileClass: "bg-sky-50 border-sky-200 text-sky-800",
    swatchClass: "bg-sky-400",
  },
  {
    key: "copy-in",
    label: "Copy in",
    tileClass: "bg-indigo-50 border-indigo-200 text-indigo-800",
    swatchClass: "bg-indigo-400",
  },
  {
    key: "design",
    label: "Design",
    tileClass: "bg-purple-50 border-purple-200 text-purple-800",
    swatchClass: "bg-purple-400",
  },
  {
    key: "proof",
    label: "Proofing",
    tileClass: "bg-amber-50 border-amber-200 text-amber-800",
    swatchClass: "bg-amber-400",
  },
  {
    key: "approved",
    label: "Approved",
    tileClass: "bg-emerald-50 border-emerald-200 text-emerald-800",
    swatchClass: "bg-emerald-500",
  },
  {
    key: "ad",
    label: "Advert",
    tileClass: "bg-rose-50 border-rose-200 text-rose-800",
    swatchClass: "bg-rose-400",
  },
];

export const DEFAULT_FLAT_PLAN_STATUS: FlatPlanStatusKey = "empty";

const STATUS_BY_KEY: Record<string, FlatPlanStatus> = FLAT_PLAN_STATUSES.reduce(
  (acc, status) => {
    acc[status.key] = status;
    return acc;
  },
  {} as Record<string, FlatPlanStatus>,
);

export function getFlatPlanStatus(key: string | undefined): FlatPlanStatus {
  return STATUS_BY_KEY[String(key)] || STATUS_BY_KEY[DEFAULT_FLAT_PLAN_STATUS];
}

export interface FlatPlanPage {
  /** Stable id so reordering doesn't re-key inputs. */
  id: string;
  label: string;
  status: FlatPlanStatusKey;
  notes?: string;
}

export interface FlatPlan {
  id: string;
  title: string;
  publication?: string;
  pages: FlatPlanPage[];
  createdAt: string;
  updatedAt: string;
}

export interface FlatPlanSummary {
  id: string;
  title: string;
  publication?: string;
  pageCount: number;
  updatedAt: string;
}

export function makeFlatPlanPage(status: FlatPlanStatusKey = DEFAULT_FLAT_PLAN_STATUS): FlatPlanPage {
  return { id: newFlatPlanPageId(), label: "", status, notes: "" };
}

export function newFlatPlanPageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toFlatPlanSummary(plan: FlatPlan): FlatPlanSummary {
  return {
    id: plan.id,
    title: plan.title,
    publication: plan.publication,
    pageCount: plan.pages?.length ?? 0,
    updatedAt: plan.updatedAt,
  };
}

/** Normalise unknown/partially-trusted data (e.g. from JSONB) into a FlatPlan. */
export function normalizeFlatPlan(raw: unknown): FlatPlan | null {
  const value = raw as Partial<FlatPlan> | null | undefined;
  if (!value || typeof value !== "object" || !value.id) return null;
  const pages = Array.isArray(value.pages)
    ? value.pages.map((page) => {
        const p = (page || {}) as Partial<FlatPlanPage>;
        const status = getFlatPlanStatus(p.status as string).key;
        return {
          id: String(p.id || newFlatPlanPageId()),
          label: String(p.label || ""),
          status,
          notes: p.notes ? String(p.notes) : "",
        } satisfies FlatPlanPage;
      })
    : [];
  return {
    id: String(value.id),
    title: String(value.title || "Untitled flat plan"),
    publication: value.publication ? String(value.publication) : undefined,
    pages,
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || new Date().toISOString()),
  };
}
