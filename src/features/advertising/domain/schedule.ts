/**
 * YBW sells into a real magazine issue that the editor has already created —
 * never into a derived calendar id. Unlike YBM, YBW is not strictly quarterly
 * and its issues are hand-made, so the shop reads `magazine_issues` and offers
 * only those that are still open for booking.
 *
 * An issue closes to bookings BOOKING_LEAD_DAYS before its publish date. That
 * is the point at which the editor has to stop taking copy and start laying the
 * magazine out in InDesign.
 */
import type { MagazineIssue } from '@/components/admin/magazine-builder/types';
import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import type { SlotDefinition } from './slot-catalogue';

export const BOOKING_LEAD_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SellableIssue = {
  id: string;
  /** What we show the buyer — the issue title, or its slug as a fallback. */
  label: string;
  publishDate: Date;
  bookingClosesAt: Date;
  closed: boolean;
};

export function issueLabel(issue: Pick<MagazineIssue, 'id' | 'title' | 'slug'>): string {
  const title = String(issue.title || '').trim();
  if (title) return title;
  const slug = String(issue.slug || '').trim();
  if (slug) return slug;
  return issue.id;
}

export function bookingCutoff(publishDate: Date): Date {
  return new Date(publishDate.getTime() - BOOKING_LEAD_DAYS * DAY_MS);
}

export function toSellableIssue(issue: MagazineIssue, now: Date = new Date()): SellableIssue | null {
  const publishDate = new Date(String(issue.publishDate || ''));
  if (Number.isNaN(publishDate.getTime())) return null;
  const bookingClosesAt = bookingCutoff(publishDate);
  return {
    id: issue.id,
    label: issueLabel(issue),
    publishDate,
    bookingClosesAt,
    closed: now >= bookingClosesAt,
  };
}

/** Every issue still open for booking, soonest first. Empty when the next issue hasn't been created. */
export async function listBookableIssues(now: Date = new Date()): Promise<SellableIssue[]> {
  let issues: MagazineIssue[] = [];
  try {
    issues = await getMagazineReadStore().getMagazineIssues();
  } catch (err) {
    console.warn('[advertising/schedule] could not read magazine issues:', err);
    return [];
  }
  return issues
    .map((i) => toSellableIssue(i, now))
    .filter((i): i is SellableIssue => i !== null && !i.closed)
    .sort((a, b) => a.publishDate.getTime() - b.publishDate.getTime() || a.id.localeCompare(b.id));
}

/** The issue the shop sells into right now, or null when nothing is open. */
export async function openIssue(now: Date = new Date()): Promise<SellableIssue | null> {
  const bookable = await listBookableIssues(now);
  return bookable[0] ?? null;
}

/** Every issue the editor has ever created, newest first — including closed ones. */
export async function listAllIssues(now: Date = new Date()): Promise<SellableIssue[]> {
  let issues: MagazineIssue[] = [];
  try {
    issues = await getMagazineReadStore().getMagazineIssues();
  } catch (err) {
    console.warn('[advertising/schedule] could not read magazine issues:', err);
    return [];
  }
  return issues
    .map((i) => toSellableIssue(i, now))
    .filter((i): i is SellableIssue => i !== null)
    .sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime() || b.id.localeCompare(a.id));
}

/** Look up one issue by id, whether or not it is still open for booking. */
export async function getIssueById(
  issueId: string,
  now: Date = new Date(),
): Promise<SellableIssue | null> {
  const found = (await listAllIssues(now)).find((i) => i.id === issueId);
  return found ?? null;
}

export function findIssue(issues: SellableIssue[], issueId: string): SellableIssue | undefined {
  return issues.find((i) => i.id === issueId);
}

export function nextIssueAfter(issues: SellableIssue[], issueId: string): SellableIssue | undefined {
  const sorted = [...issues].sort((a, b) => a.publishDate.getTime() - b.publishDate.getTime());
  const idx = sorted.findIndex((i) => i.id === issueId);
  return idx === -1 ? undefined : sorted[idx + 1];
}

/* ---------------------------------------------------------------------------
 * Availability
 * ------------------------------------------------------------------------- */

export type SlotAvailability = {
  slot: SlotDefinition;
  issue: SellableIssue;
  /** Bookings holding inventory: paid or approved. */
  committed: number;
  capacity: number;
  remaining: number;
  isFull: boolean;
  closed: boolean;
  pricePence: number;
};

export function availabilityFor(
  slot: SlotDefinition,
  input: { issue: SellableIssue; committed: number; now?: Date },
): SlotAvailability {
  const now = input.now ?? new Date();
  const capacity = slot.capacityPerEdition;
  const committed = Math.max(0, input.committed);
  const remaining = Math.max(0, capacity - committed);
  return {
    slot,
    issue: input.issue,
    committed,
    capacity,
    remaining,
    isFull: remaining === 0,
    closed: now >= input.issue.bookingClosesAt,
    pricePence: slot.pricePence,
  };
}

export function isSellable(a: SlotAvailability): boolean {
  return !a.closed && !a.isFull;
}

/**
 * Where a buyer actually lands when their chosen issue cannot take them.
 * Walks forward through the open issues; the first one with room wins.
 */
export function resolveIssueForSale(
  slot: SlotDefinition,
  input: { issues: SellableIssue[]; issueId: string; committed: number; now?: Date },
): { issue: SellableIssue; overflowed: boolean } | null {
  const ordered = [...input.issues].sort(
    (a, b) => a.publishDate.getTime() - b.publishDate.getTime() || a.id.localeCompare(b.id),
  );
  let committed = Math.max(0, input.committed);
  for (const issue of ordered) {
    const closed = (input.now ?? new Date()) >= issue.bookingClosesAt;
    const counts = issue.id === input.issueId ? committed : 0;
    if (!closed && counts < slot.capacityPerEdition) {
      return { issue, overflowed: issue.id !== input.issueId };
    }
    committed = 0;
  }
  return null;
}
