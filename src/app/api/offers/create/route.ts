import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { getOfferRequestStore } from '@/features/offers/server/offer-request-store';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, link, imageUrl, isMembersOnly, userEmail, userName } = body;

    if (!userId || !title || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const docData = {
      title,
      description,
      link: link || '',
      imageUrl: imageUrl || '',
      isMembersOnly: isMembersOnly ?? true,
      userId,
      userEmail,
      userName,
      status: 'pending', // Pending admin approval
      createdAt: new Date().toISOString(),
    };

    const created = await getOfferRequestStore().create({ data: docData });

    // Revalidate paths
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/offers');
    revalidatePath('/offers');

    return NextResponse.json({ success: true, id: created.id });
  } catch (error: any) {
    console.error('[Offers API] Error creating offer request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
