import formData from 'form-data';
import Mailgun from 'mailgun.js';

interface SendEmailParams {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export async function sendEmail({ to, bcc, subject, text, html, replyTo }: SendEmailParams) {
  const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
  const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.warn('Mailgun API keys are missing. Mocking email send to:', to);
    return { success: true, mock: true };
  }

  const mailgun = new Mailgun(formData);
  
  // Robust endpoint selection:
  // 1. Explicit process.env.MAILGUN_URL (recommended)
  // 2. Default to EU if domain ends in .co.uk (common for this project)
  // 3. Fallback to US
  let url = process.env.MAILGUN_URL;
  if (!url) {
    url = MAILGUN_DOMAIN.endsWith('.co.uk') 
      ? 'https://api.eu.mailgun.net' 
      : 'https://api.mailgun.net';
  }
  
  const mg = mailgun.client({ 
    username: 'api', 
    key: MAILGUN_API_KEY.trim(),
    url: url 
  });

  const data: any = {
    from: `Yorkshire Businesswoman <noreply@${MAILGUN_DOMAIN}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    'o:tracking-clicks': 'no',
    'o:tracking': 'no'
  };

  if (bcc) {
    data.bcc = Array.isArray(bcc) ? bcc : [bcc];
  }

  if (text) data.text = text;
  if (html) data.html = html;
  if (replyTo) data['h:Reply-To'] = replyTo;

  try {
    const msg = await mg.messages.create(MAILGUN_DOMAIN, data);
    return { success: true, id: msg.id };
  } catch (error) {
    console.error('Error sending email via Mailgun:', error);
    throw error;
  }
}
