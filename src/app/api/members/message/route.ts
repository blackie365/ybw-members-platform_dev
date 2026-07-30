import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const body = await req.json();
    const { recipientId, senderId, senderName, senderEmail, message } = body;

    if (senderId !== userId) {
      return NextResponse.json({ error: 'Sender ID does not match authenticated user' }, { status: 403 });
    }

    if (!recipientId || !senderId || !message || !senderEmail || !senderName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch Recipient Email from Firestore
    const recipientDoc = await adminDb.collection('newMemberCollection').doc(recipientId).get();
    if (!recipientDoc.exists) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const recipientData = recipientDoc.data();
    const recipientEmail = recipientData?.email;
    const recipientName = recipientData?.firstName || 'Member';

    if (!recipientEmail) {
      return NextResponse.json({ error: 'Recipient does not have a valid email address' }, { status: 400 });
    }

    // Send Email using the central email library
    const result = await sendEmail({
      to: recipientEmail,
      replyTo: `${senderName} <${senderEmail}>`,
      subject: `New Connection Request from ${senderName}`,
      text: `Hi ${recipientName},\n\n${senderName} from the Yorkshire Businesswoman network would like to connect with you!\n\nHere is their message:\n\n"${message}"\n\n---\nYou can reply directly to this email to respond to ${senderName}.`
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error sending connection request:', error);
    return NextResponse.json({ error: error.message || 'Failed to send connection request' }, { status: 500 });
  }
}
