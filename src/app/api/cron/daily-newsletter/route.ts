import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * HARD KILL: The automated Resend newsletter has been permanently disabled.
 * All newsletter communications are now handled exclusively by Beehiiv.
 */
export async function GET() {
  return NextResponse?.json({ 
    success: true, 
    message: 'The automated Resend newsletter has been permanently disabled in favor of Beehiiv.',
    status: 'killed'
  });
}
