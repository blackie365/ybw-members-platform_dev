import { Resend } from 'resend';

interface SendEmailParams {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  from?: string;
}

/**
 * Sends an email using Resend.
 * This is the modern, robust standard for Next.js apps on Vercel.
 */
export async function sendEmail({ to, bcc, subject, text, html, replyTo, from }: SendEmailParams) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is missing. Mocking email send to:', to);
    return { success: true, mock: true };
  }

  const resend = new Resend(RESEND_API_KEY);

  const MAIL_FROM = from || process.env.EMAIL_FROM || 'Yorkshire Businesswoman <hello@yorkshirebusinesswoman.co.uk>';

  try {
    const { data, error } = await resend.emails.send({
      from: MAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      subject,
      text: text || '',
      html: html || '',
      reply_to: replyTo,
    });

    if (error) {
      console.error('Error sending email via Resend:', error);
      throw error;
    }

    console.log('Email sent successfully via Resend:', data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Error in sendEmail (Resend):', error);
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('Resend failed in dev mode. Mocking success.');
      return { success: true, mock: true };
    }
    
    throw error;
  }
}
