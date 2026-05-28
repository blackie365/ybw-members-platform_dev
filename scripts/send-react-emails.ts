import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Resend } from 'resend';
import { 
  getWelcomeEmailTemplate, 
  getFreeWelcomeEmailTemplate, 
  getEventTicketConfirmationEmailTemplate, 
  getPasswordResetEmailTemplate, 
  getMembershipExpiringEmailTemplate, 
  getRenewalReminderEmailTemplate,
  getPaymentReceiptEmailTemplate,
  getAccountUpdateEmailTemplate
} from '../src/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const domain = 'yorkshirebusinesswoman.co.uk';

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
    // Generate templates (awaiting the promises)
    const welcomePremium = await getWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk');
    const welcomeFree = await getFreeWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk');
    const ticket = await getEventTicketConfirmationEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk');
    const reset = await getPasswordResetEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk/reset?token=test');
    const expiring = await getMembershipExpiringEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00');
    const renewal = await getRenewalReminderEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00', 7);
    const receipt = await getPaymentReceiptEmailTemplate('Rob', 'INV-1234', 'May 28, 2026', 'Premium Member', '100.00', 'Annual', 'Visa ending in 4242');
    const accountUpdate = await getAccountUpdateEmailTemplate('Rob', 'profile', 'May 28, 2026', '14:30');

    // Send emails sequentially with small delay to avoid rate limiting
    const emails = [
      { subject: '[NEW DESIGN] Welcome to Yorkshire Businesswoman (Premium)', html: welcomePremium },
      { subject: '[NEW DESIGN] Welcome to Yorkshire Businesswoman (Free)', html: welcomeFree },
      { subject: '[NEW DESIGN] Your Event Ticket Confirmation', html: ticket },
      { subject: '[NEW DESIGN] Password Reset Request', html: reset },
      { subject: '[NEW DESIGN] Membership Expiring', html: expiring },
      { subject: '[NEW DESIGN] Renewal Reminder', html: renewal },
      { subject: '[NEW DESIGN] Payment Receipt', html: receipt },
      { subject: '[NEW DESIGN] Account Updated', html: accountUpdate },
    ];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      console.log(`Sending email ${i + 1}/${emails.length}: ${email.subject}...`);
      const res = await sendEmail({ to: RECIPIENT, subject: email.subject, html: email.html });
      
      if (res.error) {
        console.error(`❌ Email ${i + 1} failed:`, res.error);
      } else {
        console.log(`✅ Email ${i + 1} sent:`, res.data?.id);
      }
      
      // Wait 300ms between sends
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('🎉 All NEW React test emails sent successfully via Resend!');
  } catch (error) {
    console.error('❌ Error sending emails:', error);
  }
}

sendTestEmails();
