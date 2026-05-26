import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, link, imageUrl, isMembersOnly, userId, userEmail, userName } = body;

    console.log('[Offers API] Received submission:', { title, userId, userEmail });

    if (!userId || !title || !description) {
      console.warn('[Offers API] Missing required fields:', { userId: !!userId, title: !!title, description: !!description });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!adminDb) {
      console.error('[Offers API] Firestore adminDb is not initialized');
      return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
    }

    // Save the offer submission to Firestore
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

    const docRef = await adminDb.collection('offer_requests').add(docData);
    console.log('[Offers API] Successfully created offer doc:', docRef.id);

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('[Offers API] Error creating offer request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
