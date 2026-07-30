import { Resend } from 'resend';
import { config } from '@/lib/config';

interface SendEmailParams {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  from?: string;
}

/** Extract the bare email address from a string that may be in "Display <addr>" format. */
function bareEmail(raw: string): string {
  if (!raw) return '';
  const angle = raw.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : raw).trim().toLowerCase();
  return candidate.includes('@') ? candidate : '';
}

/** Normalize a to/bcc field to a deduped, non-empty, @-valid list. */
function normalizeRecipients(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      list
        .map((r) => (typeof r === 'string' ? r.trim() : ''))
        .filter((r) => r && r.includes('@'))
    )
  );
}

/** Remove the sender address from recipient lists to avoid Resend's same-mailbox delivery quirk. */
function removeSenderFromRecipients(senderFromDisplay: string, recipients: string[]): string[] {
  const senderEmail = bareEmail(senderFromDisplay);
  if (!senderEmail) return recipients;
  return recipients.filter((r) => bareEmail(r) !== senderEmail);
}

export interface SendEmailResult {
  success: boolean;
  mock: boolean;
  id?: string;
  error?: unknown;
  deliveredTo: string[];
  senderFrom: string;
}

/**
 * Sends an email using Resend.
 * This is the modern, robust standard for Next.js apps on Vercel.
 *
 * Delivery note: Resend can silently skip or delay delivery when the sender
 * mailbox (bare email from `from`) also appears in `to`/`bcc`. This function
 * strips the sender out of recipient lists to preserve deliverability.
 */
export async function sendEmail({ to, bcc, subject, text, html, replyTo, from }: SendEmailParams): Promise<SendEmailResult> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const MAIL_FROM = from || config.emailFrom;

  let recipientsTo = removeSenderFromRecipients(MAIL_FROM, normalizeRecipients(to));
  const recipientsBcc = removeSenderFromRecipients(MAIL_FROM, normalizeRecipients(bcc));

  if (!recipientsTo.length && !recipientsBcc.length) {
    console.warn('sendEmail: no valid recipients after sender-filter. mock=true to avoid API 422. from=%s original_to=%o original_bcc=%o', MAIL_FROM, to, bcc);
    return { success: true, mock: true, deliveredTo: [], senderFrom: MAIL_FROM };
  }

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is missing. Mocking email send to:', recipientsTo);
    return { success: true, mock: true, deliveredTo: [...recipientsTo], senderFrom: MAIL_FROM };
  }

  const resend = new Resend(RESEND_API_KEY);

  try {
    const resendPayload: any = {
      from: MAIL_FROM,
      to: recipientsTo.length ? (recipientsTo as any) : ([] as any),
      subject,
      text: text || '',
      html: html || '',
      replyTo: replyTo,
    };
    if (recipientsBcc.length) {
      resendPayload.bcc = recipientsBcc as any;
    }
    const { data, error } = await resend.emails.send(resendPayload);

    if (error) {
      console.error('Error sending email via Resend:', error, 'recipientsTo=', recipientsTo, 'bcc=', recipientsBcc);
      throw error;
    }

    console.log('Email sent successfully via Resend:', data?.id, 'recipientsTo=', recipientsTo.join(','), 'bcc=', recipientsBcc.join(','));
    return { success: true, id: data?.id, mock: false, deliveredTo: [...recipientsTo, ...recipientsBcc], senderFrom: MAIL_FROM };
  } catch (error) {
    console.error('Error in sendEmail (Resend):', error);

    if (process.env.NODE_ENV === 'development') {
      console.warn('Resend failed in dev mode. Mocking success.');
      return { success: true, mock: true, deliveredTo: [...recipientsTo], senderFrom: MAIL_FROM };
    }

    throw error;
  }
}
