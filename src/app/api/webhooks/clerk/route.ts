import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { addGhostMember, removeGhostMemberByEmail } from '@/lib/ghost-admin';
import { sendEmail } from '@/lib/email';
import { config } from '@/lib/config';
import { getMemberStore } from '@/features/members/server';
import { paidIntentFromMetadata } from '@/lib/signup-intent';
import { buildMemberSlug } from '@/lib/member-slug';

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
    const store = getMemberStore()

    // Check metadata for newsletter preference (from signup form)
    const acceptsNewsletter = unsafe_metadata?.acceptsNewsletter === true || unsafe_metadata?.newsletter === true;

    // A paid/booking intent means the person is heading to a paid journey
    // (Premium checkout or ticket booking). Their Clerk account — and this
    // member record — exist *before* payment, so until Stripe confirms a
    // payment they must not be recorded as a free member: no free-member
    // Ghost label, no free welcome, and hidden from member lists/counts.
    const paidIntent = paidIntentFromMetadata(unsafe_metadata);

    try {
      const nowIso = new Date().toISOString();
      const emailLower = email.toLowerCase();

      const existing = await store.getMemberByClerkId(id, { includeInvisible: true });

      // Keep an existing slug so member URLs stay stable; otherwise derive a
      // unique one. Without this, nameless sign-ups from a shared inbox all
      // received the same slug and made profile lookups ambiguous.
      const existingSlug =
        typeof existing?.memberSlug === 'string' ? existing.memberSlug.trim() : '';
      const slug = existingSlug || buildMemberSlug({ fullName, email, clerkId: id });

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

      if (!existing) {
        baseUpdate.membershipTier = 'free';
        baseUpdate.role = 'member';
        baseUpdate.isAdmin = false;
        baseUpdate.isFeatured = false;
        baseUpdate.createdAt = nowIso;
        if (paidIntent) {
          // Unpaid paid-funnel sign-up: hold as pending and keep them out of
          // public member lists/counts until Stripe confirms payment.
          baseUpdate.pendingPaidIntent = true;
          baseUpdate.pendingPaidIntentAt = nowIso;
          baseUpdate.visibility = 'invisible';
        }
      }

      await store.upsert({ clerkId: id, profile: baseUpdate });

      console.log(`Successfully synced Clerk user to member store`);
    } catch (error) {
      console.error('Error syncing user to member store:', error)
      return new Response('Error: Member store sync failed', { status: 500 })
    }

    // 2. Sync to Ghost CMS + send emails (Non-critical, don't fail the whole webhook)
    if (eventType === 'user.created') {
      const nowIso = new Date().toISOString();

      // 2a. Admin notification email (fixed YBW-only recipient list)
      try {
        const adminRecipients = config.adminAlertRecipients;

        await sendEmail({
          to: adminRecipients,
          subject: paidIntent
            ? `Pending Sign-up (awaiting payment): ${firstName || 'Someone'}`
            : `New Member Registration: ${firstName || 'Someone'}`,
          html: `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">${paidIntent ? 'Pending Sign-up' : 'New Member Registration'}</h2>
              <p>${paidIntent
                ? 'Someone has created an account on their way to a paid checkout but has not paid yet. They are held as pending and hidden from member lists until payment completes.'
                : 'A new member has just registered on the platform.'}</p>
              <ul>
                <li><strong>Name:</strong> ${fullName || 'N/A'}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Plan:</strong> ${paidIntent ? 'Pending — premium checkout, awaiting payment' : 'Free'}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</li>
              </ul>
            </div>
          `,
        });

        await store.patch(id, { adminNotifiedAt: nowIso });
      } catch (emailErr) {
        console.warn('Admin notification email failed (non-critical):', emailErr);
      }

      // 2b. Free welcome email is now sent via dashboard reconciliation
      //     (ensureWelcomeEmailForMember), which decides free vs premium once the
      //     member's paid state is known — this avoids the confusing double
      //     welcome when someone signs up through the premium checkout path.

      // 2c. Ghost CMS sync — creates the Ghost member (email is the join key)
      try {
        const ghostRes = await addGhostMember({
          email,
          name: fullName,
          // Paid-funnel sign-ups that haven't paid must not be tagged a Ghost
          // free member; hold them as pending until Stripe confirms payment.
          labels: paidIntent ? ['clerk-signup', 'pending-member'] : ['clerk-signup', 'free-member']
        });
        if (ghostRes) {
          await store.patch(id, { ghostSyncedAt: nowIso });
        }
        console.log(`Successfully synced Clerk user to Ghost CMS.`);
      } catch (ghostError) {
        console.warn('Ghost CMS sync failed (non-critical):', ghostError);
      }
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data as { id?: string };

    if (!id) {
      return new Response('Error: No user id provided', { status: 400 });
    }

    try {
      const store = getMemberStore();

      // Clerk's user.deleted payload does not include the email, so look it up
      // before removing the member profile.
      const member = await store.getMemberByClerkId(id);
      const email = typeof member?.email === 'string' ? member.email : undefined;

      await store.remove(id);
      console.log(`Deleted member profile for deleted Clerk user ${id}`);

      if (email) {
        try {
          await removeGhostMemberByEmail(email);
        } catch (ghostErr) {
          console.warn('Ghost member removal failed (non-critical):', ghostErr);
        }
      }
    } catch (error) {
      console.error('Error deleting user profile:', error);
      return new Response('Error: Member store delete failed', { status: 500 });
    }
  }

  return new Response('Webhook received', { status: 200 })
}
