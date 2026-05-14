import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
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
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    // Featured Article (First one)
    const featuredArticle = posts[0];
    
    // More Stories (The rest)
    const moreArticles = posts.slice(1);

    let moreStoriesHtml = '';
    moreArticles.forEach((article: any, index: number) => {
      moreStoriesHtml += `
        <tr>
          <td style="width: 140px; vertical-align: top; padding-right: 20px;">
            <a href="${siteUrl}/news/${article.slug}" style="text-decoration: none; color: inherit;">
              ${article.feature_image ? `<img src="${article.feature_image}" width="140" height="100" alt="${article.title}" style="width: 140px; height: 100px; object-fit: cover; display: block;" />` : `<div style="width: 140px; height: 100px; background-color: ${colors.border};"></div>`}
            </a>
          </td>
          <td style="vertical-align: top;">
            <a href="${siteUrl}/news/${article.slug}" style="text-decoration: none; color: inherit;">
              <p style="font-family: ${fonts.sans}; font-size: 9px; letter-spacing: 1.5px; color: ${colors.accent}; margin: 0 0 6px 0; text-transform: uppercase;">
                ${article.primary_tag?.name || 'NEWS'}
              </p>
              <h3 style="font-family: ${fonts.serif}; font-size: 18px; font-weight: 400; color: ${colors.primary}; line-height: 1.3; margin: 0 0 8px 0;">
                ${article.title}
              </h3>
              <p style="font-family: ${fonts.sans}; font-size: 13px; color: ${colors.secondary}; line-height: 1.5; margin: 0 0 8px 0;">
                ${article.custom_excerpt || article.excerpt || ''}
              </p>
              <p style="font-family: ${fonts.sans}; font-size: 11px; color: ${colors.secondary}; margin: 0;">
                ${article.primary_author?.name || 'YBW Editorial'} · ${article.reading_time || 3} min read
              </p>
            </a>
          </td>
        </tr>
        ${index < moreArticles.length - 1 ? `<tr><td colspan="2"><hr style="border: none; border-top: 1px solid ${colors.border}; margin: 24px 0;" /></td></tr>` : ''}
      `;
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Yorkshire Businesswoman: Morning Digest</title>
      </head>
      <body style="font-family: ${fonts.sans}; background-color: ${colors.background}; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${colors.background};">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              
              <!-- Container -->
              <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${colors.cardBackground};">
                
                <!-- Header -->
                <tr>
                  <td align="center" style="padding: 30px 20px;">
                    <img src="https://admin.yorkshirebusinesswoman.co.uk/content/images/2026/03/Asset-9@3x-2.png" alt="Yorkshire Businesswoman" style="max-height: 60px; width: auto; display: block;" />
                    <p style="font-family: ${fonts.sans}; font-size: 11px; letter-spacing: 3px; color: ${colors.secondary}; text-transform: uppercase; margin: 16px 0 0 0;">
                      For Women Who Lead
                    </p>
                  </td>
                </tr>

                <tr><td><hr style="border: none; border-top: 1px solid ${colors.border}; margin: 0;" /></td></tr>

                <!-- Date & Greeting -->
                <tr>
                  <td align="center" style="padding: 40px 30px 30px 30px;">
                    <p style="font-family: ${fonts.sans}; font-size: 12px; letter-spacing: 2px; color: ${colors.accent}; text-transform: uppercase; margin: 0 0 16px 0;">
                      ${date}
                    </p>
                    <h1 style="font-family: ${fonts.serif}; font-size: 32px; font-weight: 400; color: ${colors.primary}; line-height: 1.3; margin: 0 0 12px 0;">
                      Good morning.
                    </h1>
                    <p style="font-family: ${fonts.sans}; font-size: 16px; color: ${colors.secondary}; line-height: 1.6; margin: 0;">
                      Your morning briefing is ready.
                    </p>
                  </td>
                </tr>

                <!-- Editor's Note -->
                <tr>
                  <td style="padding: 0 30px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${colors.muted}; border-radius: 4px;">
                      <tr>
                        <td style="padding: 28px 24px;">
                          <p style="font-family: ${fonts.sans}; font-size: 10px; letter-spacing: 2px; color: ${colors.accent}; margin: 0 0 12px 0; text-transform: uppercase;">
                            FROM THE EDITOR
                          </p>
                          <p style="font-family: ${fonts.serif}; font-size: 16px; font-style: italic; color: ${colors.primary}; line-height: 1.7; margin: 0 0 16px 0;">
                            This week, we're exploring how leaders are adapting to the evolving landscape of work. From negotiation tactics to wellness strategies, these stories reflect the multifaceted nature of modern leadership across Yorkshire.
                          </p>
                          <p style="font-family: ${fonts.sans}; font-size: 13px; color: ${colors.secondary}; margin: 0;">
                            — Gill Laidler, Editor-in-Chief
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr><td style="padding: 0 30px;"><hr style="border: none; border-top: 1px solid ${colors.border}; margin: 32px 0;" /></td></tr>

                <!-- Featured Article -->
                ${featuredArticle ? `
                <tr>
                  <td style="padding: 0 30px;">
                    <p style="font-family: ${fonts.sans}; font-size: 11px; letter-spacing: 3px; color: ${colors.accent}; margin: 0 0 20px 0; text-transform: uppercase;">
                      FEATURED
                    </p>
                    <a href="${siteUrl}/news/${featuredArticle.slug}" style="text-decoration: none; color: inherit; display: block;">
                      ${featuredArticle.feature_image ? `<img src="${featuredArticle.feature_image}" alt="${featuredArticle.title}" style="width: 100%; height: 280px; object-fit: cover; margin-bottom: 20px; display: block;" />` : ''}
                      <p style="font-family: ${fonts.sans}; font-size: 10px; letter-spacing: 2px; color: ${colors.accent}; margin: 0 0 8px 0; text-transform: uppercase;">
                        ${featuredArticle.primary_tag?.name || 'NEWS'}
                      </p>
                      <h2 style="font-family: ${fonts.serif}; font-size: 26px; font-weight: 400; color: ${colors.primary}; line-height: 1.3; margin: 0 0 12px 0;">
                        ${featuredArticle.title}
                      </h2>
                      <p style="font-family: ${fonts.sans}; font-size: 15px; color: ${colors.secondary}; line-height: 1.6; margin: 0 0 12px 0;">
                        ${featuredArticle.custom_excerpt || featuredArticle.excerpt || ''}
                      </p>
                      <p style="font-family: ${fonts.sans}; font-size: 12px; color: ${colors.secondary}; margin: 0;">
                        By ${featuredArticle.primary_author?.name || 'YBW Editorial'} · ${featuredArticle.reading_time || 3} min read
                      </p>
                    </a>
                  </td>
                </tr>
                <tr><td style="padding: 0 30px;"><hr style="border: none; border-top: 1px solid ${colors.border}; margin: 32px 0;" /></td></tr>
                ` : ''}

                <!-- More Stories -->
                ${moreArticles.length > 0 ? `
                <tr>
                  <td style="padding: 0 30px;">
                    <p style="font-family: ${fonts.sans}; font-size: 11px; letter-spacing: 3px; color: ${colors.accent}; margin: 0 0 20px 0; text-transform: uppercase;">
                      MORE STORIES
                    </p>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      ${moreStoriesHtml}
                    </table>
                  </td>
                </tr>
                <tr><td style="padding: 0 30px;"><hr style="border: none; border-top: 1px solid ${colors.border}; margin: 32px 0;" /></td></tr>
                ` : ''}

                <!-- CTA Section -->
                <tr>
                  <td align="center" style="padding: 20px 30px;">
                    <h3 style="font-family: ${fonts.serif}; font-size: 22px; font-weight: 400; color: ${colors.primary}; margin: 0 0 12px 0;">
                      Explore More on Yorkshire Businesswoman
                    </h3>
                    <p style="font-family: ${fonts.sans}; font-size: 14px; color: ${colors.secondary}; line-height: 1.6; margin: 0 0 24px 0;">
                      Dive deeper into leadership insights, career strategies, and exclusive interviews.
                    </p>
                    <a href="${siteUrl}/news" style="font-family: ${fonts.sans}; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: ${colors.cardBackground}; background-color: ${colors.primary}; padding: 14px 32px; text-decoration: none; display: inline-block;">
                      Visit the Magazine
                    </a>
                  </td>
                </tr>

                <tr><td><hr style="border: none; border-top: 1px solid ${colors.border}; margin: 0;" /></td></tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding: 32px 30px 40px 30px;">
                    <img src="https://admin.yorkshirebusinesswoman.co.uk/content/images/2026/03/Asset-9@3x-2.png" alt="Yorkshire Businesswoman" style="max-height: 40px; width: auto; display: block; margin: 0 auto 16px auto;" />
                    <p style="font-family: ${fonts.sans}; font-size: 13px; color: ${colors.secondary}; line-height: 1.6; margin: 0 0 20px 0;">
                      Empowering women in business with weekly insights, strategies, and stories of success.
                    </p>
                    
                    <p style="font-family: ${fonts.sans}; font-size: 12px; margin: 0 0 20px 0;">
                      <a href="https://www.linkedin.com/company/yorkshire-businesswoman" style="color: ${colors.secondary}; text-decoration: none;">LinkedIn</a>
                      <span style="color: ${colors.border}; margin: 0 8px;">·</span>
                      <a href="https://twitter.com/yorkshirebusinesswoman" style="color: ${colors.secondary}; text-decoration: none;">Twitter</a>
                      <span style="color: ${colors.border}; margin: 0 8px;">·</span>
                      <a href="https://www.instagram.com/yorkshirebusinesswoman" style="color: ${colors.secondary}; text-decoration: none;">Instagram</a>
                    </p>

                    <hr style="border: none; border-top: 1px solid ${colors.border}; margin: 0 0 20px 0;" />

                    <p style="font-family: ${fonts.sans}; font-size: 11px; color: ${colors.secondary}; margin: 0 0 8px 0;">
                      You received this email because you subscribed to the Yorkshire Businesswoman Digest.
                    </p>
                    
                    <p style="font-family: ${fonts.sans}; font-size: 10px; color: ${colors.secondary}; margin: 16px 0 0 0;">
                      Yorkshire Businesswoman · Leeds, West Yorkshire
                    </p>
                  </td>
                </tr>

              </table>
              <!-- /Container -->
              
            </td>
          </tr>
        </table>
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
