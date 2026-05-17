import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { 
  getWelcomeEmailTemplate, 
  getFreeWelcomeEmailTemplate, 
  getEventTicketConfirmationEmailTemplate, 
  getPasswordResetEmailTemplate, 
  getMembershipExpiringEmailTemplate, 
  getRenewalReminderEmailTemplate 
} from '../src/lib/email-templates';

const apiKey = process.env.MAILGUN_API_KEY || '';
const domain = process.env.MAILGUN_DOMAIN || '';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({ username: 'api', key: apiKey, url: 'https://api.eu.mailgun.net' });

async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  const msgData = {
    from: `Yorkshire Businesswoman <hello@${domain}>`,
    to: [to],
    subject: subject,
    html: html
  };
  return mg.messages.create(domain, msgData);
}

const RECIPIENT = 'rob@topicuk.co.uk';

async function sendTestEmails() {
  console.log(`Sending NEW React-based test emails to ${RECIPIENT}...`);

  try {
    await sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Welcome to Yorkshire Businesswoman (Premium)', html: getWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') });
    console.log('✅ Premium Welcome sent');

    await sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Welcome to Yorkshire Businesswoman (Free)', html: getFreeWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') });
    console.log('✅ Free Welcome sent');

    await sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Your Event Ticket Confirmation', html: getEventTicketConfirmationEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') });
    console.log('✅ Event Ticket sent');

    await sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Password Reset Request', html: getPasswordResetEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk/reset?token=test') });
    console.log('✅ Password Reset sent');

    await sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Membership Expiring', html: getMembershipExpiringEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00') });
    console.log('✅ Expiring sent');

    await sendEmail({ to: RECIPIENT, subject: '[NEW DESIGN] Renewal Reminder', html: getRenewalReminderEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00', 7) });
    console.log('✅ Renewal Reminder sent');

    console.log('🎉 All NEW React test emails sent successfully!');
  } catch (error) {
    console.error('❌ Error sending emails:', error);
  }
}

sendTestEmails();
