import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { adminDb } from '@/lib/firebase-admin';
import { getFreeWelcomeEmailTemplate } from '@/lib/email-templates';

export async function POST(request: Request) {
  try {
    const { email, firstName, plan } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Send notification to all admins
    let adminRecipients: string[] = ['editor@yorkshirebusinesswoman.co.uk'];
    try {
      if (adminDb) {
        const byRoleSnap = await adminDb
          .collection('newMemberCollection')
          .where('role', 'in', ['admin', 'super_admin'])
          .get();

        const byFlagSnap = await adminDb
          .collection('newMemberCollection')
          .where('isAdmin', '==', true)
          .get();

        const emails = new Set<string>();
        for (const doc of [...byRoleSnap.docs, ...byFlagSnap.docs]) {
          const e = (doc.data() as any)?.email;
          if (typeof e === 'string' && e.includes('@')) emails.add(e);
        }
        if (emails.size > 0) adminRecipients = Array.from(emails);
      }
    } catch (err) {
      console.error('Failed to fetch admin recipients:', err);
    }

    await sendEmail({
      to: adminRecipients,
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
      html: await getFreeWelcomeEmailTemplate(firstName || 'there', process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk')
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send free welcome email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
