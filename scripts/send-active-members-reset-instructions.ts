import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { getPasswordResetEmailTemplate } from '../src/lib/email-templates';

const apiKey = process.env.MAILGUN_API_KEY || '';
const domain = process.env.MAILGUN_DOMAIN || '';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({ username: 'api', key: apiKey, url: 'https://api.eu.mailgun.net' });

const CSV_PATH = path.join(__dirname, '../../v0-membership-app-for-ybw/active_members_recent.csv');

async function sendActiveMembersResetEmails() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found at ${CSV_PATH}`);
    return;
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  // Skip header
  const members = lines.slice(1).map(line => {
    // Basic CSV parsing for "email","name",...
    const parts = line.split('","').map(p => p.replace(/"/g, '').trim());
    return {
      email: parts[0],
      name: parts[1] === 'N/A' ? 'Member' : parts[1]
    };
  });

  console.log(`Ready to send reset instructions to ${members.length} active members.`);
  console.log('--- SCRIPT PREPARED BUT NOT RUN ---');
  console.log('To actually send, you will need to confirm the next step.');
  
  // I will create a separate "RUN" function that I only call if specifically told to.
  // For now, this just validates the list.
  
  const sample = members.slice(0, 3);
  console.log('\nSample of recipients:');
  console.table(sample);
}

// Exported function to be called when user gives the word
export async function executeSend() {
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  const members = lines.slice(1).map(line => {
    const parts = line.split('","').map(p => p.replace(/"/g, '').trim());
    return {
      email: parts[0],
      name: parts[1] === 'N/A' ? 'Member' : parts[1]
    };
  });

  console.log(`🚀 Starting bulk send to ${members.length} members...`);

  for (const member of members) {
    try {
      const html = await getPasswordResetEmailTemplate(member.name);
      
      const msgData = {
        from: `Yorkshire Businesswoman <hello@${domain}>`,
        to: [member.email],
        subject: 'Action Required: Please Reset Your Password',
        html: html
      };
      
      await mg.messages.create(domain, msgData);
      console.log(`✅ Sent to: ${member.email}`);
      
      // Small delay to avoid hitting rate limits too hard
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ Failed to send to ${member.email}:`, error);
    }
  }

  console.log('\n🎉 Finished sending all reset instructions!');
}

sendActiveMembersResetEmails();
