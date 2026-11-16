import type { ArticleEnhancementBlock, ArticleEnhancementRecord } from '@/lib/news/article-enhancements';

export type ArticleBodySegment =
  | { kind: 'html'; html: string }
  | { kind: 'block'; block: ArticleEnhancementBlock };

export function buildArticleBodySegments(
  html: string,
  enhancement: ArticleEnhancementRecord | null | undefined,
): ArticleBodySegment[] {
  if (!html) return [];

  const insertions = Array.isArray(enhancement?.insertions)
    ? [...enhancement.insertions].sort((a, b) => a.afterParagraph - b.afterParagraph)
    : [];

  if (insertions.length === 0) {
    return [{ kind: 'html', html }];
  }

  const paragraphMatches = Array.from(html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi));
  if (paragraphMatches.length === 0) {
    return [{ kind: 'html', html }];
  }

  const segments: ArticleBodySegment[] = [];
  let lastIndex = 0;
  let paragraphCount = 0;

  for (const match of paragraphMatches) {
    const matchStart = match.index ?? 0;
    const fullMatch = match[0];
    const matchEnd = matchStart + fullMatch.length;

    pushHtmlSegment(segments, html.slice(lastIndex, matchEnd));
    paragraphCount += 1;

    for (const insertion of insertions) {
      if (insertion.afterParagraph !== paragraphCount) continue;
      for (const block of insertion.blocks) {
        segments.push({ kind: 'block', block });
      }
    }

    lastIndex = matchEnd;
  }

  pushHtmlSegment(segments, html.slice(lastIndex));

  const maxParagraph = paragraphCount;
  for (const insertion of insertions) {
    if (insertion.afterParagraph <= maxParagraph) continue;
    for (const block of insertion.blocks) {
      segments.push({ kind: 'block', block });
    }
  }

  return segments;
}

function pushHtmlSegment(segments: ArticleBodySegment[], html: string) {
  if (!html.trim()) return;
  const previous = segments[segments.length - 1];
  if (previous?.kind === 'html') {
    previous.html += html;
    return;
  }
  segments.push({ kind: 'html', html });
}
