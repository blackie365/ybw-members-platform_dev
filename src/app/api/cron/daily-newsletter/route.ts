import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getDailyNewsletterTemplate } from '@/lib/email-templates';
import { getPosts } from '@/lib/ghost';

export const dynamic = 'force-dynamic';

// Sophisticated color palette from LUMIÈRE template, adapted for Yorkshire Businesswoman
const colors = {
  background: "#FAF8F5",
  cardBackground: "#FFFFFF",
  primary: "#18181b", // Matches site primary text
  secondary: "#52525b", // Matches site secondary text
  accent: "#b79c65", // YBW gold accent
  border: "#E8E4DF",
  muted: "#F5F3F0",
};

const fonts = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
};

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

    // 2. Fetch the latest stories from Ghost (1 Featured + 4 Sub-articles = 5 total)
    // We fetch the most recent posts. The template will use the first one as featured.
    const posts = await getPosts({ limit: 5, order: 'published_at DESC' });

    if (!posts || posts.length === 0) {
      return NextResponse.json({ success: true, message: 'No posts to send' });
    }

    // 3. Build the email HTML
    const emails: string[] = [];

    if (isTestMode) {
      emails.push('rob@topicuk.co.uk');
    } else {
      const membersSnapshot = await adminDb.collection('newMemberCollection')
        .where('status', '==', 'active')
        .where('isNewsletterRecipient', '==', true)
        .get();

      membersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.email && data.newsletterSubscribed !== false) {
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
        html: await getDailyNewsletterTemplate(posts)
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
