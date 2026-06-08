import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email, firstName, plan } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Send notification to the admins
    const adminEmail = 'editor@yorkshirebusinesswoman.co.uk';
    await sendEmail({
      to: adminEmail,
      subject: `New Member Registration: ${firstName || 'Someone'}`,
      html: `
        <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">New Member Registration</h2>
          <p>A new member has just registered on the platform.</p>
          <ul>
            <li><strong>Name:</strong> ${firstName || 'N/A'}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Plan:</strong> ${plan || 'Free'}</li>
            <li><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</li>
          </ul>
        </div>
      `
    }).catch(err => console.error('Failed to send admin notification:', err));

    const isPremium = plan === 'premium';
    // If premium, the Stripe webhook handles the email upon successful payment.
    // We only send it here if they are a free subscriber.
    if (isPremium) {
        return NextResponse.json({ success: true, message: 'Premium email handled by Stripe webhook' });
    }

    const freeWelcomeHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 640px; margin: 0 auto;">
        <p style="margin: 0 0 16px 0;">Hi</p>
        <p style="margin: 0 0 16px 0;">
          Thank you for signing as a free member for Yorkshire Businesswoman. We are delighted you would like to be involved.
        </p>
        <p style="margin: 0 0 16px 0;">
          Over the course of the year, we hold a number of events, many of which are complimentary for our paid members but as a non-paying member you will have priority over non-members on limited availability tickets.
        </p>
        <p style="margin: 0 0 16px 0;">
          Paid members have a fixed profile on our website and a feature profile within the printed Yorkshire Businesswoman magazine over the course of a year as well as having their news and press releases published both online or within the magazine. There is also a WhatsApp group where news and events are posted and where members can post their own news and updates.
        </p>
        <p style="margin: 0 0 16px 0;">
          If you are interested in becoming a full member which gives you access to the above, you can just click the paid member in the sign up box on the Yorkshire businesswoman website. The cost for this is just £25 per month.
        </p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Welcome to Yorkshire Businesswoman!',
      html: freeWelcomeHtml
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send free welcome email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
