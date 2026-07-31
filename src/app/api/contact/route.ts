import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { config } from '@/lib/config';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SUBMIT_SECONDS = 3;
const MAX_FIELD_LENGTH = 2000;

interface ContactPayload {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown;
  elapsedMs?: unknown;
}

function countUrls(text: string): number {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi);
  return matches ? matches.length : 0;
}

function containsSpamSignal(text: string): boolean {
  const lower = text.toLowerCase();
  const spamKeywords = [
    'bitcoin', 'crypto', 'cryptocurrency', 'wallet', 'investment opportunity',
    'claim your prize', 'you have won', 'prize winner', 'wire transfer',
    'get paid', 'earn money online', 'quick cash', 'make money fast',
  ];
  const keywordHits = spamKeywords.filter((kw) => lower.includes(kw)).length;

  // Multiple URLs and/or multiple spam keywords together are a strong signal.
  const urlHits = countUrls(text);
  const repeatedCharacter = /(.)\1{6,}/.test(text);

  return (urlHits >= 3 && keywordHits >= 1) || (urlHits >= 5) || (keywordHits >= 2);
}

export async function POST(req: Request) {
  // Rate limit: 5 requests per minute per IP
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`contact:${ip}`, 5, 60_000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  let body: ContactPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { firstName, lastName, email, subject, message, website, elapsedMs } = body;

  // Honeypot: hidden field that humans never fill. Bots that fill it are
  // silently dropped with a fake success so they keep spamming nothing.
  if (website && String(website).trim().length > 0) {
    return NextResponse.json({ success: true });
  }

  // Time trap: instant submissions are bots. Require a real fill time.
  const elapsed = typeof elapsedMs === 'number' ? elapsedMs : NaN;
  if (!Number.isFinite(elapsed) || elapsed < MIN_SUBMIT_SECONDS * 1000) {
    return NextResponse.json({ success: true });
  }

  // Basic presence validation
  if (
    typeof firstName !== 'string' || !firstName.trim() ||
    typeof lastName !== 'string' || !lastName.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof subject !== 'string' || !subject.trim() ||
    typeof message !== 'string' || !message.trim()
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Strict email format
  if (!EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  // Length caps to prevent abuse
  if (
    firstName.length > 100 || lastName.length > 100 ||
    subject.length > 200 || message.length > MAX_FIELD_LENGTH
  ) {
    return NextResponse.json({ error: 'Message content is too long' }, { status: 400 });
  }

  // Content heuristics for obvious spam
  if (containsSpamSignal(message)) {
    return NextResponse.json({ success: true });
  }

  try {
    const result = await sendEmail({
      to: config.contactRecipients,
      replyTo: `${firstName.trim()} ${lastName.trim()} <${email.trim()}>`,
      subject: `Website Contact Form: ${subject.trim()}`,
      text: `You have received a new message from the Yorkshire Businesswoman contact form.\n\nName: ${firstName.trim()} ${lastName.trim()}\nEmail: ${email.trim()}\nSubject: ${subject.trim()}\n\nMessage:\n${message.trim()}`
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in contact form route:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
