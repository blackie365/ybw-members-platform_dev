import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, link, imageUrl, userId, userEmail, userName } = body;

    if (!userId || !title || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save the offer submission to Firestore
    const docRef = await adminDb.collection('offer_requests').add({
      title,
      description,
      link: link || '',
      imageUrl: imageUrl || '',
      userId,
      userEmail,
      userName,
      status: 'pending', // Pending admin approval
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('Error creating offer request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
