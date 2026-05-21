import { NextResponse } from 'next/server';
import { getPosts } from '@/lib/ghost';
import { addGhostMember } from '@/lib/ghost-admin';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getDailyNewsletterTemplate } from '@/lib/email-templates';
import { addBeehiivSubscriber } from '@/lib/beehiiv';

export async function POST(request: Request) {
  try {
    const { email, firstName, lastName, industry } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Add to Beehiiv (Primary Newsletter Engine)
    const beehiivResult = await addBeehiivSubscriber({
      email,
      customFields: {
        first_name: firstName || '',
        last_name: lastName || '',
        industry: industry || ''
      }
    });

    // 2. Add to Ghost (for CMS access)
    const ghostResult = await addGhostMember({
      email,
      name: `${firstName || ''} ${lastName || ''}`.trim() || undefined,
      labels: ['newsletter-signup', 'v0-magazine', 'beehiiv-sync']
    });

    // 3. Add or update in Firebase (for platform statistics and dashboard)
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
        beehiivSync: beehiivResult.success,
        updatedAt: new Date().toISOString()
      };

      if (querySnapshot.empty) {
        await membersRef.add({
          ...memberData,
          createdAt: new Date().toISOString()
        });
      } else {
        const doc = querySnapshot.docs[0];
        await doc.ref.update(memberData);
      }
    }

    // 4. Instantly send the "Your First Newsletter" (Preview of latest content)
    const posts = await getPosts({ limit: 5, order: 'published_at DESC' });

    if (posts && posts.length > 0) {
      const html = await getDailyNewsletterTemplate(posts);
      await sendEmail({
        to: email,
        subject: 'Welcome to Yorkshire Businesswoman: Your First Newsletter',
        html
      });
    }

    return NextResponse.json({ success: true, beehiiv: beehiivResult, ghost: ghostResult });
  } catch (error: any) {
    console.error('Newsletter signup error:', error);
    return NextResponse.json({ error: error.message || 'Failed to subscribe' }, { status: 500 });
  }
}
