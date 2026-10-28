import { NextResponse } from 'next/server';
import {
  fetchPostBySlug,
  isFormat,
  LAYOUTS,
  renderCard,
  type CardImageType,
} from '@/features/social/server/card-renderer';

export const runtime = 'nodejs';

/**
 * Public rendered card for a Ghost article.
 *
 *   GET /api/social/card/{slug}?format=portrait|whatsapp&type=jpeg|png
 *
 * Exists because the Instagram Graph API will only accept a publicly reachable
 * `image_url` — it does not take a direct binary upload. Both Facebook and
 * Instagram therefore reference this endpoint rather than us posting bytes.
 *
 * JPEG is the default because Meta's image container requires it and rejects
 * PNG; `type=png` is kept for eyeballing the cards by hand.
 *
 * Deliberately unauthenticated (Instagram fetches it server-side, with no
 * credentials) but safe to expose: an unknown slug 404s without rendering, and
 * responses are heavily cached so repeat fetches do not re-render.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const searchParams = new URL(request.url).searchParams;
  const format = searchParams.get('format') || 'portrait';
  const typeParam = searchParams.get('type') || 'jpeg';

  if (!isFormat(format)) {
    return NextResponse.json(
      { error: `Unknown format "${format}". Use portrait or whatsapp.` },
      { status: 400 },
    );
  }
  if (typeParam !== 'jpeg' && typeParam !== 'png') {
    return NextResponse.json(
      { error: `Unknown type "${typeParam}". Use jpeg or png.` },
      { status: 400 },
    );
  }
  const type: CardImageType = typeParam;

  try {
    const post = await fetchPostBySlug(slug);
    if (!post) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const image = await renderCard(post, LAYOUTS[format], type);

    return new Response(new Uint8Array(image), {
      status: 200,
      headers: {
        'Content-Type': type === 'jpeg' ? 'image/jpeg' : 'image/png',
        'Content-Length': String(image.length),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('[api/social/card] render failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Card render failed' }, { status: 500 });
  }
}
