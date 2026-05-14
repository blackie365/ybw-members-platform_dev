import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailgun';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Generate the raw password reset link using Firebase Admin
    let link = '';
    try {
      // Create the link and tell it to redirect to our custom action page
      link = await adminAuth.generatePasswordResetLink(email, {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.yorkshirebusinesswoman.co.uk'}/login`
      });
      
      // The generated link looks like:
      // https://PROJECT.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=XYZ&apiKey=ABC
      // We want to replace the host part with our custom action page so it matches the branding
      const urlObj = new URL(link);
      const params = urlObj.searchParams;
      
      // Rebuild the URL to point to our custom page
      link = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.yorkshirebusinesswoman.co.uk'}/auth/action?mode=resetPassword&oobCode=${params.get('oobCode')}`;
      
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // Security best practice: don't reveal if a user exists or not
        return NextResponse.json({ success: true });
      }
      throw err;
    }

    // 2. Send the email using Mailgun
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://www.yorkshirebusinesswoman.co.uk/images/logo.png" alt="Yorkshire Businesswoman" style="max-height: 80px;" />
        </div>
        
        <h2 style="color: #111827; margin-bottom: 20px;">Reset Your Password</h2>
        
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          Hello,
        </p>
        
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
          We received a request to reset the password for your Yorkshire Businesswoman account associated with this email address. 
          If you made this request, please click the button below to choose a new password.
        </p>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${link}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Reset My Password
          </a>
        </div>
        
        <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-bottom: 10px;">
          If you didn't request a password reset, you can safely ignore this email. Your password will not change.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          &copy; ${new Date().getFullYear()} Yorkshire Businesswoman. All rights reserved.
        </p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Reset your Yorkshire Businesswoman password',
      html: htmlContent,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to process password reset request:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
