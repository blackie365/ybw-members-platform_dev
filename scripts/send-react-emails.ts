import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Resend } from 'resend';
import { 
  getWelcomeEmailTemplate, 
  getFreeWelcomeEmailTemplate, 
  getEventTicketConfirmationEmailTemplate, 
  getPasswordResetEmailTemplate, 
  getMembershipExpiringEmailTemplate, 
  getRenewalReminderEmailTemplate 
} from '../src/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const domain = process.env.MAILGUN_DOMAIN || 'yorkshirebusinesswoman.co.uk';

async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  return resend.emails.send({
    from: `Yorkshire Businesswoman <hello@${domain}>`,
    to: to,
    subject: subject,
    html: html
  });
}

const RECIPIENT = 'rob@topicuk.co.uk';

async function sendTestEmails() {
  console.log(`Sending NEW React-based test emails via Resend to ${RECIPIENT}...`);

  try {
    const results = await Promise.all([
      sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Welcome to Yorkshire Businesswoman (Premium)', html: getWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') }),
      sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Welcome to Yorkshire Businesswoman (Free)', html: getFreeWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') }),
      sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Your Event Ticket Confirmation', html: getEventTicketConfirmationEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') }),
      sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Password Reset Request', html: getPasswordResetEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk/reset?token=test') }),
      sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Membership Expiring', html: getMembershipExpiringEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00') }),
      sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Renewal Reminder', html: getRenewalReminderEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00', 7) }),
    ]);

    results.forEach((res, i) => {
      if (res.error) console.error(`❌ Email ${i+1} failed:`, res.error);
      else console.log(`✅ Email ${i+1} sent:`, res.data?.id);
    });

    console.log('🎉 All NEW React test emails sent successfully via Resend!');
  } catch (error) {
    console.error('❌ Error sending emails:', error);
  }
}

sendTestEmails();
