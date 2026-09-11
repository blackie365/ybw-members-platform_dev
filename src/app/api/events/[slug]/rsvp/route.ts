import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPgEventAttendeeStore } from '@/features/events/server/pg-events-store';
import { getMemberStore } from '@/features/members/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
    }
    const clerkUser = await currentUser();
    const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? '';

    const attendeeStore = getPgEventAttendeeStore();

    const existing = await attendeeStore.get(slug, userId);
    if (existing) {
      // Toggle off: user already attending → cancel RSVP
      await attendeeStore.delete(slug, userId);
      revalidatePath(`/news/${slug}`);
      revalidatePath('/events');
      const remaining = await attendeeStore.list(slug);
      return NextResponse.json({ success: true, isAttending: false, attendees: remaining });
    }

    // Toggle on: build the attendee record the same way the old client-side
    // Firestore write did, but on the VPS with verified Clerk identity so JS
    // console forges can no longer write arbitrary attendees.
    const profileData = await getMemberStore().getMemberByClerkId(userId);
    const prof = (profileData ?? {}) as Record<string, unknown>;
    const firstName = typeof prof.firstName === 'string' ? prof.firstName : clerkUser?.firstName ?? '';
    const lastName = typeof prof.lastName === 'string' ? prof.lastName : clerkUser?.lastName ?? '';
    const displayName =
      `${firstName} ${lastName}`.trim() ||
      (typeof prof.fullName === 'string' ? prof.fullName : clerkUser?.fullName ?? 'Member');
    const image =
      typeof prof.profileImage === 'string' ? prof.profileImage : clerkUser?.imageUrl ?? '';
    const company =
      typeof prof.companyName === 'string'
        ? prof.companyName
        : typeof (prof as any)['Company'] === 'string'
          ? (prof as any)['Company']
          : '';

    const attendeeData = {
      uid: userId,
      name: displayName,
      image,
      company,
      email: clerkEmail,
      timestamp: new Date().toISOString(),
    };

    await attendeeStore.upsert(slug, userId, attendeeData, {
      userId,
      email: clerkEmail,
      hasTicket: false,
    });

    revalidatePath(`/news/${slug}`);
    revalidatePath('/events');

    const remaining = await attendeeStore.list(slug);
    return NextResponse.json({ success: true, isAttending: true, attendees: remaining });
  } catch (error: any) {
    console.error('[POST events/:slug/rsvp failed:', error?.message ?? error);
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Server error' },
      { status: 500 },
    );
  }
}
