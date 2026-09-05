import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Inline style properties allowed through when `allowStyles` is enabled.
 * Everything else (position, z-index, url()/expression() payloads, etc.) is
 * still stripped so authors cannot alter layout or load resources.
 */
export const SAFE_INLINE_STYLE_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'text-align',
  'text-decoration',
]);

export type SanitizeHtmlOptions = {
  /**
   * Keep a safe subset of inline `style` declarations (colour, font size,
   * text alignment, …). Without this, every `style` attribute is removed,
   * so the editor's colour/size/underline tools can never be seen on the
   * published page.
   */
  allowStyles?: boolean;
};

function keepSafeInlineStyles(raw: string): string {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  const kept: string[] = [];
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    if (!SAFE_INLINE_STYLE_PROPERTIES.has(property)) continue;
    const propValue = declaration
      .slice(colon + 1)
      .trim()
      .replace(/^url\(/i, 'escape');
    if (!propValue || /(javascript:|vbscript:|expression\()/i.test(propValue)) continue;
    kept.push(`${property}: ${propValue}`);
  }

  return kept.join('; ');
}

export function sanitizeHtml(html: string, options?: SanitizeHtmlOptions) {
  if (!html) return '';

  const allowStyles = Boolean(options?.allowStyles);

  let out = String(html);

  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<\/?(iframe|object|embed|link|meta|base)\b[^>]*>/gi, '');

  out = out.replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

  if (allowStyles) {
    out = out.replace(
      /\sstyle\s*=\s*(".*?"|'.*?'|[^\s>"']+)/gi,
      (_match, raw: string) => {
        const cleaned = keepSafeInlineStyles(raw);
        return cleaned ? ` style="${cleaned}"` : '';
      },
    );
  } else {
    out = out.replace(/\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');
  }

  out = out.replace(/\ssrcdoc\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

  out = out.replace(/\s(href|src)\s*=\s*(["'])\s*(javascript:|vbscript:|data:text\/html)[\s\S]*?\2/gi, '');
  out = out.replace(/\s(href|src)\s*=\s*(javascript:|vbscript:|data:text\/html)[^\s>]+/gi, '');

  return out;
}
