import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { config } from '@/lib/config';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, subject, message } = body;

    // 1. Validate the incoming data
    if (!firstName || !lastName || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Send the email using the central email library
    const result = await sendEmail({
      to: config.contactRecipients,
      replyTo: `${firstName} ${lastName} <${email}>`,
      subject: `Website Contact Form: ${subject}`,
      text: `You have received a new message from the Yorkshire Businesswoman contact form.\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in contact form route:', error);
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}
