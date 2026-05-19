import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import FormData from 'form-data';
import Mailgun from 'mailgun.js';

// Get API Key securely
const apiKey = process.env.MAILGUN_API_KEY || '';
const domain = process.env.MAILGUN_DOMAIN || '';

if (!apiKey || !domain) {
  console.error("❌ ERROR: MAILGUN_API_KEY or MAILGUN_DOMAIN is missing in .env.local");
  process.exit(1);
}

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: apiKey,
  url: 'https://api.eu.mailgun.net' // Adjust if you're not in the EU region
});

async function sendEmail({ to, subject, html }) {
  const msgData = {
    from: `Yorkshire Businesswoman <hello@${domain}>`,
    to: [to],
    subject: subject,
    html: html
  };

  return mg.messages.create(domain, msgData);
}

const getEmailLayout = (title, content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8f6f2; margin: 0; padding: 40px 20px;">
  <table style="max-width: 600px; margin: 0 auto; background-color: #fffefb;" width="100%">
    <tr><td style="padding: 40px;">${content}</td></tr>
  </table>
</body>
</html>
`;

const getWelcomeEmailTemplate = (firstName, appUrl) => {
  const content = "<h1>Welcome to the Community</h1><p>Dear " + firstName + ",</p><p>We're absolutely delighted to welcome you...</p>";
  return getEmailLayout('Welcome to Yorkshire Businesswoman', content);
};

const getFreeWelcomeEmailTemplate = (firstName, appUrl) => {
  const content = "<h1>Welcome to the Community</h1><p>Dear " + firstName + ",</p><p>Thank you for registering as a Free Subscriber...</p>";
  return getEmailLayout('Welcome to Yorkshire Businesswoman', content);
};

const getEventTicketConfirmationEmailTemplate = (firstName, appUrl) => {
  const content = "<h1>You're going to the event!</h1><p>Hi " + firstName + ",</p><p>This email confirms your successful ticket purchase...</p>";
  return getEmailLayout('Your Ticket Confirmation', content);
};

const getPasswordResetEmailTemplate = (firstName, resetLink) => {
  const content = "<h1>Reset Your Password</h1><p>Hello " + firstName + ",</p><p>We received a request to reset the password...</p>";
  return getEmailLayout('Reset Your Password', content);
};

const getMembershipExpiringEmailTemplate = (firstName, membershipTier, expiryDate, renewalAmount) => {
  const content = "<h1>We'll Miss You</h1><p>Dear " + firstName + ",</p><p>We noticed your Yorkshire Businesswoman membership is coming to an end...</p>";
  return getEmailLayout('Your Membership is Expiring', content);
};

const getRenewalReminderEmailTemplate = (firstName, membershipTier, renewalDate, amount, daysRemaining) => {
  const content = "<h1>Membership Renewal Reminder</h1><p>Dear " + firstName + ",</p><p>This is a friendly reminder that your membership will automatically renew...</p>";
  return getEmailLayout('Membership Renewal Reminder', content);
};

const RECIPIENT = 'rob@topicuk.co.uk';

async function sendTestEmails() {
  console.log("Sending test emails to " + RECIPIENT + "...");

  try {
    await sendEmail({ to: RECIPIENT, subject: '[TEST] Welcome to Yorkshire Businesswoman (Premium)', html: getWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') });
    console.log('✅ Premium Welcome sent');

    await sendEmail({ to: RECIPIENT, subject: '[TEST] Welcome to Yorkshire Businesswoman (Free)', html: getFreeWelcomeEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') });
    console.log('✅ Free Welcome sent');

    await sendEmail({ to: RECIPIENT, subject: '[TEST] Your Event Ticket Confirmation', html: getEventTicketConfirmationEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk') });
    console.log('✅ Event Ticket sent');

    await sendEmail({ to: RECIPIENT, subject: '[TEST] Password Reset Request', html: getPasswordResetEmailTemplate('Rob', 'https://yorkshirebusinesswoman.co.uk/reset?token=test') });
    console.log('✅ Password Reset sent');

    await sendEmail({ to: RECIPIENT, subject: '[TEST] Membership Expiring', html: getMembershipExpiringEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00') });
    console.log('✅ Expiring sent');

    await sendEmail({ to: RECIPIENT, subject: '[TEST] Renewal Reminder', html: getRenewalReminderEmailTemplate('Rob', 'Premium Member', 'Dec 31, 2026', '100.00', 7) });
    console.log('✅ Renewal Reminder sent');

    console.log('🎉 All test emails sent successfully!');
  } catch (error) {
    console.error('❌ Error sending emails:', error);
  }
}

sendTestEmails();
