import { NextResponse } from "next/server";
import { getMemberStore } from "@/features/members/server";
import { deleteBeehiivSubscriber } from "@/lib/beehiiv";
import crypto from 'crypto';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function verifyUnsubscribeToken(emailLower: string, token: string) {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  if (!secret) return true;
  if (!token) return false;

  const expected = crypto.createHmac('sha256', secret).update(emailLower).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    const { email, token } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const emailLower = email.toLowerCase();
    if (!verifyUnsubscribeToken(emailLower, typeof token === 'string' ? token : '')) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 1. Update the member profile
    const member = await getMemberStore().getMemberByEmail(email);
    if (member) {
      await getMemberStore().patch(member.clerkId, {
        newsletterSubscribed: false,
        isNewsletterAuthorized: false,
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Update Beehiiv (Optional sync)
    await deleteBeehiivSubscriber(email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
