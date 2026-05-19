import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { getPasswordResetEmailTemplate } from '../src/lib/email-templates';

const apiKey = process.env.MAILGUN_API_KEY || '';
const domain = process.env.MAILGUN_DOMAIN || '';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({ username: 'api', key: apiKey, url: 'https://api.eu.mailgun.net' });

async function sendTestEmails() {
  console.log(`Sending password reset instructions to rob@topicuk.co.uk...`);
  try {
    const html = await getPasswordResetEmailTemplate('Rob');
    
    const msgData = {
      from: `Yorkshire Businesswoman <hello@${domain}>`,
      to: ['rob@topicuk.co.uk'],
      subject: '[TEST] Action Required: Reset Your Password',
      html: html
    };
    
    await mg.messages.create(domain, msgData);
    console.log('✅ Instructions sent successfully!');
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
}

sendTestEmails();