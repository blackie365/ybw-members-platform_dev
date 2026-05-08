import { NextResponse } from 'next/server';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, subject, message } = body;

    // 1. Validate the incoming data
    if (!firstName || !lastName || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Read Mailgun credentials from Environment Variables
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

    // Check if the user hasn't set up the keys in Vercel yet
    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      console.warn('Mailgun API keys are missing. Returning mock success.');
      // Return a 200 so the frontend still shows success while testing without keys
      return NextResponse.json({ success: true, mock: true });
    }

    // 3. Initialize Mailgun
    const mailgun = new Mailgun(formData);
    const mg = mailgun.client({ username: 'api', key: MAILGUN_API_KEY });

    // 4. Construct the email
    // Best Practice: Send FROM your verified domain, and set REPLY-TO to the user's email
    const data = {
      from: `Yorkshire Businesswoman Website <noreply@${MAILGUN_DOMAIN}>`,
      to: ['editor@yorkshirebusinesswoman.co.uk', 'dd@yorkshirebusinesswoman.co.uk'],
      'h:Reply-To': `${firstName} ${lastName} <${email}>`,
      subject: `Website Contact Form: ${subject}`,
      text: `You have received a new message from the Yorkshire Businesswoman contact form.\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`
    };

    // 5. Send the email
    const msg = await mg.messages.create(MAILGUN_DOMAIN, data);
    
    return NextResponse.json({ success: true, id: msg.id });
  } catch (error: any) {
    console.error('Error sending email via Mailgun:', error);
    // Return the actual Mailgun error message to the frontend for debugging
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}
