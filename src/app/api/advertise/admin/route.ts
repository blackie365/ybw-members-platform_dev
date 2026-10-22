/**
 * Editor-only booking review for YBW advertising.
 *
 *   GET  /api/advertise/admin?issueId=<magazine_issues.id>
 *   POST /api/advertise/admin   { id, action: 'approve'|'reject'|'reset', note? }
 *
 * Guarded by the platform admin check (Clerk), the same one every other YBW
 * admin surface uses — not YBM's CRON_SECRET.
 *
 * Approving is the single act that puts a paid booking onto the planning board,
 * so approval is refused when the slot is already full: capacity cannot be
 * silently exceeded by clicking approve.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdmin } from '@/lib/server/auth-utils';
import {
  availabilitySnapshot,
  formatPrice,
  getIssueById,
  getSlot,
  listAllIssues,
  listBookings,
  openIssue,
  setBookingStatus,
  type BookingRecord,
  type BookingStatus,
} from '@/features/advertising/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function guard(): Promise<{ ok: true; userId: string } | { ok: false; status: number }> {
  try {
    const userId = await checkAdmin();
    return { ok: true, userId };
  } catch {
    return { ok: false, status: 403 };
  }
}

function serialize(rec: BookingRecord) {
  const slot = getSlot(rec.slot_key);
  return {
    id: rec.id,
    bookingRef: rec.booking_ref,
    issueId: rec.issue_id,
    issueLabel: rec.issue_label,
    kind: rec.kind,
    slotKey: rec.slot_key,
    slotLabel: slot?.label ?? rec.slot_key,
    status: rec.status,
    client: rec.client,
    paidCategory: rec.paid_category,
    bodyHtml: rec.body_html,
    logoUrl: rec.logo_url,
    placementSize: rec.placement_size,
    memberRate: rec.member_rate,
    contactName: rec.contact_name,
    contactEmail: rec.contact_email,
    contactPhone: rec.contact_phone,
    websiteUrl: rec.website_url,
    amountPence: rec.amount_pence,
    amountLabel: formatPrice(rec.amount_pence),
    paidAt: rec.paid_at ? rec.paid_at.toISOString() : null,
    editorialNote: rec.editorial_note,
    reviewedBy: rec.reviewed_by,
    createdAt: rec.created_at.toISOString(),
  };
}

export async function GET(req: Request) {
  const auth = await guard();
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: auth.status });

  const url = new URL(req.url);
  const requestedId = url.searchParams.get('issueId');

  try {
    const issues = await listAllIssues();
    const issue =
      (requestedId ? await getIssueById(requestedId) : null) ?? (await openIssue()) ?? issues[0] ?? null;

    if (!issue) {
      return NextResponse.json({ issue: null, issues: [], availability: [], bookings: [] });
    }

    const [availability, bookings] = await Promise.all([
      availabilitySnapshot(issue),
      listBookings({ issueId: issue.id }),
    ]);

    return NextResponse.json({
      issue: {
        id: issue.id,
        label: issue.label,
        publishDate: issue.publishDate.toISOString(),
        bookingClosesAt: issue.bookingClosesAt.toISOString(),
        closed: issue.closed,
      },
      issues: issues.map((i) => ({
        id: i.id,
        label: i.label,
        publishDate: i.publishDate.toISOString(),
        closed: i.closed,
      })),
      availability: availability.map((a) => ({
        slotKey: a.slot.key,
        label: a.slot.label,
        kind: a.slot.kind,
        committed: a.committed,
        capacity: a.capacity,
        remaining: a.remaining,
        isFull: a.isFull,
      })),
      bookings: bookings.map(serialize),
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'booking_store_unavailable', detail: e instanceof Error ? e.message : undefined },
      { status: 503 },
    );
  }
}

const ActionSchema = z.object({
  id: z.coerce.number().int().positive(),
  action: z.enum(['approve', 'reject', 'reset']),
  note: z.string().trim().max(2000).optional(),
});

const NEXT_STATUS: Record<z.infer<typeof ActionSchema>['action'], BookingStatus> = {
  approve: 'approved',
  reject: 'rejected',
  reset: 'paid',
};

export async function POST(req: Request) {
  const auth = await guard();
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: auth.status });

  let body: z.infer<typeof ActionSchema>;
  try {
    body = ActionSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: 'invalid_request', detail: e instanceof Error ? e.message : undefined },
      { status: 400 },
    );
  }

  try {
    const all = await listBookings();
    const target = all.find((b) => b.id === body.id);
    if (!target) return NextResponse.json({ error: 'booking_not_found' }, { status: 404 });

    const slot = getSlot(target.slot_key);
    if (!slot) return NextResponse.json({ error: 'unknown_slot' }, { status: 400 });

    if (body.action === 'approve') {
      const issue = await getIssueById(target.issue_id);
      if (!issue) return NextResponse.json({ error: 'issue_not_found' }, { status: 404 });

      // Never let approval push an issue over what we agreed to carry.
      const availability = await availabilitySnapshot(issue);
      const forSlot = availability.find((a) => a.slot.key === slot.key);
      const alreadyCommitted = forSlot?.committed ?? 0;
      const counted = target.status === 'paid' || target.status === 'approved';
      if (!counted && alreadyCommitted >= slot.capacityPerEdition) {
        return NextResponse.json(
          {
            error: 'slot_full',
            detail: `${slot.label} is full for ${issue.label} (${alreadyCommitted}/${slot.capacityPerEdition}). Move this booking to the next issue or free a slot.`,
            capacity: slot.capacityPerEdition,
            committed: alreadyCommitted,
          },
          { status: 409 },
        );
      }
    }

    const updated = await setBookingStatus(body.id, NEXT_STATUS[body.action], {
      note: body.note ?? null,
      reviewedBy: auth.userId,
    });
    if (!updated) return NextResponse.json({ error: 'booking_not_found' }, { status: 404 });

    return NextResponse.json({ booking: serialize(updated) });
  } catch (e) {
    return NextResponse.json(
      { error: 'booking_store_unavailable', detail: e instanceof Error ? e.message : undefined },
      { status: 503 },
    );
  }
}
