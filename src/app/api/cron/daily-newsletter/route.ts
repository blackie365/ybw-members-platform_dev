import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getPosts } from '@/lib/ghost';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Verify cron secret to prevent unauthorized execution
    const authHeader = request.headers.get('authorization');
    const isTestMode = request.url.includes('test=true');
    
    if (
      process.env.NODE_ENV === 'production' &&
      !isTestMode &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1.5 Check if today is a UK Bank Holiday
    try {
      const bhResponse = await fetch('https://www.gov.uk/bank-holidays.json');
      const bhData = await bhResponse.json();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      const englandWalesHolidays = bhData['england-and-wales'].events;
      const isBankHoliday = englandWalesHolidays.some((event: any) => event.date === today);
      
      if (isBankHoliday) {
        return NextResponse.json({ success: true, message: 'Skipping execution: Today is a UK Bank Holiday' });
      }
    } catch (bhError) {
      console.error('Failed to check bank holidays, continuing with execution:', bhError);
    }

    // 2. Fetch the latest/highlighted stories from Ghost
    // Fetching the 3 most recent posts that are ideally featured, falling back to recent.
    let posts = await getPosts({ limit: 3, filter: 'featured:true', order: 'published_at DESC' });
    
    // If no featured posts, just get the 3 most recent
    if (!posts || posts.length === 0) {
      posts = await getPosts({ limit: 3, order: 'published_at DESC' });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ success: true, message: 'No posts to send' });
    }

    // 3. Build the email HTML
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk';
    
    let articlesHtml = '';
    posts.forEach((post: any) => {
      articlesHtml += `
        <div style="margin-bottom: 30px; border-bottom: 1px solid #eaeaea; padding-bottom: 20px;">
          ${post.feature_image ? `<img src="${post.feature_image}" alt="${post.title}" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 15px;" />` : ''}
          <h3 style="margin-top: 0; color: #18181b; font-size: 20px;">
            <a href="${siteUrl}/news/${post.slug}" style="color: #18181b; text-decoration: none;">${post.title}</a>
          </h3>
          <p style="color: #52525b; font-size: 15px; line-height: 1.5;">${post.custom_excerpt || post.excerpt || ''}</p>
          <a href="${siteUrl}/news/${post.slug}" style="display: inline-block; margin-top: 10px; color: #b79c65; font-weight: bold; text-decoration: none;">Read More &rarr;</a>
        </div>
      `;
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Daily Digest</title>
      </head>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f5f1; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          
          <div style="background-color: #18181b; padding: 30px; text-align: center;">
            <img src="https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/membersLogos%2F6984d34a6ee5011c6442e15e%2Fprivate%2FAsset%201%404x.png?alt=media" alt="Yorkshire Businesswoman" style="max-height: 50px; width: auto;" />
          </div>

          <div style="padding: 40px 30px; color: #3f3f46;">
            <h1 style="color: #18181b; font-size: 24px; margin-top: 0; font-weight: 600; text-align: center; margin-bottom: 30px;">Morning Digest</h1>
            <p style="margin-bottom: 30px; font-size: 16px;">Good morning! Here are the latest highlighted stories from Yorkshire Businesswoman to start your day.</p>
            
            ${articlesHtml}
            
            <div style="text-align: center; margin-top: 40px;">
              <a href="${siteUrl}/news" style="background-color: #b79c65; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">View All News</a>
            </div>
          </div>
          
          <div style="background-color: #fafafa; border-top: 1px solid #eaeaea; padding: 20px; text-align: center; color: #71717a; font-size: 12px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Yorkshire Businesswoman. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 4. Fetch all active subscribers from Firebase
    const emails: string[] = [];

    if (isTestMode) {
      emails.push('rob@topicuk.co.uk');
    } else {
      const membersSnapshot = await adminDb.collection('newMemberCollection')
        .where('status', '==', 'active')
        .get();

      membersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.email) {
          emails.push(data.email);
        }
      });
    }

    if (emails.length === 0) {
      return NextResponse.json({ success: true, message: 'No active subscribers found' });
    }

    // 5. Send via Mailgun
    // To prevent rate limits or massive headers, we chunk the emails if needed,
    // or just use BCC for a simple list. Mailgun handles up to 1000 in 'bcc'.
    // Let's chunk them into groups of 500 just to be safe.
    const chunkSize = 500;
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      
      await sendEmail({
        to: 'hello@yorkshirebusinesswoman.co.uk', // To address is generic
        bcc: chunk.join(','), // Real recipients are hidden in BCC
        subject: 'Yorkshire Businesswoman: Morning Digest',
        html: emailHtml
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Newsletter sent to ${emails.length} subscribers`,
      articles: posts.map((p: any) => p.title)
    });

  } catch (error: any) {
    console.error('Daily newsletter error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
