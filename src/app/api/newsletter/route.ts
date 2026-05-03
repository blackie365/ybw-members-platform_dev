import { NextResponse } from 'next/server';
import { addGhostMember } from '@/lib/ghost';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const result = await addGhostMember({
      email,
      labels: ['newsletter-signup', 'v0-magazine']
    });

    return NextResponse.json({ success: true, member: result });
  } catch (error: any) {
    console.error('Newsletter signup error:', error);
    return NextResponse.json({ error: error.message || 'Failed to subscribe' }, { status: 500 });
  }
}
