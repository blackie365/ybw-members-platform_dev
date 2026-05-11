import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recipientId, senderId, senderName, senderEmail, message } = body;

    if (!recipientId || !senderId || !message || !senderEmail || !senderName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure Mailgun is configured
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      console.warn('Mailgun API keys missing, simulating success for dev.');
      return NextResponse.json({ success: true, mock: true });
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

    // Initialize Mailgun
    const mailgun = new Mailgun(formData);
    const url = process.env.MAILGUN_URL || 'https://api.mailgun.net';
    const mg = mailgun.client({ 
      username: 'api', 
      key: MAILGUN_API_KEY.trim(),
      url: url 
    });

    // Construct Email
    const data = {
      from: `Yorkshire Businesswoman Network <noreply@${MAILGUN_DOMAIN}>`,
      to: [recipientEmail],
      'h:Reply-To': `${senderName} <${senderEmail}>`,
      subject: `New Connection Request from ${senderName}`,
      text: `Hi ${recipientName},\n\n${senderName} from the Yorkshire Businesswoman network would like to connect with you!\n\nHere is their message:\n\n"${message}"\n\n---\nYou can reply directly to this email to respond to ${senderName}.`
    };

    // Send Email
    const msg = await mg.messages.create(MAILGUN_DOMAIN, data);

    return NextResponse.json({ success: true, id: msg.id });
  } catch (error: any) {
    console.error('Error sending connection request:', error);
    return NextResponse.json({ error: error.message || 'Failed to send connection request' }, { status: 500 });
  }
}