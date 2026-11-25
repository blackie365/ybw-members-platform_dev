import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createDraftArticle } from '@/lib/ghost-admin';
import { markdownToHtml } from '@/lib/markdown-to-html';

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, authorName, authorEmail, featureImage } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const htmlContent = markdownToHtml(content);
    if (!htmlContent) {
      return NextResponse.json({ error: 'Article content could not be rendered' }, { status: 400 });
    }

    // Add author credit at the top since we are submitting via API key, 
    // it will be attributed to the API owner otherwise.
    const finalHtml = `
      <p><em>Submitted by Member: ${escapeHtml(authorName || 'YBW Member')} (${escapeHtml(authorEmail || '')})</em></p>
      <hr>
      ${htmlContent}
    `;

    const customExcerpt = `A member submission by ${authorName}`;

    await createDraftArticle({
      title,
      html: finalHtml,
      customExcerpt,
      featureImage
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error submitting article:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit article' }, { status: 500 });
  }
}
