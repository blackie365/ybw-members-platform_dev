const TERMINAL_PUNCTUATION_RE = /[.!?]["')\]]*$/;
const SENTENCE_END_RE = /[.!?]["')\]]*(?=\s|$)/g;

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(apos|#39|#x27);/gi, "'")
    .replace(/&(quot|#34);/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value: string): string {
  return normalizeText(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function extractFirstParagraphText(html: string | null | undefined): string {
  const match = String(html || '').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return stripHtml(match?.[1] || '');
}

function hasTerminalPunctuation(value: string): boolean {
  return TERMINAL_PUNCTUATION_RE.test(value);
}

function trimToFirstSentence(value: string): string {
  const match = SENTENCE_END_RE.exec(value);
  SENTENCE_END_RE.lastIndex = 0;
  if (!match || typeof match.index !== 'number') return '';

  const end = match.index + match[0].length;
  return value.slice(0, end).trim();
}

export function getArticleStandfirst(
  post: Pick<{ custom_excerpt?: string | null; excerpt?: string | null; html?: string | null }, 'custom_excerpt' | 'excerpt' | 'html'> | null | undefined,
): string {
  const candidate = normalizeText(post?.custom_excerpt || post?.excerpt || '');
  if (!candidate) {
    return extractFirstParagraphText(post?.html);
  }

  if (hasTerminalPunctuation(candidate)) {
    return candidate;
  }

  const sentenceTrimmed = trimToFirstSentence(candidate);
  if (sentenceTrimmed) {
    return sentenceTrimmed;
  }

  const firstParagraph = extractFirstParagraphText(post?.html);
  if (firstParagraph && hasTerminalPunctuation(firstParagraph)) {
    return firstParagraph;
  }

  return `${candidate.replace(/[,:;\-\/\s]+$/g, '').trim()}.`;
}
