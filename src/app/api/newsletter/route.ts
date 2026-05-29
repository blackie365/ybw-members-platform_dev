import { addGhostMember } from '@/lib/ghost-admin';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getNewsletterWelcomeEmailTemplate } from '@/lib/email-templates';
import { addBeehiivSubscriber } from '@/lib/beehiiv';

export async function POST(request: Request) {
  console.log('📬 [API/Newsletter] Request started');
  
  try {
    const rawBody = await request.text();
    console.log('📦 [API/Newsletter] Raw body:', rawBody);
    
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error('❌ [API/Newsletter] JSON parse failed');
      return new Response(JSON.stringify({ error: 'Invalid JSON in request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const email = body?.email;
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

    console.log(`📬 [API/Newsletter] Email: ${email}`);

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
      console.log('✅ [API/Newsletter] Beehiiv sync result:', beehiivResult);
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
      console.log('✅ [API/Newsletter] Ghost sync result:', ghostResult);
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
          firstName: firstName || '',
          lastName: lastName || '',
          displayName: `${firstName || ''} ${lastName || ''}`.trim(),
          industrySector: industry || '',
          status: 'active',
          newsletterSubscribed: true,
          isNewsletterRecipient: true,
          membershipTier: 'free',
          updatedAt: new Date().toISOString()
        };

        if (querySnapshot.empty) {
          await membersRef.add({ ...memberData, createdAt: new Date().toISOString() });
          console.log('✅ [API/Newsletter] Firebase record created');
        } else {
          await querySnapshot.docs[0].ref.update(memberData);
          console.log('✅ [API/Newsletter] Firebase record updated');
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
      console.log('✅ [API/Newsletter] Welcome email sent');
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

    console.log('🏁 [API/Newsletter] Request completed successfully');
    
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
