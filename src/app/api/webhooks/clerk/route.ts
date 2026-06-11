import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import slugify from '@sindresorhus/slugify';
import { addGhostMember } from '@/lib/ghost-admin';
import { sendEmail } from '@/lib/email';
import { getFreeWelcomeEmailTemplate } from '@/lib/email-templates';

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!SIGNING_SECRET) {
    throw new Error('Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET)

  // Get headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', {
      status: 400,
    })
  }

  // Get body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  let evt: WebhookEvent

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error: Could not verify webhook:', err)
    return new Response('Error: Verification error', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, first_name, last_name, email_addresses, image_url, unsafe_metadata } = evt.data
    const email = email_addresses[0]?.email_address

    if (!email) {
      return new Response('Error: No email provided', { status: 400 })
    }

    const firstName = first_name || ''
    const lastName = last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    const slug = slugify(fullName || email.split('@')[0])

    // Check metadata for newsletter preference (from signup form)
    const acceptsNewsletter = unsafe_metadata?.acceptsNewsletter === true || unsafe_metadata?.newsletter === true;

    try {
      if (!adminDb) {
        console.error('Firestore Admin SDK not initialized');
        return new Response('Error: DB not initialized', { status: 500 });
      }

      const memberRef = adminDb.collection('newMemberCollection').doc(id);
      const existingSnap = await memberRef.get();
      const nowIso = new Date().toISOString();
      const emailLower = email.toLowerCase();

      const baseUpdate: Record<string, any> = {
        firstName,
        lastName,
        displayName: fullName,
        email,
        emailLower,
        memberSlug: slug,
        avatarUrl: image_url,
        profileImage: image_url,
        status: 'active',
        updatedAt: nowIso,
      };

      if (acceptsNewsletter === true) {
        baseUpdate.isNewsletterAuthorized = true;
      }

      if (!existingSnap.exists) {
        baseUpdate.membershipTier = 'free';
        baseUpdate.role = 'member';
        baseUpdate.isAdmin = false;
        baseUpdate.isFeatured = false;
        baseUpdate.createdAt = nowIso;
      }

      await memberRef.set(baseUpdate, { merge: true })

      console.log(`Successfully synced Clerk user to Firestore`)
    } catch (error) {
      console.error('Error syncing user to Firestore:', error)
      return new Response('Error: Firestore sync failed', { status: 500 })
    }

    // 2. Sync to Ghost CMS + send emails (Non-critical, don't fail the whole webhook)
    if (eventType === 'user.created') {
      const nowIso = new Date().toISOString();

      try {
        if (adminDb) {
          const dupSnap = await adminDb
            .collection('newMemberCollection')
            .where('email', '==', email)
            .get();

          const primaryRef = adminDb.collection('newMemberCollection').doc(id);
          const primarySnap = await primaryRef.get();
          const primaryData = primarySnap.data() || {};

          for (const doc of dupSnap.docs) {
            if (doc.id === id) continue;

            const dupData = doc.data() || {};
            const mergeIntoPrimary: Record<string, any> = {};

            const fieldsToCarry = [
              'newsletterSubscribed',
              'isNewsletterRecipient',
              'industrySector',
              'industry',
            ];

            for (const field of fieldsToCarry) {
              if (primaryData[field] === undefined && dupData[field] !== undefined) {
                mergeIntoPrimary[field] = dupData[field];
              }
            }

            if (primaryData.isNewsletterAuthorized !== true && dupData.isNewsletterAuthorized === true) {
              mergeIntoPrimary.isNewsletterAuthorized = true;
            }

            if (Object.keys(mergeIntoPrimary).length > 0) {
              await primaryRef.set(mergeIntoPrimary, { merge: true });
            }

            await doc.ref.delete();
          }
        }
      } catch (err) {
        console.warn('Duplicate cleanup failed (non-critical):', err);
      }

      // 2a. Admin notification email (all admins)
      try {
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
                <li><strong>Name:</strong> ${fullName || 'N/A'}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Plan:</strong> Free</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</li>
              </ul>
            </div>
          `,
        });

        await adminDb?.collection('newMemberCollection').doc(id).set({ adminNotifiedAt: nowIso }, { merge: true });
      } catch (emailErr) {
        console.warn('Admin notification email failed (non-critical):', emailErr);
      }

      // 2b. Free welcome email
      try {
        await sendEmail({
          to: email,
          subject: 'Welcome to Yorkshire Businesswoman!',
          html: await getFreeWelcomeEmailTemplate(firstName || 'there', process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk'),
        });

        await adminDb?.collection('newMemberCollection').doc(id).set({ welcomeEmailSentAt: nowIso }, { merge: true });
      } catch (emailErr) {
        console.warn('Free welcome email failed (non-critical):', emailErr);
      }

      // 2c. Ghost CMS sync
      try {
        const ghostRes = await addGhostMember({
          email,
          name: fullName,
          labels: ['clerk-signup', 'free-member']
        });
        if (ghostRes) {
          await adminDb?.collection('newMemberCollection').doc(id).set({ ghostSyncedAt: nowIso }, { merge: true });
        }
        console.log(`Successfully synced Clerk user to Ghost CMS.`);
      } catch (ghostError) {
        console.warn('Ghost CMS sync failed (non-critical):', ghostError);
      }
    }
  }

  return new Response('Webhook received', { status: 200 })
}
