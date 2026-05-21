import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getDailyNewsletterTemplate } from '@/lib/email-templates';
import { getPosts } from '@/lib/ghost';

export const dynamic = 'force-dynamic';

async function logCronExecution(status: string, message: string, details?: any) {
  try {
    if (adminDb) {
      await adminDb.collection('cronLogs').add({
        job: 'daily-newsletter',
        timestamp: new Date(),
        status,
        message,
        details: details || {}
      });
    }
  } catch (e) {
    console.error('Failed to log cron execution:', e);
  }
}

export async function GET(request: Request) {
  return NextResponse.json({ 
    success: true, 
    message: 'The automated Resend newsletter has been disabled in favor of Beehiiv.' 
  });

  const startTime = Date.now();
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
        await logCronExecution('skipped', 'Today is a UK Bank Holiday');
        return NextResponse.json({ success: true, message: 'Skipping execution: Today is a UK Bank Holiday' });
      }
    } catch (bhError) {
      console.error('Failed to check bank holidays, continuing with execution:', bhError);
    }

    // 2. Fetch latest posts from Ghost
    const posts = await getPosts({ limit: 5, order: 'published_at DESC' });

    if (!posts || posts.length === 0) {
      await logCronExecution('skipped', 'No posts found in Ghost');
      return NextResponse.json({ success: true, message: 'No posts to send' });
    }

    // 3. Get all active members who opted in for the newsletter
    const emails: string[] = [];
    
    if (isTestMode) {
      emails.push('rob@topicuk.co.uk');
      emails.push('hello@yorkshirebusinesswoman.co.uk');
    } else {
      if (!adminDb) throw new Error('Firebase Admin DB not initialized');
      
      const membersSnapshot = await adminDb.collection('newMemberCollection')
        .where('status', '==', 'active')
        .where('userInactive', '==', false)
        .where('isNewsletterAuthorized', '==', true)
        .get();

      membersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.email) {
          emails.push(data.email);
        }
      });
    }

    if (emails.length === 0) {
      await logCronExecution('skipped', 'No active recipients found');
      return NextResponse.json({ success: true, message: 'No recipients found' });
    }

    // 4. Send emails in chunks (sendmail/nodemailer can handle large volumes, but we'll use chunks for safety)
    const chunkSize = 950;
    const emailChunks = [];
    for (let i = 0; i < emails.length; i += chunkSize) {
      emailChunks.push(emails.slice(i, i + chunkSize));
    }

    for (const chunk of emailChunks) {
      await sendEmail({
        to: 'hello@yorkshirebusinesswoman.co.uk',
        bcc: chunk.join(','),
        subject: 'Yorkshire Businesswoman: Morning Digest',
        html: await getDailyNewsletterTemplate(posts)
      });
    }

    const duration = Date.now() - startTime;
    await logCronExecution('success', `Sent newsletter to ${emails.length} recipients`, {
      recipientCount: emails.length,
      durationMs: duration,
      postCount: posts.length
    });

    return NextResponse.json({ 
      success: true, 
      message: `Newsletter sent to ${emails.length} recipients`,
      testMode: isTestMode
    });

  } catch (error: any) {
    console.error('Daily newsletter error:', error);
    await logCronExecution('error', error.message, { stack: error.stack });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
