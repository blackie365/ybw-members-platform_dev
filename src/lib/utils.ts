import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeHtml(html: string) {
  if (!html) return '';

  let out = String(html);

  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<\/?(iframe|object|embed|link|meta|base)\b[^>]*>/gi, '');

  out = out.replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');
  out = out.replace(/\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');
  out = out.replace(/\ssrcdoc\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

  out = out.replace(/\s(href|src)\s*=\s*(["'])\s*(javascript:|vbscript:|data:text\/html)[\s\S]*?\2/gi, '');
  out = out.replace(/\s(href|src)\s*=\s*(javascript:|vbscript:|data:text\/html)[^\s>]+/gi, '');

  return out;
}
