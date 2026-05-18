import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { getDailyNewsletterTemplate } from '../src/lib/email-templates';
import { getPosts } from '../src/lib/ghost';

const apiKey = process.env.MAILGUN_API_KEY || '';
const domain = process.env.MAILGUN_DOMAIN || '';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({ username: 'api', key: apiKey, url: 'https://api.eu.mailgun.net' });

async function sendNewsletterExample() {
  console.log(`Fetching 5 latest posts for newsletter example...`);
  try {
    const posts = await getPosts({ limit: 5, order: 'published_at DESC' });
    
    if (!posts || posts.length === 0) {
      console.error('No posts found in Ghost to generate newsletter.');
      return;
    }

    console.log(`Generating template for: ${posts.map((p: any) => p.title).join(', ')}`);
    const html = await getDailyNewsletterTemplate(posts, 'Rob');
    
    const msgData = {
      from: `Yorkshire Businesswoman <hello@${domain}>`,
      to: ['rob@topicuk.co.uk'],
      subject: '[EXAMPLE] Your Daily News Digest',
      html: html
    };
    
    await mg.messages.create(domain, msgData);
    console.log('✅ Newsletter example sent successfully to rob@topicuk.co.uk!');
  } catch (error) {
    console.error('❌ Error sending newsletter example:', error);
  }
}

sendNewsletterExample();