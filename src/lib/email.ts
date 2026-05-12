import formData from 'form-data';
import Mailgun from 'mailgun.js';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, text, html, replyTo }: SendEmailParams) {
  const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
  const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.warn('Mailgun API keys are missing. Mocking email send to:', to);
    return { success: true, mock: true };
  }

  const mailgun = new Mailgun(formData);
  const url = process.env.MAILGUN_URL || 'https://api.mailgun.net';
  
  const mg = mailgun.client({ 
    username: 'api', 
    key: MAILGUN_API_KEY.trim(),
    url: url 
  });

  const data: any = {
    from: `Yorkshire Businesswoman <noreply@${MAILGUN_DOMAIN}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
  };

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
