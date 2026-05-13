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

    await sendEmail({
      to: email,
      subject: 'Welcome to Yorkshire Businesswoman!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Yorkshire Businesswoman</title>
        </head>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f5f1; margin: 0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            
            <!-- Header with Logo -->
            <div style="background-color: #18181b; padding: 30px; text-align: center;">
              <img src="https://firebasestorage.googleapis.com/v0/b/newmembersdirectory130325.firebasestorage.app/o/membersLogos%2F6984d34a6ee5011c6442e15e%2Fprivate%2FAsset%201%404x.png?alt=media" alt="Yorkshire Businesswoman" style="max-height: 50px; width: auto;" />
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px; color: #3f3f46; line-height: 1.6; font-size: 16px;">
              <h1 style="color: #18181b; font-size: 24px; margin-top: 0; font-weight: 600;">Welcome to the Community!</h1>
              
              <p>Hi ${firstName || 'there'},</p>
              
              <p>Thank you for registering as a Free Subscriber. We are absolutely thrilled to have you with us!</p>
              
              <p>You will now receive our weekly newsletters, community updates, and event notifications straight to your inbox.</p>
              
              <!-- Callout Box -->
              <div style="background-color: #f7f5f1; border-left: 4px solid #b79c65; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="color: #18181b; margin-top: 0; font-size: 18px;">Want to get more involved?</h3>
                <p style="margin-bottom: 0; font-size: 15px;">If you ever want to unlock full access to the Member Directory, publish your own public profile, and get priority event booking, you can upgrade to a Premium Membership at any time from your dashboard.</p>
              </div>
              
              <p>If you have any questions, simply reply to this email.</p>
              
              <p style="margin-bottom: 0;">Best regards,<br><strong style="color: #18181b;">The Yorkshire Businesswoman Team</strong></p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #fafafa; border-top: 1px solid #eaeaea; padding: 20px; text-align: center; color: #71717a; font-size: 12px;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} Yorkshire Businesswoman. All rights reserved.</p>
              <p style="margin: 5px 0 0 0;">You are receiving this email because you registered on our platform.</p>
            </div>

          </div>
        </body>
        </html>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send free welcome email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
