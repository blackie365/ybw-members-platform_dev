import { addGhostMember } from '@/lib/ghost-admin';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getNewsletterWelcomeEmailTemplate } from '@/lib/email-templates';
import { addBeehiivSubscriber } from '@/lib/beehiiv';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // Rate limit: 3 requests per minute per IP
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`newsletter:${ip}`, 3, 60_000);
  
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        }
      }
    );
  }
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const email = body?.email;
    const emailLower = typeof email === 'string' ? email.toLowerCase() : '';
    const firstName = body?.firstName || '';
    const lastName = body?.lastName || '';
    const industry = body?.industry || '';

    if (!email || typeof email !== 'string') {
      console.warn('⚠️ [API/Newsletter] Invalid or missing email');
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Add to Beehiiv (Primary)
    let beehiivResult = { success: false, alreadyExists: false };
    try {
      const res = await addBeehiivSubscriber({
        email,
        customFields: {
          first_name: firstName || '',
          last_name: lastName || '',
          industry: industry || ''
        }
      });
      beehiivResult = { success: !!res?.success, alreadyExists: !!res?.alreadyExists };
    } catch (beehiivError: any) {
      console.error('❌ [API/Newsletter] Beehiiv failed:', beehiivError.message || beehiivError);
    }

    // 3. Add to Ghost (Non-critical)
    let ghostResult = false;
    try {
      const ghostRes = await addGhostMember({
        email,
        name: `${firstName || ''} ${lastName || ''}`.trim() || undefined,
        labels: ['newsletter-signup', 'beehiiv-sync']
      });
      ghostResult = !!ghostRes;
    } catch (ghostError: any) {
      console.warn('⚠️ [API/Newsletter] Ghost sync skipped:', ghostError.message || ghostError);
    }

    // 4. Add to Firebase (Non-critical)
    try {
      if (adminDb) {
        const membersRef = adminDb.collection('newMemberCollection');
        const querySnapshot = await membersRef.where('email', '==', email).limit(1).get();
        
        const memberData = {
          email,
          emailLower,
          firstName: firstName || '',
          lastName: lastName || '',
          displayName: `${firstName || ''} ${lastName || ''}`.trim(),
          industrySector: industry || '',
          status: 'active',
          newsletterSubscribed: true,
          isNewsletterRecipient: true,
          updatedAt: new Date().toISOString()
        };

        if (querySnapshot.empty) {
          const newsletterDocId = `newsletter_${Buffer.from(emailLower).toString('base64url')}`;
          await membersRef.doc(newsletterDocId).set(
            { ...memberData, membershipTier: 'free', createdAt: new Date().toISOString() },
            { merge: true }
          );
        } else {
          await querySnapshot.docs[0].ref.update(memberData);
        }
      }
    } catch (firebaseError: any) {
      console.warn('⚠️ [API/Newsletter] Firebase sync failed:', firebaseError.message || firebaseError);
    }

    // 5. Send Welcome Email (Non-critical)
    try {
      const html = await getNewsletterWelcomeEmailTemplate(firstName || 'there');
      await sendEmail({
        to: email,
        subject: 'Welcome to Yorkshire Businesswoman',
        html
      });
    } catch (emailError: any) {
      console.warn('⚠️ [API/Newsletter] Welcome email failed:', emailError.message || emailError);
    }

    // Final Success Response
    const responseData = { 
      success: true, 
      message: beehiivResult.alreadyExists 
        ? "You're already subscribed to our newsletter! We've updated your preferences." 
        : 'Successfully subscribed',
      details: {
        beehiiv: beehiivResult.success,
        ghost: ghostResult
      }
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (fatalError: any) {
    console.error('❌ [API/Newsletter] FATAL ERROR:', fatalError.message || fatalError);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: fatalError.message || 'An internal error occurred. Please try again later.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
