import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email, firstName, plan } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

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
        <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Welcome to the Yorkshire Businesswoman Community!</h2>
          <p>Hi ${firstName || 'there'},</p>
          <p>Thank you for registering as a Free Subscriber. We are absolutely thrilled to have you with us!</p>
          <p>You will now receive our weekly newsletters, community updates, and event notifications straight to your inbox.</p>
          
          <div style="background-color: #f7f5f1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Want to get more involved?</h3>
            <p style="margin-bottom: 0;">If you ever want to unlock full access to the Member Directory, publish your own public profile, and get priority event booking, you can upgrade to a Premium Membership at any time from your dashboard.</p>
          </div>
          
          <p>If you have any questions, simply reply to this email.</p>
          <p>Best regards,<br>The Yorkshire Businesswoman Team</p>
        </div>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send free welcome email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
