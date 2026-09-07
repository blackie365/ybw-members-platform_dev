import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { checkAdmin } from '@/lib/server/auth-utils';
import { bakeClassifiedsIntoEdition } from '@/features/magazine/server/bake-classifieds';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await checkAdmin();

    let body: { editionId?: string; slug?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body → bake into the most recently published edition.
    }

    const result = await bakeClassifiedsIntoEdition(body);
    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }

    for (const path of ['/new-edition', `/magazine/read/${result.slug}`]) {
      try {
        revalidatePath(path);
      } catch {
        // Revalidation is best-effort; ISR still refreshes within 60s.
      }
    }

    return NextResponse.json({ ok: true, editionId: result.editionId, count: result.count });
  } catch (error: any) {
    const message = error?.message || String(error) || 'Unauthorized';
    return NextResponse.json(
      { ok: false, reason: message },
      { status: /[Uu]nauthorized|[Ff]orbidden/.test(message) ? 403 : 500 },
    );
  }
}