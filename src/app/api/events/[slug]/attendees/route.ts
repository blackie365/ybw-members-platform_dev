import { NextResponse } from 'next/server';
import { getPgEventAttendeeStore } from '@/features/events/server/pg-events-store';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface AttendeePayload {
  uid?: string;
  email?: string;
  name: string;
  image?: string;
  company?: string;
  timestamp?: unknown;
  quantity?: number;
  guestInfo?: string;
  hasTicket?: boolean;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const rows = await getPgEventAttendeeStore().list(slug);
    const attendees: AttendeePayload[] = rows.map((r) => {
      const d = r.data;
      return {
        uid: typeof d.uid === 'string' ? d.uid : r.userId,
        email: typeof d.email === 'string' ? d.email : r.email,
        name:
          typeof d.name === 'string'
            ? d.name
            : (d as any).firstName && (d as any).lastName
              ? `${(d as any).firstName} ${(d as any).lastName}`
              : r.userId ?? 'Member',
        image: typeof d.image === 'string' ? d.image : (d as any).profileImage ?? '',
        company:
          typeof d.company === 'string'
            ? d.company
            : (d as any).companyName ?? (d as any)['Company'] ?? '',
        timestamp:
          typeof d.timestamp === 'string' || d.timestamp instanceof Date
            ? d.timestamp
            : r.createdAt,
        quantity: typeof d.quantity === 'number' ? d.quantity : undefined,
        guestInfo: typeof d.guestInfo === 'string' ? d.guestInfo : undefined,
        hasTicket: r.hasTicket === true || d.hasTicket === true,
      };
    });
    return NextResponse.json({
      success: true,
      attendees,
      ttlMs: 5_000,
    });
  } catch (error: any) {
    console.error('[GET events/:slug/attendees] failed:', error?.message ?? error);
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Server error', attendees: [] },
      { status: 500 },
    );
  }
}
