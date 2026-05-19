import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { getPasswordResetEmailTemplate } from '../src/lib/email-templates';

// Ensure Firebase is initialized
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID || 'newmembersdirectory130325';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const adminAuth = admin.auth();

const apiKey = process.env.MAILGUN_API_KEY || '';
const domain = process.env.MAILGUN_DOMAIN || '';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({ username: 'api', key: apiKey, url: 'https://api.eu.mailgun.net' });

// Add the list of emails you want to send the reset link to here
const MEMBER_EMAILS: string[] = [
  // 'rob@topicuk.co.uk',
  // 'member1@example.com',
];

async function sendBulkPasswordResets() {
  if (MEMBER_EMAILS.length === 0) {
    console.log('No emails provided in MEMBER_EMAILS array. Please add some and run again.');
    return;
  }

  console.log(`Starting bulk password reset for ${MEMBER_EMAILS.length} members...`);

  for (const email of MEMBER_EMAILS) {
    try {
      console.log(`Processing: ${email}`);
      
      // 1. We no longer generate the link here because it expires too fast.
      // Instead, we point them to the /forgot-password form on the site.
      
      // 2. We can try to get the user's first name, or just use a generic greeting
      let firstName = 'Member';
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        if (userRecord.displayName) {
          firstName = userRecord.displayName.split(' ')[0];
        }
      } catch (e) {
        console.warn(`Could not fetch user record for ${email}, using generic greeting.`);
      }

      // 3. Generate HTML template (now takes only firstName)
      const html = await getPasswordResetEmailTemplate(firstName);
      
      // 4. Send via Mailgun
      const msgData = {
        from: `Yorkshire Businesswoman <hello@${domain}>`,
        to: [email],
        subject: 'Action Required: Please Reset Your Password',
        html: html
      };
      
      await mg.messages.create(domain, msgData);
      console.log(`✅ Successfully sent reset instructions to ${email}`);
      
    } catch (error) {
      console.error(`❌ Failed to process ${email}:`, error);
    }
  }

  console.log('🎉 Bulk password reset process completed!');
}

sendBulkPasswordResets();