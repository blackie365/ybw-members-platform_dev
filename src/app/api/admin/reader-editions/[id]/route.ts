import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/server/auth-utils';
import { adminDb } from '@/lib/firebase-admin';
import { deleteReaderEdition, listReaderEditions } from '@/features/magazine/server/simple-reader';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await checkAdmin();
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not initialized' }, { status: 500 });

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    await deleteReaderEdition(id);

    try {
      const snapshot = await adminDb.collection('magazine_issues')
        .where('readerEditionId', '==', id)
        .select()
        .limit(20)
        .get();
      await Promise.all(
        snapshot.docs.map((doc) =>
          adminDb!.collection('magazine_issues').doc(doc.id).update({
            readerEditionId: null,
            readerEditionSlug: null,
            readerEditionPublished: false,
            readerEditionTitle: null,
            readerEditionPublishDate: null,
            readerEditionPageCount: null,
          }).catch(() => null),
        ),
      );
    } catch {
      // Deletion itself already succeeded; unlink failure is non-fatal
    }

    revalidatePath('/magazine');
    revalidatePath('/new-edition');
    revalidatePath('/admin/magazine');
    return NextResponse.json({ success: true, deleted: id });
  } catch (error: any) {
    const message = error?.message || String(error) || 'Unauthorized or failed';
    return NextResponse.json({ success: false, error: message }, { status: /[Uu]nauthorized|[Ff]orbidden/.test(message) ? 403 : 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await checkAdmin();
    const { id } = await params;
    if (id === '_list' || id === 'list') {
      const editions = await listReaderEditions(100);
      return NextResponse.json({
        success: true,
        count: editions.length,
        editions: editions.map((e) => ({ id: e.id, slug: e.slug, title: e.title, pageCount: e.pageCount, publishDate: e.publishDate, coverImage: e.coverImage ? e.coverImage.substring(0, 120) + (e.coverImage.length > 120 ? '...' : '') : '' })),
      });
    }
    return NextResponse.json({ success: false, error: 'Use DELETE /api/admin/reader-editions/<id> to delete, or GET .../_list to list.' }, { status: 400 });
  } catch (error: any) {
    const message = error?.message || String(error) || 'Unauthorized';
    return NextResponse.json({ success: false, error: message }, { status: /[Uu]nauthorized|[Ff]orbidden/.test(message) ? 403 : 500 });
  }
}
