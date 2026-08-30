import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/server/auth-utils';
import { deleteReaderEdition } from '@/features/magazine/server/simple-reader';
import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await checkAdmin();

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    await deleteReaderEdition(id);

    try {
      const readStore = getMagazineReadStore();
      const { getMagazineWriteStore } = await import('@/features/magazine/server/write-store');
      const issues = await readStore.getMagazineIssues();
      const patch: Record<string, unknown> = {
        readerEditionId: null,
        readerEditionSlug: null,
        readerEditionPublished: false,
        readerEditionTitle: null,
        readerEditionPublishDate: null,
        readerEditionPageCount: null,
        updatedAt: new Date().toISOString(),
      };
      for (const issue of issues) {
        if (String((issue as any).readerEditionId || '') === String(id)) {
          await getMagazineWriteStore().updateIssue(String((issue as any).id), patch);
        }
      }
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
      const editions = await getMagazineReadStore().listReaderEditions(100);
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
