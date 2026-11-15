import { sanitizeHtml } from '@/lib/utils';

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

export function stripRepeatedLeadParagraph(html: string | null | undefined, leadText: string | null | undefined): string {
  const source = String(html || '');
  const normalizedLead = normalizeText(leadText);
  if (!source || !normalizedLead) return source;

  const firstParaMatch = source.match(/^\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*/i);
  if (!firstParaMatch) return source;

  const firstParaText = stripHtml(firstParaMatch[1] || '');
  if (firstParaText !== normalizedLead) return source;

  return source.slice(firstParaMatch[0].length);
}

export function prepareArticleBodyHtml(html: string | null | undefined, standfirst: string | null | undefined): string {
  return sanitizeHtml(stripRepeatedLeadParagraph(html, standfirst));
}
