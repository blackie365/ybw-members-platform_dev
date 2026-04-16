import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

// You can find this secret in your .env.local file
// Ghost will call this URL: https://your-domain.com/api/revalidate/ghost?secret=YOUR_SECRET
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Verify the secret to prevent unauthorized cache purging
    if (secret !== process.env.GHOST_WEBHOOK_SECRET) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // This instantly purges all Next.js caches that were fetched with `tags: ['ghost-posts']`
    revalidateTag('ghost-posts');

    console.log('[Webhook] Successfully revalidated Ghost posts cache');
    
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err: any) {
    console.error('[Webhook] Error revalidating:', err.message);
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}
