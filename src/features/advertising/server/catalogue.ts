/**
 * The public-facing view of what is for sale in the next issue. Shared by the
 * /advertise page (server-rendered) and GET /api/advertise/catalogue so the two
 * can never drift apart.
 *
 * If the database is unreachable we still return the price list with
 * availability marked as unknown — the marketing page must never hard-fail
 * because a sale system is down.
 */
import {
  formatPrice,
  memberPricePence,
  SLOT_CATALOGUE,
  type SellableKind,
  type SlotDefinition,
} from '../domain/slot-catalogue';
import { openIssue, type SellableIssue } from '../domain/schedule';
import { availabilitySnapshot } from './booking-store';

export type PublicSlot = {
  key: string;
  kind: SellableKind;
  label: string;
  blurb: string;
  pricePence: number;
  priceLabel: string;
  memberPricePence: number | null;
  memberPriceLabel: string | null;
  memberDiscountPct: number;
  capacity: number;
  remaining: number;
  isFull: boolean;
  bodyMaxChars: number;
  requiresSuppliedPdf: boolean;
};

export type PublicCatalogue = {
  /** null when no issue is open for booking yet. */
  issueId: string | null;
  issueLabel: string | null;
  issuePublishDate: string | null;
  bookingClosesAt: string | null;
  /** True when there is no issue to sell into (or it has passed its cut-off). */
  noIssueOpen: boolean;
  databaseReachable: boolean;
  slots: PublicSlot[];
};

function shape(
  slot: SlotDefinition,
  live?: { remaining: number; isFull: boolean },
): PublicSlot {
  const member = memberPricePence(slot);
  return {
    key: slot.key,
    kind: slot.kind,
    label: slot.label,
    blurb: slot.blurb,
    pricePence: slot.pricePence,
    priceLabel: formatPrice(slot.pricePence),
    memberPricePence: member,
    memberPriceLabel: member === null ? null : formatPrice(member),
    memberDiscountPct: slot.memberDiscountPct,
    capacity: slot.capacityPerEdition,
    remaining: live ? live.remaining : slot.capacityPerEdition,
    isFull: live ? live.isFull : false,
    bodyMaxChars: slot.bodyMaxChars,
    requiresSuppliedPdf: slot.requiresSuppliedPdf,
  };
}

function seal(issue: SellableIssue): Omit<PublicCatalogue, 'slots' | 'databaseReachable'> {
  return {
    issueId: issue.id,
    issueLabel: issue.label,
    issuePublishDate: issue.publishDate.toISOString(),
    bookingClosesAt: issue.bookingClosesAt.toISOString(),
    noIssueOpen: false,
  };
}

const NO_ISSUE = {
  issueId: null,
  issueLabel: null,
  issuePublishDate: null,
  bookingClosesAt: null,
  noIssueOpen: true,
} as const;

export async function publicCatalogue(): Promise<PublicCatalogue> {
  const issue = await openIssue();
  if (!issue) {
    return { ...NO_ISSUE, databaseReachable: true, slots: SLOT_CATALOGUE.map((s) => shape(s)) };
  }

  try {
    const availability = await availabilitySnapshot(issue);
    return {
      ...seal(issue),
      databaseReachable: true,
      slots: availability.map((a) =>
        shape(a.slot, { remaining: a.remaining, isFull: a.isFull }),
      ),
    };
  } catch {
    return { ...seal(issue), databaseReachable: false, slots: SLOT_CATALOGUE.map((s) => shape(s)) };
  }
}
