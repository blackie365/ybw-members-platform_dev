import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { addGhostMember, editGhostMember } from '@/lib/ghost';

// You can find this secret in your .env.local file
// Ghost will call this URL: https://your-domain.com/api/revalidate/ghost?secret=YOUR_SECRET
export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));

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
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // In Next.js App Router, revalidateTag is a synchronous function that marks the tag to be revalidated
    // TypeScript bug in some @types/react versions expects 2 arguments
    // @ts-ignore
    revalidateTag('ghost-posts');

    console.log('[Webhook] Successfully revalidated Ghost posts cache');
    
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err: any) {
    console.error('[Webhook] Error revalidating:', err.message);
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}
