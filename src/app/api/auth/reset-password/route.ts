import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { adminAuth } from '@/lib/firebase-admin';
import { getPasswordResetEmailTemplate } from '@/lib/email-templates';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Generate the raw password reset link using Firebase Admin
    let link = '';
    try {
      // Generate the reset link. We don't pass the actionCodeSettings URL here 
      // to avoid 'auth/unauthorized-continue-uri' errors if the Vercel preview domain 
      // isn't allowlisted in Firebase Console yet.
      link = await adminAuth.generatePasswordResetLink(email);
      
      // The generated link looks like:
      // https://PROJECT.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=XYZ&apiKey=ABC
      // We want to replace the host part with our custom action page so it matches the branding
      const urlObj = new URL(link);
      const params = urlObj.searchParams;
      
      // Rebuild the URL to point to our custom page
      link = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yorkshirebusinesswoman.co.uk'}/auth/action?mode=resetPassword&oobCode=${params.get('oobCode')}`;
      
    } catch (err: any) {
      console.error('Firebase Admin Reset Error:', err);
      if (err.code === 'auth/user-not-found') {
        // Security best practice: don't reveal if a user exists or not
        return NextResponse.json({ success: true });
      }
      throw err;
    }

    // Optionally fetch first name from Firestore if you want to personalize
    const firstName = 'Member';

    await sendEmail({
      to: email,
      subject: 'Reset your Yorkshire Businesswoman password',
      html: await getPasswordResetEmailTemplate(firstName, link),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to process password reset request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
