import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Resend } from 'resend';
import { getDailyNewsletterTemplate } from '../src/lib/email-templates';
import { getPosts } from '../src/lib/ghost';

const resend = new Resend(process.env.RESEND_API_KEY);
const domain = process.env.MAILGUN_DOMAIN || 'yorkshirebusinesswoman.co.uk';

async function sendNewsletterExample() {
  console.log(`Fetching 5 latest featured posts for newsletter example...`);
  try {
    const posts = await getPosts({ 
      limit: 5, 
      filter: 'featured:true',
      order: 'published_at DESC' 
    });
    
    if (!posts || posts.length === 0) {
      console.error('No posts found in Ghost to generate newsletter.');
      return;
    }

    console.log(`Generating template for: ${posts.map((p: any) => p.title).join(', ')}`);
    const html = await getDailyNewsletterTemplate(posts, 'Rob');
    
    const { data, error } = await resend.emails.send({
      from: `Yorkshire Businesswoman <hello@${domain}>`,
      to: 'rob@topicuk.co.uk',
      subject: '[EXAMPLE] Your Daily News Digest',
      html: html
    });

    if (error) throw error;
    
    console.log('✅ Newsletter example sent successfully via Resend to rob@topicuk.co.uk! ID:', data?.id);
  } catch (error) {
    console.error('❌ Error sending newsletter example:', error);
  }
}

sendNewsletterExample();
