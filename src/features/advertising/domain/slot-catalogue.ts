/**
 * YBW commercial inventory — what we sell, how much of it exists in one issue,
 * and what it costs.
 *
 * Prices and capacity caps mirror YBM's rate card exactly so the two brands
 * quote the same numbers for the same product.
 *
 * PRICES ARE THE ONLY THING HERE THAT NEEDS A HUMAN DECISION — change a number
 * below and the shop, the Stripe checkout and the admin panel all reprice.
 *
 * Member rates are published figures only. The shop always charges the standard
 * price; member bookings are agreed separately with the editor, so no discount
 * is applied automatically at checkout.
 */

export type SellableKind = 'directory' | 'classified' | 'ad';
export type PlacementSize = 'full' | 'half' | 'quarter';

export type SlotDefinition = {
  /** Stable key stored on the booking row. Never change once sold. */
  key: string;
  kind: SellableKind;
  label: string;
  blurb: string;
  /** How many of these one issue can carry. A sales guard, not a page plan. */
  capacityPerEdition: number;
  pricePence: number;
  placementSize?: PlacementSize;
  /** Soft cap on listing copy so it still fits the box. 0 = not applicable. */
  bodyMaxChars: number;
  /** Percentage off for a paid YBW member (arranged with the editor). */
  memberDiscountPct: number;
  /** True when the buyer must supply a print-ready PDF (display adverts). */
  requiresSuppliedPdf: boolean;
};

export const SLOT_CATALOGUE: readonly SlotDefinition[] = [
  {
    key: 'directory-listing',
    kind: 'directory',
    label: 'Directory listing',
    blurb:
      'Your business in the printed Directory, with logo, category and a short description in front of every reader.',
    capacityPerEdition: 42,
    pricePence: 9500,
    bodyMaxChars: 320,
    memberDiscountPct: 20,
    requiresSuppliedPdf: false,
  },
  {
    key: 'classified-ad',
    kind: 'classified',
    label: 'Classified advert',
    blurb: 'A boxed line advert in the classified pages, grouped by trade.',
    capacityPerEdition: 48,
    pricePence: 4500,
    bodyMaxChars: 180,
    memberDiscountPct: 20,
    requiresSuppliedPdf: false,
  },
  {
    key: 'advertorial',
    kind: 'ad',
    label: 'Advertorial (full page)',
    blurb:
      'A full page written in the magazine voice, labelled as sponsored content, carrying your logo and call to action.',
    capacityPerEdition: 2,
    pricePence: 45000,
    placementSize: 'full',
    bodyMaxChars: 3200,
    memberDiscountPct: 10,
    requiresSuppliedPdf: false,
  },
  {
    key: 'ad-full',
    kind: 'ad',
    label: 'Display advert (full page)',
    blurb: 'Full page, 216 × 303mm including 3mm bleed. Supply a print-ready PDF.',
    capacityPerEdition: 4,
    pricePence: 65000,
    placementSize: 'full',
    bodyMaxChars: 0,
    memberDiscountPct: 10,
    requiresSuppliedPdf: true,
  },
  {
    key: 'ad-half',
    kind: 'ad',
    label: 'Display advert (half page)',
    blurb: 'Half page, horizontal. Supply a print-ready PDF.',
    capacityPerEdition: 4,
    pricePence: 39500,
    placementSize: 'half',
    bodyMaxChars: 0,
    memberDiscountPct: 10,
    requiresSuppliedPdf: true,
  },
  {
    key: 'ad-quarter',
    kind: 'ad',
    label: 'Display advert (quarter page)',
    blurb: 'Quarter page. Supply a print-ready PDF.',
    capacityPerEdition: 4,
    pricePence: 22500,
    placementSize: 'quarter',
    bodyMaxChars: 0,
    memberDiscountPct: 10,
    requiresSuppliedPdf: true,
  },
];

export function getSlot(key: string): SlotDefinition | undefined {
  return SLOT_CATALOGUE.find((s) => s.key === key);
}

export function slotsForKind(kind: SellableKind): SlotDefinition[] {
  return SLOT_CATALOGUE.filter((s) => s.kind === kind);
}

/** The published member rate for a slot, or null when there is no member rate. */
export function memberPricePence(slot: SlotDefinition): number | null {
  if (!slot.memberDiscountPct) return null;
  return Math.round(slot.pricePence * (1 - slot.memberDiscountPct / 100));
}

export function priceFor(slot: SlotDefinition, opts: { member?: boolean } = {}): number {
  const pct = opts.member ? slot.memberDiscountPct : 0;
  return Math.round(slot.pricePence * (1 - pct / 100));
}

export function formatPrice(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
