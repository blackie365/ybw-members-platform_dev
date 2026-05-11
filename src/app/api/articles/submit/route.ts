import { NextResponse } from 'next/server';
import { createDraftArticle } from '@/lib/ghost';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, authorName, authorEmail } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    // Convert newlines to simple HTML paragraphs for the Ghost editor.
    // In a production app, you might use a markdown-to-html converter here.
    const htmlContent = content
      .split('\n\n')
      .map((paragraph: string) => `<p>${paragraph.trim()}</p>`)
      .join('\n');

    // Add author credit at the top since we are submitting via API key, 
    // it will be attributed to the API owner otherwise.
    const finalHtml = `
      <p><em>Submitted by Member: ${authorName} (${authorEmail})</em></p>
      <hr>
      ${htmlContent}
    `;

    const customExcerpt = `A member submission by ${authorName}`;

    await createDraftArticle({
      title,
      html: finalHtml,
      customExcerpt
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error submitting article:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit article' }, { status: 500 });
  }
}