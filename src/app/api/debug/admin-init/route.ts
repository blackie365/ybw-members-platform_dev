import { NextResponse } from 'next/server';
import { adminDbInit } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const envState = {
    FIREBASE_PRIVATE_KEY_set: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    FIREBASE_PRIVATE_KEY_length: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
    FIREBASE_PRIVATE_KEY_preview: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.slice(0, 30) + '...' : null,
    FIREBASE_CLIENT_EMAIL_set: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    FIREBASE_CLIENT_EMAIL_value: process.env.FIREBASE_CLIENT_EMAIL || null,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || null,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
  };

  const out: any = { envState, adminDbInit };

  try {
    const MS = await import('@/lib/magazine-service-server');
    const issue = await MS.getMagazineIssueServer('Ab5bOuKBbmDQBvtbyEIg');
    const pages = await MS.getMagazinePagesServer('Ab5bOuKBbmDQBvtbyEIg');
    out.issue = issue ? {
      id: issue.id,
      title: issue.title,
      readerEditionId: (issue as any).readerEditionId,
      readerEditionPageCount: (issue as any).readerEditionPageCount,
      coverImage_preview: typeof (issue as any).coverImage === 'string' ? (issue as any).coverImage.slice(0, 140) : null,
    } : null;
    out.legacyPagesCount = pages.length;
    if (pages[0]) {
      const vals: string[] = [];
      const walk = (node: any, depth = 0) => {
        if (!node || depth > 4) return;
        if (typeof node === 'string' && (node.includes('firebasestorage') || node.includes('rocket.new') || node.includes('storage.googleapis.com'))) {
          vals.push(node.slice(0, 160));
        } else if (Array.isArray(node)) {
          node.forEach((n) => walk(n, depth + 1));
        } else if (typeof node === 'object') {
          Object.values(node).forEach((v) => walk(v, depth + 1));
        }
      };
      walk(pages.slice(0, 2));
      out.legacyImageUrls = vals.slice(0, 15);
    }
  } catch (e: any) {
    out.issueError = String(e?.message || e);
  }

  try {
    const SR = await import('@/features/magazine/server/simple-reader');
    const list = await SR.listReaderEditions(10);
    out.listReaderEditions = list.map((e: any) => ({
      id: e.id, title: e.title, pageCount: e.pageCount, slug: e.slug, issueId: (e as any).issueId,
    }));
    const explicit = await SR.getReaderEditionById('idml-ybw-aug-2026-msrn5rbl');
    if (explicit) {
      out.explicit = {
        id: explicit.id, title: explicit.title, pageCount: explicit.pageCount,
        coverImage_preview: typeof explicit.coverImage === 'string' ? explicit.coverImage.slice(0, 140) : null,
        pagesSample: explicit.pages?.slice(0, 2).map((p: any) => ({
          template: p.template, title: p.content?.title, imageUrl_preview: typeof p.content?.imageUrl === 'string' ? p.content.imageUrl.slice(0, 140) : null,
        })),
      };
    } else {
      out.explicit = null;
    }
  } catch (e: any) {
    out.readerError = String(e?.message || e);
  }

  return NextResponse.json(out, { status: 200, headers: { 'Cache-Control': 'no-store, no-cache' } });
}
