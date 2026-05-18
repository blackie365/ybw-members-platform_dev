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

    console.log(`Processing password reset request for: ${email}`);

    if (!adminAuth) {
      console.error('CRITICAL: adminAuth is not initialized');
      return NextResponse.json({ error: 'Authentication service is unavailable' }, { status: 500 });
    }

    // 1. Check if user exists in Firebase Auth
    try {
      const user = await adminAuth.getUserByEmail(email);
      console.log(`Found user: ${user.uid}`);
    } catch (err: any) {
      console.error(`User check error for ${email}:`, err.code);
      if (err.code === 'auth/user-not-found') {
        // Security best practice: don't reveal if a user exists
        return NextResponse.json({ success: true });
      }
      throw err;
    }

    // 2. Generate the raw password reset link using Firebase Admin
    let link = '';
    try {
      // Use the project's default reset link generation
      link = await adminAuth.generatePasswordResetLink(email);
      console.log('Successfully generated reset link via Admin SDK');
      
      const urlObj = new URL(link);
      const params = urlObj.searchParams;
      
      // Rebuild the URL to point to our custom action page
      link = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yorkshirebusinesswoman.co.uk'}/auth/action?${params.toString()}`;
      
    } catch (err: any) {
      console.error('Firebase Admin Link Generation Error:', err);
      
      // FALLBACK: If Admin SDK fails with ASSERT FAILED, we can try to use the REST API
      // if we have the API Key.
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (apiKey) {
        console.log('Attempting REST API fallback for link generation...');
        try {
          const restResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requestType: 'PASSWORD_RESET',
                email: email,
              }),
            }
          );
          
          const restData = await restResponse.json();
          if (restResponse.ok) {
            // NOTE: The REST API 'sendOobCode' actually SENDS the email from Google.
            // If we are here, it means Google has already sent its default email.
            // We return success to the UI, but the user will get the Google email instead of our custom one.
            // This is better than a 500 error.
            console.log('REST API fallback triggered Google email send.');
            return NextResponse.json({ success: true, fallback: true });
          } else {
            throw new Error(restData.error?.message || 'REST API fallback failed');
          }
        } catch (restErr) {
          console.error('REST Fallback Error:', restErr);
          throw err; // Throw the original Admin SDK error if fallback also fails
        }
      }
      
      throw err;
    }

    // 3. Send our custom branded email
    const firstName = 'Member';
    await sendEmail({
      to: email,
      subject: 'Action Required: Reset your Yorkshire Businesswoman password',
      html: await getPasswordResetEmailTemplate(firstName, link),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to process password reset request:', error);
    
    // Provide a more helpful error message to the user
    let userMessage = 'We encountered an error while setting up your reset link. Please try again in a few minutes.';
    if (error.message?.includes('INTERNAL ASSERT FAILED')) {
      userMessage = 'Our authentication service is currently experiencing connection issues. Please try again shortly.';
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}

