import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { sendEmail } from '../src/lib/email';
import { 
  getWelcomeEmailTemplate, 
  getFreeWelcomeEmailTemplate, 
  getEventTicketConfirmationEmailTemplate, 
  getPasswordResetEmailTemplate, 
  getMembershipExpiringEmailTemplate, 
  getRenewalReminderEmailTemplate 
} from '../src/lib/email-templates';

const RECIPIENT = 'rob@topicuk.co.uk';

async function sendTestEmails() {
  console.log(`Sending test emails to ${RECIPIENT}...`);

  try {
    // 1. Premium Welcome
    await sendEmail({
      to: RECIPIENT,
      subject: '[TEST] Welcome to Yorkshire Businesswoman (Premium)',
      html: getWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk')
    });
    console.log('✅ Premium Welcome sent');

    // 2. Free Welcome
    await sendEmail({
      to: RECIPIENT,
      subject: '[TEST] Welcome to Yorkshire Businesswoman (Free)',
      html: getFreeWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk')
    });
    console.log('✅ Free Welcome sent');

    // 3. Event Ticket
    await sendEmail({
      to: RECIPIENT,
      subject: '[TEST] Your Event Ticket Confirmation',
      html: getEventTicketConfirmationEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk')
    });
    console.log('✅ Event Ticket sent');

    // 4. Password Reset
    await sendEmail({
      to: RECIPIENT,
      subject: '[TEST] Password Reset Request',
      html: getPasswordResetEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk/reset?token=test')
    });
    console.log('✅ Password Reset sent');

    // 5. Expiring
    await sendEmail({
      to: RECIPIENT,
      subject: '[TEST] Membership Expiring',
      html: getMembershipExpiringEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00')
    });
    console.log('✅ Expiring sent');

    // 6. Renewal Reminder
    await sendEmail({
      to: RECIPIENT,
      subject: '[TEST] Renewal Reminder',
      html: getRenewalReminderEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00', 7)
    });
    console.log('✅ Renewal Reminder sent');

    console.log('🎉 All test emails sent successfully!');
  } catch (error) {
    console.error('❌ Error sending emails:', error);
  }
}

sendTestEmails();
