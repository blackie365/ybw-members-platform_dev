import { NextResponse } from 'next/server';
import { addGhostMember, getPosts } from '@/lib/ghost';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import { getDailyNewsletterTemplate } from '@/lib/email-templates';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Add to Ghost
    const result = await addGhostMember({
      email,
      labels: ['newsletter-signup', 'v0-magazine']
    });

    // 2. Add or update in Firebase to ensure they get future newsletters
    if (adminDb) {
      const membersRef = adminDb.collection('newMemberCollection');
      const querySnapshot = await membersRef.where('email', '==', email).limit(1).get();
      
      if (querySnapshot.empty) {
        // Create new lightweight subscriber record
        await membersRef.add({
          email,
          status: 'active',
          newsletterSubscribed: true,
          isNewsletterRecipient: true, // Mark as valid recipient
          membershipTier: 'Free Subscriber',
          createdAt: new Date().toISOString()
        });
      } else {
        // Update existing record to subscribe
        const doc = querySnapshot.docs[0];
        await doc.ref.update({ 
          newsletterSubscribed: true, 
          isNewsletterRecipient: true, // Mark as valid recipient
          status: 'active' 
        });
      }
    }

    // 3. Instantly send the daily newsletter (1 Featured + 4 Sub-articles = 5 total)
    const posts = await getPosts({ limit: 5, order: 'published_at DESC' });

    if (posts && posts.length > 0) {
      const html = await getDailyNewsletterTemplate(posts);
      await sendEmail({
        to: email,
        subject: 'Welcome to Yorkshire Businesswoman: Your First Newsletter',
        html
      });
    }

    return NextResponse.json({ success: true, member: result });
  } catch (error: any) {
    console.error('Newsletter signup error:', error);
    return NextResponse.json({ error: error.message || 'Failed to subscribe' }, { status: 500 });
  }
}
