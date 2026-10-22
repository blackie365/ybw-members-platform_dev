/**
 * Postgres-backed store for YBW advertising bookings.
 *
 * This is the commercial source of truth for space sold in the magazine. The
 * editor's planning board reads from here; nothing is edited by hand.
 *
 * A booking holds its slot once money has been taken ('paid') or the editor has
 * waved it through ('approved'). Unpaid enquiries and rejected/cancelled rows
 * do not consume inventory.
 */
import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';
import {
  availabilityFor,
  resolveIssueForSale,
  type SellableIssue,
  type SlotAvailability,
} from '../domain/schedule';
import {
  getSlot,
  SLOT_CATALOGUE,
  type PlacementSize,
  type SellableKind,
} from '../domain/slot-catalogue';
import { initAdBookingSchema } from './pg-schema';

export type BookingStatus = 'enquiry' | 'paid' | 'approved' | 'rejected' | 'cancelled';

/** Statuses that hold inventory. */
export const COMMITTED_STATUSES: readonly BookingStatus[] = ['paid', 'approved'];

export type BookingRecord = {
  id: number;
  booking_ref: string;
  issue_id: string;
  issue_label: string;
  issue_publish_date: Date | null;
  kind: SellableKind;
  slot_key: string;
  status: BookingStatus;
  client: string;
  paid_category: string | null;
  body_html: string | null;
  logo_url: string | null;
  supplied_pdf_path: string | null;
  placement_size: PlacementSize | null;
  page_affinity: number | null;
  member_rate: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  amount_pence: number;
  currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  paid_at: Date | null;
  editorial_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

async function pool() {
  await initAdBookingSchema();
  const p = getMagazinePgPool();
  if (!p) throw new Error('Advertising bookings are unavailable: no database configured.');
  return p;
}

const REF_PREFIX: Record<SellableKind, string> = {
  directory: 'DIR',
  classified: 'CLS',
  ad: 'AD',
};

/** Short, stable, sortable issue tag for the human-readable reference. */
function issueShort(issue: SellableIssue): string {
  const d = issue.publishDate;
  if (Number.isNaN(d.getTime())) return 'UNK';
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function makeBookingRef(kind: SellableKind, issue: SellableIssue, id: number): string {
  return `${REF_PREFIX[kind]}-${issueShort(issue)}-${String(id).padStart(4, '0')}`;
}

const COLUMNS = `
  id, booking_ref, issue_id, issue_label, issue_publish_date, kind, slot_key,
  status, client, paid_category, body_html, logo_url, supplied_pdf_path,
  placement_size, page_affinity, member_rate, contact_name, contact_email,
  contact_phone, website_url, amount_pence, currency, stripe_session_id,
  stripe_payment_intent, paid_at, editorial_note, reviewed_by, reviewed_at,
  created_at, updated_at
`;

export type CreateEnquiryInput = {
  issue: SellableIssue;
  slotKey: string;
  client: string;
  contactName?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  paidCategory?: string | null;
  bodyHtml?: string | null;
  logoUrl?: string | null;
  /** Set only when the editor has agreed a member rate. */
  memberRate?: boolean;
  /** Overrides the catalogue price. */
  amountPence?: number;
};

export async function createEnquiry(input: CreateEnquiryInput): Promise<BookingRecord> {
  const slot = getSlot(input.slotKey);
  if (!slot) throw new Error(`Unknown slot_key "${input.slotKey}"`);

  const amount =
    input.amountPence ??
    Math.round(slot.pricePence * (1 - (input.memberRate ? slot.memberDiscountPct : 0) / 100));

  const p = await pool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO ybw_ad_bookings
         (booking_ref, issue_id, issue_label, issue_publish_date, kind, slot_key, status,
          client, paid_category, body_html, logo_url, contact_name, contact_email,
          contact_phone, website_url, member_rate, placement_size, amount_pence, currency)
       VALUES ('', $1, $2, $3, $4, $5, 'enquiry', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'GBP')
       RETURNING id`,
      [
        input.issue.id,
        input.issue.label,
        input.issue.publishDate.toISOString(),
        slot.kind,
        slot.key,
        input.client,
        input.paidCategory ?? null,
        input.bodyHtml ?? null,
        input.logoUrl ?? null,
        input.contactName ?? null,
        input.contactEmail,
        input.contactPhone ?? null,
        input.websiteUrl ?? null,
        input.memberRate === true,
        slot.placementSize ?? null,
        amount,
      ],
    );
    const id = inserted.rows[0]!.id;
    const ref = makeBookingRef(slot.kind, input.issue, id);
    const row = await client.query<BookingRecord>(
      `UPDATE ybw_ad_bookings SET booking_ref = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, ref],
    );
    await client.query('COMMIT');
    return row.rows[0]!;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function attachStripeSession(bookingId: number, sessionId: string): Promise<void> {
  const p = await pool();
  await p.query(
    `UPDATE ybw_ad_bookings SET stripe_session_id = $2, updated_at = now() WHERE id = $1`,
    [bookingId, sessionId],
  );
}

/** Idempotent: a Stripe webhook may fire more than once for the same session. */
export async function markPaidBySession(
  sessionId: string,
  paymentIntent?: string | null,
): Promise<BookingRecord | null> {
  const p = await pool();
  const res = await p.query<BookingRecord>(
    `UPDATE ybw_ad_bookings
        SET status = CASE WHEN status = 'enquiry' THEN 'paid'::ybw_ad_booking_status ELSE status END,
            stripe_payment_intent = COALESCE($2, stripe_payment_intent),
            paid_at = COALESCE(paid_at, now()),
            updated_at = now()
      WHERE stripe_session_id = $1
      RETURNING ${COLUMNS}`,
    [sessionId, paymentIntent ?? null],
  );
  return res.rows[0] ?? null;
}

export async function setBookingStatus(
  bookingId: number,
  status: BookingStatus,
  opts: { note?: string | null; reviewedBy?: string | null } = {},
): Promise<BookingRecord | null> {
  const p = await pool();
  const res = await p.query<BookingRecord>(
    `UPDATE ybw_ad_bookings
        SET status = $2,
            editorial_note = COALESCE($3, editorial_note),
            reviewed_by = COALESCE($4, reviewed_by),
            reviewed_at = CASE WHEN $2 IN ('approved','rejected') THEN now() ELSE reviewed_at END,
            updated_at = now()
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [bookingId, status, opts.note ?? null, opts.reviewedBy ?? null],
  );
  return res.rows[0] ?? null;
}

export async function listBookings(
  filter: { issueId?: string; statuses?: BookingStatus[]; kind?: SellableKind } = {},
): Promise<BookingRecord[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.issueId) {
    params.push(filter.issueId);
    where.push(`issue_id = $${params.length}`);
  }
  if (filter.statuses && filter.statuses.length) {
    params.push(filter.statuses);
    where.push(`status = ANY($${params.length}::ybw_ad_booking_status[])`);
  }
  if (filter.kind) {
    params.push(filter.kind);
    where.push(`kind = $${params.length}::ybw_ad_booking_kind`);
  }
  const sql = `SELECT ${COLUMNS} FROM ybw_ad_bookings
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY created_at DESC`;
  const p = await pool();
  const res = await p.query<BookingRecord>(sql, params);
  return res.rows;
}

/** How many bookings are holding inventory, per slot_key, for one issue. */
export async function committedCounts(issueId: string): Promise<Record<string, number>> {
  const p = await pool();
  const res = await p.query<{ slot_key: string; n: string }>(
    `SELECT slot_key, COUNT(*)::text AS n
       FROM ybw_ad_bookings
      WHERE issue_id = $1 AND status = ANY($2::ybw_ad_booking_status[])
      GROUP BY slot_key`,
    [issueId, COMMITTED_STATUSES],
  );
  const out: Record<string, number> = {};
  for (const r of res.rows) out[r.slot_key] = Number(r.n);
  return out;
}

/** The whole catalogue with live availability for one issue. */
export async function availabilitySnapshot(
  issue: SellableIssue,
  now: Date = new Date(),
): Promise<SlotAvailability[]> {
  const counts = await committedCounts(issue.id);
  return SLOT_CATALOGUE.map((slot) =>
    availabilityFor(slot, { issue, committed: counts[slot.key] ?? 0, now }),
  );
}

export type SaleTarget = {
  issue: SellableIssue;
  overflowed: boolean;
  availability: SlotAvailability;
};

export type ResolveSaleResult =
  | { ok: true; target: SaleTarget }
  | { ok: false; reason: 'unknown_slot' | 'sold_out' };

/** Which issue a buyer actually gets when they ask for a slot right now. */
export async function resolveSale(
  slotKey: string,
  requested: SellableIssue,
  openIssues: SellableIssue[],
  now: Date = new Date(),
): Promise<ResolveSaleResult> {
  const slot = getSlot(slotKey);
  if (!slot) return { ok: false, reason: 'unknown_slot' };

  const counts = await committedCounts(requested.id);
  const resolved = resolveIssueForSale(slot, {
    issues: openIssues.length ? openIssues : [requested],
    issueId: requested.id,
    committed: counts[slot.key] ?? 0,
    now,
  });
  if (!resolved) return { ok: false, reason: 'sold_out' };

  const availability = availabilityFor(slot, {
    issue: resolved.issue,
    committed: resolved.issue.id === requested.id ? counts[slot.key] ?? 0 : 0,
    now,
  });
  return { ok: true, target: { ...resolved, availability } };
}
