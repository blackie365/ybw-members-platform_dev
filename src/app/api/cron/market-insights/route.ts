import { NextResponse } from 'next/server';

/**
 * HARD KILL: Automated market insights have been disabled.
 */
export async function GET() {
  return NextResponse.json({ 
    message: 'Cron task permanently disabled.', 
    status: 'killed' 
  });
}
