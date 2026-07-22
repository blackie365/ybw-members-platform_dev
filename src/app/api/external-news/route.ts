import { NextResponse } from 'next/server';
import { getExternalNews } from '@/lib/externalNews';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(request: Request) {
  // Rate limit: 10 requests per minute per IP
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`external-news:${ip}`, 10, 60_000);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        }
      }
    );
  }
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 6;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 12) : 6;

    const articles = await getExternalNews(limit);

    return NextResponse.json(
      { success: true, data: articles },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch external news' },
      { status: 500 }
    );
  }
}
