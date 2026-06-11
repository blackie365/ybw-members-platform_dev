import { revalidateTag, revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { addGhostMember } from '@/lib/ghost-admin';
import { adminDb } from '@/lib/firebase-admin';

// You can find this secret in your .env.local file
// Ghost will call this URL: https://your-domain.com/api/revalidate/ghost?secret=YOUR_SECRET
export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));

    // NEW: Fallback Admin creation for orphaned accounts
    if (payload.action === 'create_member_admin') {
      const { uid, email, firstName, lastName, profileImage } = payload;
      
      if (!uid || !email) {
        return NextResponse.json({ error: 'Missing uid or email' }, { status: 400 });
      }
      if (!adminDb) {
        return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
      }

      await adminDb.collection('newMemberCollection').doc(uid).set({
        firstName: firstName || '',
        lastName: lastName || '',
        email: email,
        profileImage: profileImage || '',
        slug: `${(firstName || '').toLowerCase()}-${(lastName || '').toLowerCase()}-${Date.now().toString().slice(-4)}`,
        status: 'active',
        createdAt: new Date().toISOString(),
      }, { merge: true });

      return NextResponse.json({ success: true, message: 'Member created via Admin SDK' });
    }

    // Check if this is a custom action from our Next.js frontend (like syncing a new member)
    if (payload.action === 'create_member' && payload.email) {
      await addGhostMember({
        email: payload.email,
        name: payload.name,
        labels: payload.labels || []
      });
      return NextResponse.json({ revalidated: false, message: 'Ghost member synced' });
    }
    
    // Check if this is a custom action to upgrade a member
    if (payload.action === 'upgrade_member' && payload.email) {
      // Note: In a real scenario you would first fetch the member by email to get their Ghost ID,
      // then call editGhostMember. For simplicity, we assume addGhostMember handles existing emails gracefully
      // or we just rely on Stripe webhooks for upgrades.
      return NextResponse.json({ message: 'Upgrade logic ready to be implemented' });
    }

    // Otherwise, this is a standard Ghost Webhook to revalidate Next.js cache
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Verify the secret to prevent unauthorized cache purging
    if (secret !== process.env.GHOST_WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized revalidation attempt');
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // In Next.js App Router, revalidateTag marks the tag to be revalidated
    // We revalidate 'ghost-posts' which covers all getPosts calls
    revalidateTag('ghost-posts');
    revalidateTag('ghost-pages');
    
    // Explicitly revalidate key paths to ensure the UI updates immediately
    revalidatePath('/');
    revalidatePath('/news');

    console.log('[Webhook] Successfully revalidated Ghost content and paths');
    
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err: any) {
    console.error('[Webhook] Error revalidating:', err.message);
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}
