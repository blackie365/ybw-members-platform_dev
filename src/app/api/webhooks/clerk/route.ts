import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { adminDb } from '@/lib/firebase-admin'
import slugify from '@sindresorhus/slugify'

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
      // Sync to Firestore using standardized schema
      await adminDb.collection('newMemberCollection').doc(id).set({
        firstName,
        lastName,
        displayName: fullName,
        email,
        memberSlug: slug,
        avatarUrl: image_url,
        profileImage: image_url,
        status: 'active',
        membershipTier: 'free',
        // AUTHORIZATION LOGIC:
        // 1. If it's an update, we preserve existing authorization unless explicitly changed
        // 2. If it's a new user, they are authorized ONLY if they explicitly accepted during signup
        isNewsletterAuthorized: acceptsNewsletter, 
        role: 'member',
        isAdmin: false,
        isFeatured: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true })

      console.log(`Successfully synced Clerk user ${id} to Firestore. Newsletter Auth: ${acceptsNewsletter}`)
    } catch (error) {
      console.error('Error syncing user to Firestore:', error)
      return new Response('Error: Firestore sync failed', { status: 500 })
    }
  }

  return new Response('Webhook received', { status: 200 })
}
