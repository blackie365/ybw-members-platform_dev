'use client';

/**
 * shared.tsx — Gen 1 magazine page renderers, lifted from MagazineReader.tsx.
 * These components are the visual gold standard for the digital edition.
 * They accept a flexible `data: any` object (produced by each template's
 * buildViewModel()) and an optional `imageVersion` cache-buster string.
 *
 * All page components are exported so template renderers can import them.
 */

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { fixMagazineImageUrl } from '@/lib/magazine-utils';
import { sanitizeHtml } from '@/lib/utils';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type AdditionalMediaItem = {
  src: string;
  alt: string;
  caption?: string;
  layout?: 'inline' | 'wide' | 'full' | 'mosaic';
  ratio?: string;
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

export function SafeText({ html, className }: { html: string; className?: string }) {
  if (!html) return null;

  let content = html;
  if (!html.includes('<')) {
    const normalized = html.replace(/\r\n/g, '\n');
    const lines = normalized.split(/\n+/g).map((l) => l.trim()).filter(Boolean);
    content = lines.map((l) => `<p>${l}</p>`).join('');
  } else if (!html.includes('<p') && !html.includes('<br')) {
    const normalized = html.replace(/\r\n/g, '\n');
    const lines = normalized.split(/\n+/g).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      content = lines.map((l) => `<p>${l}</p>`).join('');
    } else {
      content = html.replace(/\n/g, '<br />');
    }
  }

  const sanitized = sanitizeHtml(content);

  return (
    <div
      className={[
        '[&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_a]:underline [&_a]:underline-offset-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl [&_img]:my-5 [&_img]:shadow-[0_14px_60px_rgba(0,0,0,0.12)] [&_figure]:my-6 [&_figcaption]:mt-2 [&_figcaption]:text-xs [&_figcaption]:leading-snug [&_figcaption]:opacity-70 [&_blockquote]:my-8 [&_blockquote]:px-6 [&_blockquote]:py-5 [&_blockquote]:rounded-3xl [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#a3413a] [&_blockquote]:bg-[#a3413a]/10 [&_blockquote]:font-serif [&_blockquote]:italic [&_blockquote]:text-[1.05em] [&_blockquote_p]:mb-0',
        className,
      ].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

function normalizeAdditionalMedia(input: any, fallbackAlt: string): AdditionalMediaItem[] {
  if (!input) return [];

  const looksLikeUrl = (value: string) => {
    const v = value.trim();
    if (!v) return false;
    return (
      v.startsWith('https://') ||
      v.startsWith('http://') ||
      v.startsWith('/') ||
      v.startsWith('./') ||
      v.startsWith('../') ||
      v.startsWith('data:')
    );
  };

  const raw: any[] = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? (() => {
        const trimmed = input.trim();
        if (!trimmed) return [];

        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
          } catch {}
        }

        if (trimmed.includes('\n')) {
          return trimmed.split(/\r?\n+/g).map((s) => s.trim()).filter(Boolean);
        }

        const commaSpaceParts = trimmed.split(/,\s+/g).map((s) => s.trim()).filter(Boolean);
        if (commaSpaceParts.length > 1 && commaSpaceParts.every(looksLikeUrl)) {
          return commaSpaceParts;
        }

        const semicolonSpaceParts = trimmed.split(/;\s+/g).map((s) => s.trim()).filter(Boolean);
        if (semicolonSpaceParts.length > 1 && semicolonSpaceParts.every(looksLikeUrl)) {
          return semicolonSpaceParts;
        }

        const httpCount = (trimmed.match(/https?:\/\//g) || []).length;
        if (httpCount >= 2) {
          return trimmed.split(/[,;]\s*(?=https?:\/\/)/g).map((s) => s.trim()).filter(Boolean);
        }

        return [trimmed];
      })()
      : [];

  const items: AdditionalMediaItem[] = [];

  for (const entry of raw) {
    if (!entry) continue;
    if (typeof entry === 'string') {
      const src = entry.trim();
      if (!src) continue;
      items.push({ src, alt: fallbackAlt || 'Image' });
      continue;
    }

    if (typeof entry === 'object') {
      const src = String((entry as any).src || (entry as any).url || (entry as any).image || '').trim();
      if (!src) continue;
      const alt = String((entry as any).alt || (entry as any).title || fallbackAlt || 'Image').trim();
      const caption = String((entry as any).caption || (entry as any).credit || '').trim() || undefined;
      const layout = String((entry as any).layout || '').trim();
      const ratio = String((entry as any).ratio || (entry as any).aspect || '').trim();
      items.push({
        src,
        alt,
        caption,
        layout: (layout === 'inline' || layout === 'wide' || layout === 'full' || layout === 'mosaic') ? layout : undefined,
        ratio: ratio || undefined,
      });
    }
  }

  return items;
}

function getAdditionalMedia(data: any, fallbackAlt: string): AdditionalMediaItem[] {
  const main = String(data?.featureImage || data?.image || '').trim();
  const sources: AdditionalMediaItem[] = [
    ...normalizeAdditionalMedia(data?.images, fallbackAlt),
    ...normalizeAdditionalMedia(data?.gallery, fallbackAlt),
    ...normalizeAdditionalMedia(data?.additionalImages, fallbackAlt),
  ];

  const seen = new Set<string>();
  const cleaned: AdditionalMediaItem[] = [];

  for (const item of sources) {
    const key = item.src.trim();
    if (!key) continue;
    if (main && key === main) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(item);
  }

  return cleaned;
}

function normalizePullQuotes(input: any): string[] {
  if (!input) return [];

  const clean = (value: string) => {
    let v = String(value || '').trim();
    if (!v) return '';
    v = v.replace(/&ldquo;|&rdquo;|&quot;/g, '"').trim();
    v = v.replace(/^["'""]+/, '').replace(/["'""]+$/, '').trim();
    v = v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return v;
  };

  const raw: any[] = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? (() => {
        const trimmed = input.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
          } catch {}
        }
        if (trimmed.includes('\n')) {
          return trimmed.split(/\r?\n+/g).map((s) => s.trim()).filter(Boolean);
        }
        return [trimmed];
      })()
      : [input];

  const out: string[] = [];
  for (const entry of raw) {
    if (!entry) continue;
    if (typeof entry === 'string') {
      const text = clean(entry);
      if (text) out.push(text);
      continue;
    }
    if (typeof entry === 'object') {
      const text = clean((entry as any).text || (entry as any).quote || (entry as any).value || '');
      if (text) out.push(text);
    }
  }

  return out.slice(0, 4);
}

function PullQuoteCard({ text, variant, align }: { text: string; variant: 'light' | 'dark'; align: 'left' | 'right' }) {
  const accentClassName = 'text-[#a3413a]';
  const textClassName = variant === 'dark' ? 'text-white/85' : 'text-[#3d2b1f]/85';
  const floatClassName = align === 'right' ? 'md:float-right md:ml-6' : 'md:float-left md:mr-6';

  return (
    <blockquote
      className={[
        'relative px-6 py-6',
        'md:w-1/3 lg:w-1/4 md:mt-1 md:mb-3',
        floatClassName,
      ].join(' ')}
    >
      <div
        className={['absolute -top-9 -left-4 font-serif leading-none select-none', accentClassName].join(' ')}
        style={{ fontSize: 'clamp(4.25rem, 8vw, 7rem)', opacity: 0.25 }}
        aria-hidden="true"
      >
        &ldquo;
      </div>
      <p className={['relative font-serif italic leading-relaxed', textClassName].join(' ')} style={{ fontSize: 'clamp(1.15rem, 2.2vw, 1.55rem)' }}>
        &ldquo;{text}&rdquo;
      </p>
      <div className="mt-5 h-px w-14 bg-[#a3413a]" style={{ opacity: variant === 'dark' ? 0.5 : 0.35 }} />
    </blockquote>
  );
}

function getMosaicClassName(index: number, count: number) {
  if (count <= 1) return 'col-span-12 aspect-[16/9]';
  if (count === 2) return 'col-span-12 md:col-span-6 aspect-[4/3]';
  if (count === 3) {
    if (index === 0) return 'col-span-12 md:col-span-7 aspect-[16/10]';
    return 'col-span-6 md:col-span-5 aspect-[4/3]';
  }
  if (count === 4) {
    if (index === 0) return 'col-span-12 md:col-span-8 aspect-[16/9]';
    if (index === 1) return 'col-span-6 md:col-span-4 aspect-[4/5]';
    return 'col-span-6 md:col-span-4 aspect-[4/3]';
  }
  if (index === 0) return 'col-span-12 md:col-span-6 aspect-[16/10]';
  if (index === 1) return 'col-span-6 md:col-span-3 aspect-[4/5]';
  if (index === 2) return 'col-span-6 md:col-span-3 aspect-[4/5]';
  return 'col-span-6 md:col-span-4 aspect-[4/3]';
}

function AdditionalMediaGallery({ items, imageVersion, variant = 'light' }: { items: AdditionalMediaItem[]; imageVersion: string; variant?: 'light' | 'dark' }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 10) : [];
  if (safeItems.length === 0) return null;

  const cardClassName = variant === 'dark' ? 'border border-white/10 bg-white/5' : 'border border-[#e8d5c0] bg-white';
  const captionClassName = variant === 'dark' ? 'text-white/70' : 'text-[#7a6e65]';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-3">
        {safeItems.map((item, i) => (
          <div
            key={`${item.src}-${i}`}
            className={[
              'relative overflow-hidden rounded-2xl shadow-[0_14px_60px_rgba(0,0,0,0.10)]',
              cardClassName,
              getMosaicClassName(i, safeItems.length),
            ].join(' ')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fixMagazineImageUrl(item.src, imageVersion)}
              alt={item.alt}
              className="w-full h-full object-cover transition-transform duration-700 ease-out hover:scale-[1.04]"
              loading="lazy"
            />
            {item.caption ? (
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className={variant === 'dark' ? 'rounded-xl bg-black/45 backdrop-blur-sm border border-white/10 px-3 py-2' : 'rounded-xl bg-white/80 backdrop-blur-sm border border-[#e8d5c0] px-3 py-2'}>
                  <p className={['text-[11px] leading-snug', captionClassName].join(' ')}>{item.caption}</p>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getRatioClassName(ratio: string | undefined, fallback: string) {
  const normalized = String(ratio || '').trim();
  if (!normalized) return fallback;
  if (normalized === '16/9' || normalized === '16:9') return 'aspect-[16/9]';
  if (normalized === '4/3' || normalized === '4:3') return 'aspect-[4/3]';
  if (normalized === '3/4' || normalized === '3:4') return 'aspect-[3/4]';
  if (normalized === '4/5' || normalized === '4:5') return 'aspect-[4/5]';
  if (normalized === '1/1' || normalized === '1:1' || normalized === 'square') return 'aspect-square';
  return fallback;
}

function MediaFigure({
  item,
  imageVersion,
  variant,
  size,
  align,
}: {
  item: AdditionalMediaItem;
  imageVersion: string;
  variant: 'light' | 'dark';
  size: 'inline' | 'wide' | 'full';
  align?: 'left' | 'right';
}) {
  const frameClassName = variant === 'dark' ? 'border border-white/10 bg-white/5' : 'border border-[#e8d5c0] bg-white';
  const captionClassName = variant === 'dark' ? 'text-white/70' : 'text-[#7a6e65]';
  const ratioClassName = getRatioClassName(item.ratio, size === 'inline' ? 'aspect-[4/3]' : 'aspect-[16/9]');

  let outerClassName = 'w-full mb-6 mt-2';
  if (size === 'inline') {
    outerClassName = align === 'left'
      ? 'w-full md:w-1/2 lg:w-5/12 md:float-left md:mr-8 md:mb-6 md:mt-2'
      : 'w-full md:w-1/2 lg:w-5/12 md:float-right md:ml-8 md:mb-6 md:mt-2';
  } else if (size === 'full') {
    outerClassName = 'w-full mb-8 mt-4 clear-both';
  } else if (size === 'wide') {
    outerClassName = 'w-full max-w-4xl mx-auto mb-8 mt-4 clear-both';
  }

  return (
    <figure className={['rounded-3xl overflow-hidden shadow-[0_20px_90px_rgba(0,0,0,0.14)]', frameClassName, outerClassName].join(' ')}>
      <div className={['relative', ratioClassName].join(' ')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fixMagazineImageUrl(item.src, imageVersion)}
          alt={item.alt}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className={variant === 'dark' ? 'absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent' : 'absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent'} />
      </div>
      {item.caption ? (
        <figcaption className="px-5 py-4">
          <div className="h-px w-10 bg-[#a3413a] mb-2" />
          <p className={['text-sm leading-relaxed', captionClassName].join(' ')}>{item.caption}</p>
        </figcaption>
      ) : null}
    </figure>
  );
}

function InterleavedTextWithMedia({
  blocks,
  inlineMedia,
  pullQuotes,
  imageVersion,
  variant,
  textClassName,
}: {
  blocks: string[];
  inlineMedia: AdditionalMediaItem[];
  pullQuotes?: string[];
  imageVersion: string;
  variant: 'light' | 'dark';
  textClassName: string;
}) {
  const safeBlocks = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  const safeMedia = Array.isArray(inlineMedia) ? inlineMedia.filter(Boolean) : [];
  const safeQuotes = Array.isArray(pullQuotes) ? pullQuotes.map((q) => String(q || '').trim()).filter(Boolean) : [];
  if (safeBlocks.length === 0) return null;

  const quotePoints = new Set<number>();
  const mediaPoints = new Set<number>();

  let availableSlots: number[] = [];
  for (let i = 1; i < safeBlocks.length; i++) availableSlots.push(i);

  const qSpacing = Math.max(2, Math.floor(safeBlocks.length / (safeQuotes.length + 1)));
  for (let i = 0; i < safeQuotes.length; i++) {
    let pt = (i + 1) * qSpacing;
    if (pt >= safeBlocks.length) pt = safeBlocks.length - 1;
    quotePoints.add(pt);
    availableSlots = availableSlots.filter(s => s !== pt);
  }

  const mSpacing = Math.max(1, Math.floor(availableSlots.length / (safeMedia.length + 1)));
  for (let i = 0; i < safeMedia.length; i++) {
    if (availableSlots.length > 0) {
      const idx = Math.min((i + 1) * mSpacing, availableSlots.length - 1);
      const pt = availableSlots[idx];
      mediaPoints.add(pt);
      availableSlots = availableSlots.filter(s => s !== pt);
    } else {
      mediaPoints.add(safeBlocks.length - 1);
    }
  }

  let mediaIndex = 0;
  let quoteIndex = 0;
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < safeBlocks.length; i += 1) {
    if (mediaPoints.has(i) && mediaIndex < safeMedia.length) {
      const item = safeMedia[mediaIndex];
      const requestedLayout = item.layout === 'full' || item.layout === 'wide' || item.layout === 'inline' ? item.layout : undefined;
      const size = requestedLayout || 'inline';
      const align = mediaIndex % 2 === 0 ? 'left' : 'right';
      mediaIndex++;

      if (size === 'inline') {
        nodes.push(<MediaFigure key={`tm-${i}`} item={item} imageVersion={imageVersion} variant={variant} size={size} align={align} />);
      } else {
        nodes.push(
          <div key={`tm-${i}`} className="py-2 clear-both w-full">
            <MediaFigure item={item} imageVersion={imageVersion} variant={variant} size={size} align={align} />
          </div>
        );
      }
    }

    if (quotePoints.has(i) && quoteIndex < safeQuotes.length) {
      const quote = safeQuotes[quoteIndex];
      const align = quoteIndex % 2 === 0 ? 'right' : 'left';
      quoteIndex += 1;
      nodes.push(<PullQuoteCard key={`tq-${i}`} text={quote} variant={variant} align={align} />);
    }

    nodes.push(<SafeText key={`tb-${i}`} html={safeBlocks[i]} className={textClassName} />);
  }

  while (mediaIndex < safeMedia.length) {
    const item = safeMedia[mediaIndex];
    const requestedLayout = item.layout === 'full' || item.layout === 'wide' || item.layout === 'inline' ? item.layout : undefined;
    const size = requestedLayout || 'wide';
    const align = mediaIndex % 2 === 0 ? 'left' : 'right';
    mediaIndex++;
    nodes.push(
      <div key={`tm-leftover-${mediaIndex}`} className="py-4 clear-both w-full">
        <MediaFigure item={item} imageVersion={imageVersion} variant={variant} size={size} align={align} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {nodes}
      <div className="clear-both" />
    </div>
  );
}

export function renderTitleArt(text: unknown, emphasisClassName?: string): React.ReactNode {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  const re = /\*([^*]+)\*/g;
  if (!re.test(raw)) return raw;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(raw)) !== null) {
    if (m.index > lastIndex) nodes.push(raw.slice(lastIndex, m.index));
    nodes.push(
      <span key={`ta-${key++}`} className={emphasisClassName || 'font-serif italic text-[#a3413a]'}>
        {m[1]}
      </span>
    );
    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < raw.length) nodes.push(raw.slice(lastIndex));
  return <>{nodes}</>;
}

export function getHtmlBlocks(html: string): string[] {
  if (!html) return [];
  const hasTags = html.includes('<');
  const normalizedRaw = html.replace(/\r\n/g, '\n');

  if (hasTags && !html.includes('<p') && normalizedRaw.includes('\n')) {
    const lines = normalizedRaw.split(/\n+/g).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) return lines.map((l) => `<p>${l}</p>`);
  }

  if (typeof window !== 'undefined' && hasTags && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const body = doc.body;
      const paragraphs = Array.from(body.querySelectorAll('p'));
      if (paragraphs.length > 0) return paragraphs.map((p) => p.outerHTML.trim()).filter(Boolean);

      const blockTagNames = new Set(['h1','h2','h3','h4','h5','h6','ul','ol','blockquote','pre','figure','hr']);
      const blockChildren = Array.from(body.children).filter((el) => blockTagNames.has(el.tagName.toLowerCase()));
      if (blockChildren.length > 0) return blockChildren.map((el) => el.outerHTML.trim()).filter(Boolean);

      const inner = body.innerHTML.trim();
      if (!inner) return [];
      const parts = inner.split(/(?:<br\s*\/?>\\s*){2,}/gi).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) return parts.map((p) => `<p>${p}</p>`);
      return [`<p>${inner}</p>`];
    } catch {}
  }

  const normalized = hasTags ? html : html.replace(/\r\n/g, '\n');
  if (!hasTags) {
    const lines = normalized.split(/\n+/g).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    return lines.map((l) => `<p>${l}</p>`);
  }

  const parts = normalized.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [html];
  return parts;
}

function addClassToFirstParagraph(html: string, className: string) {
  if (!html) return html;
  return html.replace(/<p(\s[^>]*)?>/i, (full, attrs = '') => {
    const hasClass = /\sclass=/.test(attrs);
    if (!hasClass) return `<p${attrs} class="${className}">`;
    return full.replace(/class=(['"])(.*?)\1/i, (_m, q, existing) => `class=${q}${existing} ${className}${q}`);
  });
}

function getFeatureTypography(weightInput: unknown) {
  const parsedWeight = Number(weightInput);
  const weight = parsedWeight === 1 || parsedWeight === 2 || parsedWeight === 3 || parsedWeight === 4
    ? parsedWeight
    : 2;

  switch (weight) {
    case 1:
      return {
        titleSize: 'clamp(2.35rem, 4.8vw, 3.9rem)',
        splitTitleSize: 'calc(clamp(2rem, 4vw, 3.2rem) + 28px)',
        quoteSize: 'clamp(1.2rem, 2.4vw, 1.7rem)',
        introClassName: 'font-serif text-base leading-relaxed text-[#3d2b1f]/82 font-medium [&_p]:mb-2',
        bodyLightClassName: 'font-serif text-base leading-[1.82] text-[#3d2b1f]/80 [&_p]:mb-4',
        bodyDarkClassName: 'font-serif text-[1.05rem] text-white/92 leading-[1.82] [&_p]:mb-4 [&_p:last-child]:mb-0',
        continuationBodyClassName: 'font-serif text-[#3d2b1f]/82 leading-[1.9] text-[1.1rem] [&_p]:mb-6',
      };
    case 3:
      return {
        titleSize: 'clamp(1.85rem, 3.7vw, 3rem)',
        splitTitleSize: 'calc(clamp(1.5rem, 3.15vw, 2.45rem) + 16px)',
        quoteSize: 'clamp(1rem, 1.95vw, 1.3rem)',
        introClassName: 'font-serif text-[0.95rem] leading-relaxed text-[#3d2b1f]/78 font-medium [&_p]:mb-2',
        bodyLightClassName: 'font-serif text-[0.95rem] leading-[1.72] text-[#3d2b1f]/74 [&_p]:mb-3',
        bodyDarkClassName: 'font-serif text-[0.98rem] text-white/84 leading-[1.74] [&_p]:mb-4 [&_p:last-child]:mb-0',
        continuationBodyClassName: 'font-serif text-[#3d2b1f]/78 leading-[1.78] text-[1rem] [&_p]:mb-5',
      };
    case 4:
      return {
        titleSize: 'clamp(1.7rem, 3.3vw, 2.65rem)',
        splitTitleSize: 'calc(clamp(1.4rem, 2.85vw, 2.2rem) + 12px)',
        quoteSize: 'clamp(0.95rem, 1.8vw, 1.2rem)',
        introClassName: 'font-serif text-[0.9rem] leading-relaxed text-[#3d2b1f]/74 font-medium [&_p]:mb-2',
        bodyLightClassName: 'font-serif text-[0.92rem] leading-[1.68] text-[#3d2b1f]/72 [&_p]:mb-3',
        bodyDarkClassName: 'font-serif text-[0.95rem] text-white/80 leading-[1.7] [&_p]:mb-4 [&_p:last-child]:mb-0',
        continuationBodyClassName: 'font-serif text-[#3d2b1f]/74 leading-[1.72] text-[0.98rem] [&_p]:mb-5',
      };
    case 2:
    default:
      return {
        titleSize: 'clamp(2rem, 4vw, 3.25rem)',
        splitTitleSize: 'calc(clamp(1.6rem, 3.5vw, 2.8rem) + 20px)',
        quoteSize: 'clamp(1.05rem, 2vw, 1.35rem)',
        introClassName: 'font-serif text-sm leading-relaxed text-[#3d2b1f]/80 font-medium [&_p]:mb-2',
        bodyLightClassName: 'font-serif text-sm leading-relaxed text-[#3d2b1f]/75 [&_p]:mb-3',
        bodyDarkClassName: 'font-serif text-white/90 leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0',
        continuationBodyClassName: 'font-serif text-[#3d2b1f]/80 leading-[1.85] text-[1.05rem] [&_p]:mb-5',
      };
  }
}

export function useScrollReveal(ref: React.RefObject<HTMLElement | null>, options?: IntersectionObserverInit) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('revealed'); }); },
      options ?? { threshold: 0.08 }
    );
    root.querySelectorAll('.scroll-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ref, options]);
}

// ─────────────────────────────────────────────
// COVER PAGE
// ─────────────────────────────────────────────
export const PageCover = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll('.cover-animate');
    items.forEach((item, i) => {
      (item as HTMLElement).style.animationDelay = `${0.2 + i * 0.15}s`;
      item.classList.add('animate-slide-in-blur');
    });
  }, []);

  const dateIssue = [data.date, data.issue].filter(Boolean).join(' · ');
  const backgroundImage = String(data.image || '').trim();
  const featureImageExplicit = String(data.featureImage || '').trim();
  const featureImage = featureImageExplicit || backgroundImage;
  const backgroundMedia = backgroundImage || featureImage;
  const additionalMedia = getAdditionalMedia(data, String(data.headline || data.title || 'Cover').trim());

  return (
    <div ref={ref} className="relative min-h-full overflow-hidden bg-[#0c0a09]">
      {backgroundMedia ? (
        <div
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${featureImageExplicit ? 'blur-xl opacity-50 scale-110' : ''}`}
          style={{ backgroundImage: `url('${fixMagazineImageUrl(backgroundMedia, imageVersion)}')` }}
        />
      ) : null}

      {data.videoUrl ? (
        <video
          src={fixMagazineImageUrl(data.videoUrl, imageVersion)}
          poster={backgroundMedia ? fixMagazineImageUrl(backgroundMedia, imageVersion) : undefined}
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[28rem] h-[28rem] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(163,65,58,0.25) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(163,65,58,0.18) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <div className="grain-overlay absolute inset-0 z-10" />
      <div className="absolute left-0 top-0 bottom-0 w-1 z-20"
        style={{ background: 'linear-gradient(to bottom, transparent, #a3413a 30%, #a3413a 70%, transparent)' }} />

      <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-10 py-12 lg:py-16 min-h-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className={['max-w-xl', featureImageExplicit ? 'lg:col-span-6' : 'lg:col-span-12'].join(' ')}>
          <div className="cover-animate opacity-0 mb-7">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 border border-white/15 bg-white/[0.06] backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a3413a] inline-block animate-pulse" />
              {dateIssue || 'Digital Edition'}
            </span>
          </div>

          <div className="cover-animate opacity-0 mb-7">
            <h1 className="text-hero-display font-serif font-600 text-white leading-none">
              Yorkshire<br />
              <span className="cover-gold-shimmer">Business</span><br />
              Woman
            </h1>
          </div>

          {(data.headline || data.subheadline) && (
            <div className="cover-animate opacity-0 mb-7">
              <div className="inline-flex items-start gap-3 bg-white/[0.07] backdrop-blur-md border border-white/15 rounded-xl px-4 py-3.5 max-w-sm">
                <div className="w-0.5 h-12 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(to bottom, #a3413a, #a3413a)' }} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-1">
                    {data.badge || 'Special Report'}
                  </p>
                  {data.headline && (
                    <p className="text-white font-semibold text-sm leading-snug line-clamp-2">{data.headline}</p>
                  )}
                  {data.subheadline && (
                    <div className="text-white/60 text-xs leading-snug mt-1 [&_p]:m-0 [&_p]:inline">
                      <SafeText html={data.subheadline} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="cover-animate opacity-0 flex items-center gap-3 flex-wrap">
            <Link
              href="/new-edition"
              className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-full text-[#0c0a09] hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #a3413a 0%, #a3413a 100%)' }}
            >
              Browse Archive
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/membership"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/25 text-white/80 font-medium text-sm rounded-full hover:bg-white/[0.08] hover:border-white/40 transition-all"
            >
              Join the Community
            </Link>
          </div>

          {additionalMedia.length > 0 && (
            <div className="cover-animate opacity-0 mt-10 max-w-md">
              <AdditionalMediaGallery items={additionalMedia} imageVersion={imageVersion} variant="dark" />
            </div>
          )}
        </div>

        {featureImageExplicit ? (
          <div className="hidden lg:block lg:col-span-6 cover-animate opacity-0">
            <div className="relative mx-auto w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_28px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fixMagazineImageUrl(featureImageExplicit, imageVersion)}
                alt={String(data.headline || data.title || 'Cover Feature').trim()}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/5" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// FULL PAGE AD
// ─────────────────────────────────────────────
export const PageFullPageAd = ({ data, imageVersion }: any) => {
  const image = String(data?.image || '').trim();
  const backgroundImage = String(data?.backgroundImage || '').trim();
  const videoUrl = String(data?.videoUrl || '').trim();
  const label = String(data?.label || 'Advertisement').trim();
  const alt = String(data?.alt || label || 'Advertisement').trim();
  const hasBackgroundMedia = Boolean(videoUrl || backgroundImage);
  const rawLink = String(data?.linkUrl || '').trim();
  const href = rawLink
    ? (rawLink.startsWith('https://') || rawLink.startsWith('http://') ? rawLink : `https://${rawLink}`)
    : '';

  return (
    <div className="relative min-h-full bg-[#0c0a09] overflow-hidden">
      {videoUrl ? (
        <video
          src={fixMagazineImageUrl(videoUrl, imageVersion)}
          poster={backgroundImage ? fixMagazineImageUrl(backgroundImage, imageVersion) : (image ? fixMagazineImageUrl(image, imageVersion) : undefined)}
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : backgroundImage ? (
        <Image src={fixMagazineImageUrl(backgroundImage, imageVersion)} alt="" fill sizes="100vw" className="object-cover" />
      ) : image ? (
        <Image src={fixMagazineImageUrl(image, imageVersion)} alt="" fill sizes="100vw" className="object-cover blur-2xl scale-105 opacity-35" />
      ) : null}

      {image ? (
        <div className={`absolute inset-0 ${hasBackgroundMedia ? 'p-6 sm:p-8 lg:p-10' : ''}`}>
          <div className="relative w-full h-full">
            <Image src={fixMagazineImageUrl(image, imageVersion)} alt={alt} fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c0a09] via-[#141210] to-[#0c0a09]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/22 via-transparent to-black/8" />

      <div className="absolute top-5 left-5 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a3413a]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{label || 'Advertisement'}</span>
        </div>
      </div>

      {href ? (
        <div className="absolute bottom-6 right-6 z-10">
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-semibold hover:bg-white/15 hover:border-white/25 transition-colors"
          >
            Visit
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────
// EDITORIAL PAGE (Editor's Letter)
// ─────────────────────────────────────────────
export const PageEditorial = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  const allBlocks = getHtmlBlocks(data.text || '');
  const introHtml = data.intro || (!data.intro && allBlocks.length > 1 ? allBlocks[0] : '');
  const bodyHtml = (introHtml ? allBlocks.slice(1) : allBlocks).join('');
  const signature = String(data.author || '').trim().split(/\s+/g).filter(Boolean)[0] || '';
  const introWithDropcap = introHtml ? addClassToFirstParagraph(introHtml, 'editorial-dropcap') : '';
  const additionalMedia = getAdditionalMedia(data, String(data.title || data.author || 'Editorial').trim());
  const inlineMedia = additionalMedia.slice(0, 4);
  const remainingMedia = additionalMedia.slice(inlineMedia.length);
  const textBlocks = [
    ...(introWithDropcap ? [introWithDropcap] : []),
    ...getHtmlBlocks(bodyHtml || ''),
  ];
  const featureImage = String(data.featureImage || data.image || '').trim();

  return (
    <div ref={ref} className="bg-[#faf7f2] py-16 lg:py-24 min-h-full">
      <div className="h-1 w-full mb-0" style={{ background: 'linear-gradient(90deg, #a3413a 0%, #a3413a 100%)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
        <div className="scroll-reveal mb-10">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#a3413a]/40 to-transparent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] whitespace-nowrap px-2">
              Editor&apos;s Note
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#a3413a]/40 to-transparent" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4 scroll-reveal scroll-reveal-delay-1">
            <div className="lg:sticky lg:top-32 space-y-5">
              <div className="rounded-2xl overflow-hidden aspect-[3/4] shadow-[0_8px_40px_rgba(163,65,58,0.15)] ring-1 ring-[#a3413a]/20">
                {featureImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.author} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#f3e6da] to-[#faf7f2]" />
                )}
              </div>
              <div className="rounded-xl p-5 border border-[#e8d5c0] bg-white shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-1">Editor</p>
                <p className="font-bold text-[#1c1410] text-lg">{data.author}</p>
                <p className="text-sm text-[#7a6e65]">Yorkshire BusinessWoman Magazine</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="scroll-reveal scroll-reveal-delay-2">
              <h2 className="text-feature-xl font-serif font-600 text-[#1c1410] mb-2">{renderTitleArt(data.title, 'font-serif italic text-[#a3413a]')}</h2>
            </div>

            {data.quote && (
              <div className="scroll-reveal scroll-reveal-delay-3 border-l-[3px] border-[#a3413a] pl-5 py-1">
                <p className="font-serif italic text-[clamp(1.2rem,2.5vw,1.65rem)] leading-[1.4] text-[#a3413a]">
                  &ldquo;{data.quote}&rdquo;
                </p>
              </div>
            )}

            {textBlocks.length > 0 && (
              <div className="scroll-reveal scroll-reveal-delay-4">
                <InterleavedTextWithMedia
                  blocks={textBlocks}
                  inlineMedia={inlineMedia}
                  pullQuotes={normalizePullQuotes(data.pullQuotes || data.quotes)}
                  imageVersion={imageVersion}
                  variant="light"
                  textClassName="font-serif text-[#3d2b1f]/80 leading-relaxed"
                />
              </div>
            )}

            {remainingMedia.length > 0 && (
              <div className="scroll-reveal scroll-reveal-delay-4 pt-2">
                <AdditionalMediaGallery items={remainingMedia} imageVersion={imageVersion} variant="light" />
              </div>
            )}

            {signature && (
              <div className="scroll-reveal pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-px bg-[#a3413a]" />
                  <p className="font-serif italic text-[#3d2b1f] font-medium text-lg">With warmth and ambition,</p>
                </div>
                <p className="font-bold text-[#a3413a] mt-3 text-lg">{signature}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// CONTENTS PAGE
// ─────────────────────────────────────────────
export const PageContents = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref, { threshold: 0.1 });

  const items = Array.isArray(data.items) ? data.items : [];
  const news = Array.isArray(data.news) ? data.news : [];
  const kicker = String(data.kicker || '').trim();
  const newsLabel = String(data.newsLabel || '').trim();
  const additionalMedia = getAdditionalMedia(data, String(data.title || 'Contents').trim());
  const [liveNews, setLiveNews] = useState<any[]>([]);
  const [liveNewsLoading, setLiveNewsLoading] = useState(false);
  const showLiveNews = news.length === 0;

  useEffect(() => {
    if (!showLiveNews) return;
    let cancelled = false;
    setLiveNewsLoading(true);
    fetch('/api/external-news?limit=6')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setLiveNews(Array.isArray(json?.data) ? json.data : []);
      })
      .catch(() => { if (cancelled) return; setLiveNews([]); })
      .finally(() => { if (cancelled) return; setLiveNewsLoading(false); });
    return () => { cancelled = true; };
  }, [showLiveNews]);

  return (
    <div ref={ref} className="bg-[#1a1210] py-16 lg:py-24 min-h-full text-white">
      <div className="h-0.5 w-full mb-0" style={{ background: 'linear-gradient(90deg, transparent, #a3413a 30%, #a3413a 70%, transparent)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
        <div className="scroll-reveal mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            {kicker && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] mb-2">{kicker}</p>}
            <h2 className="text-section-lg font-serif font-600 text-white">{renderTitleArt(data.title)}</h2>
          </div>
          <div className="flex items-center gap-5">
            {['Instagram','LinkedIn','X'].map((s) => (
              <span key={s} className="text-zinc-500 hover:text-[#a3413a] transition-colors text-xs font-medium cursor-pointer">{s}</span>
            ))}
          </div>
        </div>

        {data.text && (
          <div className="scroll-reveal -mt-6 mb-10 max-w-3xl">
            <SafeText html={data.text} className="font-serif text-white/70 leading-relaxed" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {items.map((item: any, i: number) => {
            const rawPage = item?.page;
            const pageNum = typeof rawPage === 'number' ? rawPage : Number.parseInt(String(rawPage ?? '').trim(), 10);
            const pageLabel = Number.isFinite(pageNum) ? String(pageNum).padStart(2, '0') : '';
            return (
              <div
                key={`${pageLabel}-${item?.title ?? i}`}
                className={`scroll-reveal scroll-reveal-delay-${Math.min(i + 1, 4)} group cursor-pointer rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.04] hover:bg-white/[0.07] hover:border-[#a3413a]/30 transition-all duration-300`}
              >
                <div className="p-5 flex flex-col h-full min-h-[130px] relative">
                  <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden">
                    <div className="absolute top-0 right-0 w-0 h-0"
                      style={{ borderLeft: '48px solid transparent', borderTop: '48px solid rgba(163,65,58,0.08)' }} />
                  </div>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a3413a]">{item?.category}</span>
                    <span className="text-3xl font-extrabold text-white/80 font-serif leading-none tabular-nums drop-shadow-sm group-hover:text-white transition-colors">{pageLabel}</span>
                  </div>
                  <p className="font-serif font-semibold text-white/90 text-base leading-snug flex-1">{item?.title}</p>
                  <div className="mt-3 h-0.5 w-8 rounded-full bg-[#a3413a] group-hover:w-14 transition-all duration-300" />
                </div>
              </div>
            );
          })}
        </div>

        {(news.length > 0 || showLiveNews) && (
          <div className="scroll-reveal rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-4">
              {showLiveNews ? 'Regional Women in Business News' : newsLabel || 'Regional News'}
            </p>
            {showLiveNews ? (
              <ul className="space-y-3">
                {liveNewsLoading && liveNews.length === 0 ? (
                  <li className="text-sm text-white/60">Loading…</li>
                ) : liveNews.length > 0 ? (
                  liveNews.map((item: any, i: number) => (
                    <li key={item?.id ?? item?.link ?? i} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="text-[#a3413a] mt-0.5 flex-shrink-0 text-[10px]">◆</span>
                      <a href={String(item?.link || '#')} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                        {String(item?.title || '').trim()}
                      </a>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-white/60">No news available right now.</li>
                )}
              </ul>
            ) : (
              <ul className="space-y-2.5">
                {news.map((item: any, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                    <span className="text-[#a3413a] mt-0.5 flex-shrink-0 text-[10px]">◆</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {additionalMedia.length > 0 && (
          <div className="scroll-reveal mt-10">
            <AdditionalMediaGallery items={additionalMedia} imageVersion={imageVersion} variant="dark" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// CONTINUATION PAGE (shared by FeatureLeft + FeatureRight)
// Used when a story spans multiple pages — shows body continuation only.
// ─────────────────────────────────────────────
function PageContinuation({ data }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const typography = getFeatureTypography(data.weight);
  const label = String(data.continuationLabel || data.title || '').trim();
  const kicker = String(data.kicker || '').trim();
  const author = String(data.name || data.author || '').trim();
  const allBlocks = getHtmlBlocks(String(data.text || ''));

  // Split into two equal columns for a classic magazine text-flow feel
  const mid = Math.ceil(allBlocks.length / 2);
  const leftBlocks = allBlocks.slice(0, mid);
  const rightBlocks = allBlocks.slice(mid);

  return (
    <div ref={ref} className="bg-[#faf7f2] min-h-full flex flex-col">
      {/* Continuation banner */}
      <div className="shrink-0 border-b border-[#a3413a]/15 bg-[#f4ede0] px-6 sm:px-10 lg:px-12 py-3.5 flex items-center gap-3">
        <span className="text-[#a3413a] text-sm" aria-hidden>↳</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#a3413a] truncate">
          {label}
        </span>
        {kicker && (
          <>
            <span className="text-[#a3413a]/30 text-xs">·</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#7a5c4e]">{kicker}</span>
          </>
        )}
        <div className="h-px flex-1 bg-gradient-to-r from-[#a3413a]/15 to-transparent" />
        {author && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#7a5c4e] shrink-0">{author}</span>
        )}
      </div>

      {/* Body text in two columns on desktop — classic magazine text flow */}
      <div className="flex-1 px-6 sm:px-10 lg:px-12 py-12 lg:py-16">
        {allBlocks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14 gap-y-0 items-start">
            <div className="scroll-reveal space-y-0">
              {leftBlocks.map((block, i) => (
                <SafeText
                  key={`lc-${i}`}
                  html={block}
                  className={`${typography.continuationBodyClassName} [&_p:first-child]:editorial-dropcap`}
                />
              ))}
            </div>
            {rightBlocks.length > 0 && (
              <div className="scroll-reveal scroll-reveal-delay-1 space-y-0">
                {rightBlocks.map((block, i) => (
                  <SafeText
                    key={`rc-${i}`}
                    html={block}
                    className={typography.continuationBodyClassName}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="font-serif text-[#7a6e65] italic">No additional content.</p>
        )}
      </div>

      {/* Bottom rule */}
      <div className="shrink-0 px-6 sm:px-10 lg:px-12 pb-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-[#a3413a]/30 to-transparent" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a3413a]">YBW</span>
      </div>
    </div>
  );
}

export const PageFeatureLeft = ({ data, imageVersion }: any) => {
  // Hooks must be called unconditionally (Rules of Hooks)
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  // Continuation pages get a clean two-column text layout
  if (data.isContinuation) return <PageContinuation data={data} imageVersion={imageVersion} />;

  const typography = getFeatureTypography(data.weight);
  const stats = Array.isArray(data.stats) ? data.stats : [];
  const kicker = String((data.kicker || data.category) ?? '').trim();
  const mediaLayout = String(data.mediaLayout || '').trim();
  const isFullBackground = mediaLayout === 'background';
  const featureImage = String(data.featureImage || data.image || '').trim();
  const backgroundMedia = featureImage;
  const additionalMedia = getAdditionalMedia(data, String(data.title || data.name || kicker || 'Feature').trim());
  const inlineMedia = additionalMedia.slice(0, 4);
  const remainingMedia = additionalMedia.slice(inlineMedia.length);
  const introHtml = String(data.intro || '').trim();
  const bodyHtml = String(data.text || data.textarea || data.body || '').trim();
  const textBlocks = [...getHtmlBlocks(introHtml), ...getHtmlBlocks(bodyHtml)];
  const pullQuotes = normalizePullQuotes(data.pullQuotes || data.quotes);
  const bodyBlocks = getHtmlBlocks(bodyHtml);

  if (isFullBackground) {
    return (
      <div ref={ref} className="relative min-h-full overflow-hidden bg-[#0c0a09]">
        {backgroundMedia ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fixMagazineImageUrl(backgroundMedia, imageVersion)} alt={data.title || data.name || kicker} className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        {data.videoUrl ? (
          <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={backgroundMedia ? fixMagazineImageUrl(backgroundMedia, imageVersion) : undefined} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/68 via-black/36 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-black/12 to-transparent" />
        <div className="relative z-10 py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl rounded-3xl border border-white/10 bg-black/55 backdrop-blur-md shadow-[0_24px_90px_rgba(0,0,0,0.55)] p-7 sm:p-10 space-y-6">
              {kicker && (
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-px flex-1 bg-gradient-to-r from-[#a3413a]/70 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] whitespace-normal break-words leading-tight max-w-[28rem] text-right">{kicker}</span>
                </div>
              )}
              {data.name && <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{data.name}</p>}
              {data.title && (
                <h2 className="font-serif font-bold leading-tight text-white" style={{ fontSize: typography.titleSize }}>
                  {renderTitleArt(data.title, 'font-serif italic text-[#a3413a]')}
                </h2>
              )}
              {data.quote && (
                <div className="pl-4 py-1 border-l-[3px] border-[#a3413a]">
                  <p className="font-serif italic leading-snug text-[#a3413a]" style={{ fontSize: typography.quoteSize }}>
                    &ldquo;{data.quote}&rdquo;
                  </p>
                </div>
              )}
              {textBlocks.length > 0 && (
                <InterleavedTextWithMedia blocks={textBlocks} inlineMedia={inlineMedia} pullQuotes={pullQuotes} imageVersion={imageVersion} variant="dark" textClassName={typography.bodyDarkClassName} />
              )}
              {remainingMedia.length > 0 && <div className="scroll-reveal scroll-reveal-delay-3"><AdditionalMediaGallery items={remainingMedia} imageVersion={imageVersion} variant="dark" /></div>}
              {stats.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {stats.slice(0, 3).map((stat: any, i: number) => (
                    <div key={`${stat?.label ?? 'stat'}-${i}`} className="rounded-2xl p-4 border border-white/10 bg-white/10 backdrop-blur-sm">
                      <p className="font-serif font-bold text-2xl text-[#a3413a]">{stat?.value}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60 mt-1">{stat?.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative flex flex-col lg:flex-row h-full min-h-full overflow-hidden" style={{ background: '#e8e0d5' }}>
      <div className="relative w-full lg:w-1/2 h-56 sm:h-72 lg:h-full flex-shrink-0 overflow-hidden">
        {featureImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.title || data.name || kicker} className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        {data.videoUrl ? (
          <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={featureImage ? fixMagazineImageUrl(featureImage, imageVersion) : undefined} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-y-0 right-0 w-16 hidden lg:block" style={{ background: 'linear-gradient(to right, transparent, #e8e0d5)' }} />
        <div className="absolute inset-x-0 bottom-0 h-16 lg:hidden" style={{ background: 'linear-gradient(to bottom, transparent, #e8e0d5)' }} />
      </div>

      <div className="relative flex flex-col justify-start flex-1 px-6 sm:px-10 lg:px-12 pt-10 pb-12 lg:pt-12 lg:pb-14 overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-1 lg:hidden" style={{ background: '#a3413a' }} />
        <div className="absolute top-0 left-0 bottom-0 w-1 hidden lg:block" style={{ background: 'linear-gradient(to bottom, transparent, #a3413a 20%, #a3413a 80%, transparent)' }} />

        <div className="scroll-reveal mb-4 flex items-center gap-3">
          <div className="w-6 h-px" style={{ background: '#a3413a' }} />
          {kicker && <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#a3413a' }}>{kicker}</span>}
        </div>
        {data.name && <p className="scroll-reveal text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#7a5c4e' }}>{data.name}</p>}
        {data.title && (
          <h2 className="scroll-reveal scroll-reveal-delay-1 font-serif font-bold leading-tight mb-5 text-[#1c1410]"
            style={{ fontSize: typography.splitTitleSize }}>
            {renderTitleArt(data.title, 'font-serif italic text-[#a3413a]')}
          </h2>
        )}
        {data.quote && (
          <div className="scroll-reveal scroll-reveal-delay-2 mb-5 pl-4 py-1 border-l-[3px]" style={{ borderColor: '#a3413a' }}>
            <p className="font-serif italic leading-snug" style={{ color: '#a3413a', fontSize: typography.quoteSize }}>
              &ldquo;{data.quote}&rdquo;
            </p>
          </div>
        )}
        {introHtml && (
          <div className="scroll-reveal scroll-reveal-delay-2 mb-4">
            <SafeText html={introHtml} className={typography.introClassName} />
          </div>
        )}
        {bodyBlocks.length > 0 && (
          <div className="scroll-reveal scroll-reveal-delay-3 mb-4">
            <InterleavedTextWithMedia blocks={bodyBlocks} inlineMedia={inlineMedia} pullQuotes={pullQuotes} imageVersion={imageVersion} variant="light" textClassName={typography.bodyLightClassName} />
          </div>
        )}
        {remainingMedia.length > 0 && (
          <div className="scroll-reveal scroll-reveal-delay-3 mb-6">
            <AdditionalMediaGallery items={remainingMedia} imageVersion={imageVersion} variant="light" />
          </div>
        )}
        {stats.length > 0 && (
          <div className="scroll-reveal scroll-reveal-delay-4 grid grid-cols-3 gap-2 mt-2 mb-4">
            {stats.slice(0, 3).map((stat: any, i: number) => (
              <div key={`${stat?.label ?? 'stat'}-${i}`} className="rounded-xl p-3 text-center border" style={{ background: 'rgba(255,255,255,0.55)', borderColor: 'rgba(163,65,58,0.18)' }}>
                <p className="font-serif font-bold text-xl" style={{ color: '#a3413a' }}>{stat?.value}</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: '#7a5c4e' }}>{stat?.label}</p>
              </div>
            ))}
          </div>
        )}
        <div className="scroll-reveal mt-8 pt-6 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, #a3413a, transparent)' }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#a3413a' }}>YBW</span>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// FEATURE RIGHT (text left, image right)
// ─────────────────────────────────────────────
export const PageFeatureRight = ({ data, imageVersion }: any) => {
  // Hooks must be called unconditionally (Rules of Hooks)
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  // Continuation pages get a clean two-column text layout
  if (data.isContinuation) return <PageContinuation data={data} imageVersion={imageVersion} />;

  const typography = getFeatureTypography(data.weight);
  const stats = Array.isArray(data.stats) ? data.stats : [];
  const kicker = String((data.kicker || data.category) ?? '').trim();
  const nameLabel = String(data.name || '').trim();
  const snapshotLabel = String(data.snapshotLabel || '').trim();
  const mediaLayout = String(data.mediaLayout || '').trim();
  const isFullBackground = mediaLayout === 'background';
  const featureImage = String(data.featureImage || data.image || '').trim();
  const backgroundMedia = featureImage;
  const additionalMedia = getAdditionalMedia(data, String(data.title || data.name || kicker || 'Feature').trim());
  const inlineMedia = additionalMedia.slice(0, 4);
  const remainingMedia = additionalMedia.slice(inlineMedia.length);
  const pullQuotes = normalizePullQuotes(data.pullQuotes || data.quotes);
  const textBlocks = getHtmlBlocks(String(data.text || ''));

  if (isFullBackground) {
    return (
      <div ref={ref} className="relative min-h-full overflow-hidden bg-[#0c0a09]">
        {backgroundMedia ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fixMagazineImageUrl(backgroundMedia, imageVersion)} alt={data.title || data.name || 'Feature'} className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        {data.videoUrl ? (
          <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={backgroundMedia ? fixMagazineImageUrl(backgroundMedia, imageVersion) : undefined} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/68 via-black/36 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-black/12 to-transparent" />
        <div className="relative z-10 py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {kicker && (
              <div className="scroll-reveal mb-10">
                <div className="flex items-center gap-4 w-full min-w-0">
                  <div className="h-px flex-1 bg-gradient-to-r from-[#a3413a]/60 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] whitespace-normal break-words leading-tight max-w-[28rem] text-right">{kicker}</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
              <div className="lg:col-span-7 scroll-reveal">
                <div className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-md shadow-[0_24px_90px_rgba(0,0,0,0.55)] p-7 sm:p-10 space-y-6">
                  {nameLabel && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a]">{nameLabel}</p>}
                  {data.title && <h2 className="text-section-lg font-serif font-600 text-white" style={{ fontSize: typography.titleSize }}>{renderTitleArt(data.title, 'font-serif italic text-[#a3413a]')}</h2>}
                  {data.quote && (
                    <div className="border-l-[3px] border-[#a3413a] pl-5 py-1">
                      <p className="font-serif italic leading-[1.45] text-[#a3413a]" style={{ fontSize: typography.quoteSize }}>&ldquo;{data.quote}&rdquo;</p>
                    </div>
                  )}
                  {textBlocks.length > 0 && <InterleavedTextWithMedia blocks={textBlocks} inlineMedia={inlineMedia} pullQuotes={pullQuotes} imageVersion={imageVersion} variant="dark" textClassName={typography.bodyDarkClassName} />}
                  {remainingMedia.length > 0 && <div className="scroll-reveal scroll-reveal-delay-2"><AdditionalMediaGallery items={remainingMedia} imageVersion={imageVersion} variant="dark" /></div>}
                </div>
              </div>
              {stats.length > 0 && (
                <div className="lg:col-span-5 scroll-reveal scroll-reveal-delay-2">
                  <div className="rounded-3xl border border-white/10 bg-black/45 backdrop-blur-md shadow-[0_24px_90px_rgba(0,0,0,0.4)] p-7 sm:p-9">
                    {snapshotLabel && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-4">{snapshotLabel}</p>}
                    <div className="space-y-3">
                      {stats.map((stat: any, i: number) => (
                        <div key={`${stat?.label ?? 'stat'}-${i}`} className="rounded-2xl border border-white/10 bg-white/10 p-5 flex items-start gap-4">
                          <span className="font-serif font-bold text-[#a3413a] text-2xl shrink-0 w-16 text-center">{stat?.value}</span>
                          <p className="text-sm text-white/75 leading-relaxed">{stat?.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="bg-[#f5f0e8] py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal mb-10">
          <div className="flex items-center gap-4 w-full min-w-0">
            <div className="h-px flex-1 bg-gradient-to-r from-[#a3413a]/60 to-transparent" />
            {kicker && <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] whitespace-normal break-words leading-tight max-w-[28rem] text-right">{kicker}</span>}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-6 space-y-6 scroll-reveal">
            {nameLabel && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-2">{nameLabel}</p>}
            {data.title && <h2 className="text-section-lg font-serif font-600 text-[#1c1410]" style={{ fontSize: typography.titleSize }}>{renderTitleArt(data.title, 'font-serif italic text-[#a3413a]')}</h2>}
            {data.quote && (
              <div className="border-l-[3px] border-[#a3413a] pl-5 py-1">
                <p className="font-serif italic leading-[1.45] text-[#a3413a]" style={{ fontSize: typography.quoteSize }}>&ldquo;{data.quote}&rdquo;</p>
              </div>
            )}
            {textBlocks.length > 0 && <InterleavedTextWithMedia blocks={textBlocks} inlineMedia={inlineMedia} pullQuotes={pullQuotes} imageVersion={imageVersion} variant="light" textClassName={typography.bodyLightClassName} />}
            {remainingMedia.length > 0 && <div className="scroll-reveal scroll-reveal-delay-2"><AdditionalMediaGallery items={remainingMedia} imageVersion={imageVersion} variant="light" /></div>}
          </div>
          <div className="lg:col-span-6 scroll-reveal scroll-reveal-delay-2 space-y-4">
            {(data.videoUrl || featureImage) && (
              <div className="rounded-2xl overflow-hidden aspect-[4/3] shadow-[0_12px_50px_rgba(163,65,58,0.12)] ring-1 ring-[#a3413a]/15 relative">
                {data.videoUrl ? (
                  <>
                    {featureImage && <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.title || data.name || 'Feature'} className="absolute inset-0 w-full h-full object-cover" />}
                    <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={featureImage ? fixMagazineImageUrl(featureImage, imageVersion) : undefined} autoPlay muted loop playsInline className="relative w-full h-full object-cover" />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.title || data.name || 'Feature'} className="w-full h-full object-cover" />
                )}
              </div>
            )}
            {stats.length > 0 && (
              <div className="rounded-2xl border border-[#e8d5c0] bg-white shadow-sm p-6">
                {snapshotLabel && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-3">{snapshotLabel}</p>}
                <div className="space-y-2.5">
                  {stats.map((stat: any, i: number) => (
                    <div key={`${stat?.label ?? 'stat'}-${i}`} className="rounded-xl border border-[#f0e8da] bg-[#faf7f2] p-4 flex items-start gap-4">
                      <span className="font-serif font-bold text-[#a3413a] text-2xl shrink-0 w-16 text-center">{stat?.value}</span>
                      <p className="text-sm text-[#3d2b1f]/75 leading-relaxed">{stat?.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SPOTLIGHT PAGE (Interview / Member Feature)
// ─────────────────────────────────────────────
export const PageSpotlight = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const sectionLabel = String(data.title || '').trim();
  const mediaLayout = String(data.mediaLayout || '').trim();
  const isFullBackground = mediaLayout === 'background';
  const additionalMedia = getAdditionalMedia(data, String(data.name || sectionLabel || 'Spotlight').trim());
  const featureImage = String(data.featureImage || data.image || '').trim();
  const backgroundMedia = featureImage;

  if (isFullBackground) {
    return (
      <div ref={ref} className="relative min-h-full overflow-hidden bg-[#0e0b09]">
        {backgroundMedia && <img src={fixMagazineImageUrl(backgroundMedia, imageVersion)} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />}
        {data.videoUrl && <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={backgroundMedia ? fixMagazineImageUrl(backgroundMedia, imageVersion) : undefined} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/68 via-black/36 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/56 via-black/16 to-transparent" />
        <div className="relative z-10 py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-md shadow-[0_24px_90px_rgba(0,0,0,0.55)] p-7 sm:p-10">
              <div className="mb-8">
                <div className="flex items-center gap-2">
                  <div className="h-px w-6 bg-[#a3413a]" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#a3413a]">{sectionLabel || 'Member Spotlight'}</span>
                </div>
              </div>
              {data.name && <h2 className="font-serif text-white font-bold leading-tight tracking-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}>{renderTitleArt(data.name, 'font-serif italic text-[#a3413a]')}</h2>}
              {data.role && <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a3413a]">{data.role}</p>}
              {data.message && (
                <div className="mt-8">
                  <div className="font-serif text-[#a3413a] leading-none select-none mb-2" style={{ fontSize: 'clamp(4rem, 8vw, 7rem)', lineHeight: 1, opacity: 0.35 }} aria-hidden="true">&ldquo;</div>
                  <div style={{ fontSize: 'clamp(1.15rem, 2.4vw, 1.65rem)' }}>
                    <SafeText html={data.message} className="font-serif italic text-white leading-[1.35] [&_p]:m-0 [&_p+p]:mt-3" />
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-px w-10 bg-[#a3413a]" />
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                </div>
              )}
              {data.bio && <div className="mt-8"><SafeText html={data.bio} className="font-serif text-white/75 leading-relaxed text-sm [&_p]:mb-4 [&_p:last-child]:mb-0" /></div>}
              {additionalMedia.length > 0 && <div className="mt-10 scroll-reveal"><AdditionalMediaGallery items={additionalMedia} imageVersion={imageVersion} variant="dark" /></div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative min-h-full overflow-hidden bg-[#0e0b09]">
      <div className="grid grid-cols-1 lg:grid-cols-[42%_58%] min-h-full">
        <div className="relative overflow-hidden min-h-[50vh] lg:min-h-full">
          {featureImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.name} className="absolute inset-0 w-full h-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a0d14] to-[#0e0b09]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0e0b09]/60 hidden lg:block" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0b09]/70 via-transparent to-transparent" />
          <div className="absolute top-6 left-6 z-20 scroll-reveal">
            <div className="flex items-center gap-2">
              <div className="h-px w-6 bg-[#a3413a]" />
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#a3413a]">{sectionLabel || 'The Big Interview'}</span>
            </div>
          </div>
        </div>
        <div className="relative flex flex-col justify-center px-8 py-12 lg:px-12 lg:py-16 xl:px-16 bg-[#0e0b09] overflow-y-auto">
          <div className="pointer-events-none absolute top-0 right-0 w-72 h-72 rounded-full opacity-10" style={{ background: 'radial-gradient(ellipse, #a3413a 0%, transparent 70%)', filter: 'blur(80px)' }} />
          {data.name && (
            <div className="sticky top-0 z-20 -mx-8 lg:-mx-12 xl:-mx-16 px-8 lg:px-12 xl:px-16 py-5 bg-[#0e0b09]/85 backdrop-blur-md border-b border-white/[0.06]">
              {sectionLabel && <div className="flex items-center gap-2"><div className="h-px w-6 bg-[#a3413a]" /><span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#a3413a]">{sectionLabel}</span></div>}
              <h2 className="mt-3 font-serif text-white font-bold leading-tight tracking-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}>{renderTitleArt(data.name, 'font-serif italic text-[#a3413a]')}</h2>
              {data.role && <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a3413a]">{data.role}</p>}
            </div>
          )}
          {data.message && (
            <div className="scroll-reveal mb-8 lg:mb-10">
              <div className="font-serif text-[#a3413a] leading-none select-none mb-2" style={{ fontSize: 'clamp(4rem, 8vw, 7rem)', lineHeight: 1, opacity: 0.35 }} aria-hidden="true">&ldquo;</div>
              <div style={{ fontSize: 'clamp(1.15rem, 2.4vw, 1.65rem)' }}>
                <SafeText html={data.message} className="font-serif italic text-white leading-[1.35] [&_p]:m-0 [&_p+p]:mt-3" />
              </div>
              <div className="mt-6 flex items-center gap-3"><div className="h-px w-10 bg-[#a3413a]" /><div className="h-px flex-1 bg-white/[0.06]" /></div>
            </div>
          )}
          {data.bio && <div className="scroll-reveal scroll-reveal-delay-2"><SafeText html={data.bio} className="font-serif text-white/75 leading-relaxed text-sm [&_p]:mb-4 [&_p:last-child]:mb-0" /></div>}
          {additionalMedia.length > 0 && <div className="mt-8 scroll-reveal scroll-reveal-delay-2"><AdditionalMediaGallery items={additionalMedia} imageVersion={imageVersion} variant="dark" /></div>}
          {Array.isArray(data.tags) && data.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2 scroll-reveal scroll-reveal-delay-2">
              {data.tags.slice(0, 5).map((tag: string, i: number) => (
                <span key={i} className="text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-[#a3413a]/30 text-[#a3413a]/80">{tag}</span>
              ))}
            </div>
          )}
          <div className="mt-auto pt-12 flex items-center justify-between scroll-reveal">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="ml-4 text-[9px] font-mono text-white/20 uppercase tracking-widest">Member Spotlight</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// PARTNER PAGE
// ─────────────────────────────────────────────
export const PagePartner = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);
  const kicker = String(data.kicker || '').trim();
  const mediaLayout = String(data.mediaLayout || '').trim();
  const isFullBackground = mediaLayout === 'background';
  const additionalMedia = getAdditionalMedia(data, String(data.brand || data.title || 'Partner').trim());
  const featureImage = String(data.featureImage || data.image || '').trim();
  const backgroundMedia = featureImage;

  if (isFullBackground) {
    return (
      <div ref={ref} className="relative min-h-full overflow-hidden text-white bg-[#0f0a0d]">
        {backgroundMedia && <img src={fixMagazineImageUrl(backgroundMedia, imageVersion)} alt={data.brand || data.title || 'Partner'} className="absolute inset-0 w-full h-full object-cover" />}
        {data.videoUrl && <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={backgroundMedia ? fixMagazineImageUrl(backgroundMedia, imageVersion) : undefined} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/68 via-black/36 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/56 via-black/16 to-transparent" />
        <div className="relative z-10 py-16 lg:py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-md shadow-[0_24px_90px_rgba(0,0,0,0.55)] p-7 sm:p-10 space-y-6">
              {kicker && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a]">{kicker}</p>}
              <div>
                <h2 className="text-section-lg font-serif font-600 text-white">{renderTitleArt(data.title || data.brand)}</h2>
                {data.headline && <p className="text-white/70 font-medium mt-1 text-lg">{data.headline}</p>}
              </div>
              {data.text ? <SafeText html={data.text} className="font-serif text-white/85 leading-relaxed" /> : data.offer && <p className="font-serif text-white/85 leading-relaxed">{data.offer}</p>}
              {data.offer && <div className="flex items-center gap-3"><div className="w-10 h-px bg-[#a3413a]" /><p className="text-white/70 text-sm font-medium">{data.offer}</p></div>}
              {additionalMedia.length > 0 && <div className="scroll-reveal"><AdditionalMediaGallery items={additionalMedia} imageVersion={imageVersion} variant="dark" /></div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative py-16 lg:py-24 min-h-full overflow-hidden text-white"
      style={{ background: 'linear-gradient(135deg, #0f0a0d 0%, #1a0d14 40%, #0f0a0d 100%)' }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(ellipse, #a3413a 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(ellipse, #a3413a 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>
      <div className="grain-overlay absolute inset-0 z-0" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="space-y-6 scroll-reveal">
            {kicker && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] mb-2">{kicker}</p>}
            <h2 className="text-section-lg font-serif font-600 text-white">{renderTitleArt(data.title || data.brand)}</h2>
            {data.headline && <p className="text-white/65 font-medium mt-1 text-lg">{data.headline}</p>}
            {data.text ? <SafeText html={data.text} className="font-serif text-white/80 leading-relaxed" /> : data.offer && <p className="font-serif text-white/80 leading-relaxed">{data.offer}</p>}
            {data.offer && <div className="flex items-center gap-3"><div className="w-10 h-px bg-[#a3413a]" /><p className="text-white/80 text-sm font-medium">{data.offer}</p></div>}
            {additionalMedia.length > 0 && <div className="scroll-reveal scroll-reveal-delay-2"><AdditionalMediaGallery items={additionalMedia} imageVersion={imageVersion} variant="dark" /></div>}
          </div>
          {(data.videoUrl || featureImage) && (
            <div className="scroll-reveal scroll-reveal-delay-2">
              <div className="rounded-2xl overflow-hidden aspect-[3/4] shadow-[0_20px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 relative">
                {data.videoUrl ? (
                  <>
                    {featureImage && <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.brand} className="absolute inset-0 w-full h-full object-cover" />}
                    <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={featureImage ? fixMagazineImageUrl(featureImage, imageVersion) : undefined} autoPlay muted loop playsInline className="relative w-full h-full object-cover" />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.brand} className="w-full h-full object-cover" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// BACK COVER
// ─────────────────────────────────────────────
export const PageBackCover = ({ data, imageVersion }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);

  const socials = Array.isArray(data.socials) ? data.socials : [];
  const kicker = String(data.kicker || '').trim();
  const comingSoonLabel = String(data.comingSoonLabel || '').trim();
  const mediaLayout = String(data.mediaLayout || '').trim();
  const isFullBackground = mediaLayout === 'background';
  const additionalMedia = getAdditionalMedia(data, String(data.title || data.nextIssue || kicker || 'Back Cover').trim());
  const featureImage = String(data.featureImage || data.image || '').trim();
  const backgroundMedia = featureImage;

  if (isFullBackground) {
    return (
      <div ref={ref} className="relative min-h-full overflow-hidden bg-[#0c0a09]">
        {backgroundMedia && <img src={fixMagazineImageUrl(backgroundMedia, imageVersion)} alt={data.title || data.nextIssue || kicker} className="absolute inset-0 w-full h-full object-cover" />}
        {data.videoUrl && <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={backgroundMedia ? fixMagazineImageUrl(backgroundMedia, imageVersion) : undefined} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/68 via-black/36 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/56 via-black/16 to-transparent" />
        <div className="relative z-10 py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-md shadow-[0_24px_90px_rgba(0,0,0,0.55)] p-7 sm:p-10 space-y-6">
              {kicker && <div className="flex items-center gap-4 w-full min-w-0"><div className="h-px flex-1 bg-gradient-to-r from-[#a3413a]/60 to-transparent" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] whitespace-normal break-words leading-tight max-w-[28rem] text-right">{kicker}</span></div>}
              <div>
                {comingSoonLabel && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-2">{comingSoonLabel}</p>}
                <h2 className="text-section-lg font-serif font-600 text-white">{renderTitleArt(data.title, 'font-serif italic text-[#a3413a]')}</h2>
                {data.nextIssue && <p className="text-white/70 font-medium mt-1 text-lg">{data.nextIssue}</p>}
              </div>
              {data.text && <SafeText html={data.text} className="font-serif text-white/80 leading-relaxed" />}
              {additionalMedia.length > 0 && <div className="scroll-reveal"><AdditionalMediaGallery items={additionalMedia} imageVersion={imageVersion} variant="dark" /></div>}
              <div className="flex items-center gap-3 flex-wrap">
                <Link href="/membership" className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-full text-white hover:opacity-90 transition-opacity" style={{ background: 'linear-gradient(135deg, #a3413a 0%, #a3413a 100%)' }}>
                  {data.cta || 'Join the Community'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {socials.length > 0 && <div className="flex items-center gap-2">{socials.slice(0, 6).map((label: any, i: number) => <span key={`${label}-${i}`} className="text-white/70 text-sm font-medium">{label}</span>)}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="bg-[#faf7f2] py-16 lg:py-24 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal mb-10">
          <div className="flex items-center gap-4 w-full min-w-0">
            <div className="h-px flex-1 bg-gradient-to-r from-[#a3413a]/60 to-transparent" />
            {kicker && <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] whitespace-normal break-words leading-tight max-w-[28rem] text-right">{kicker}</span>}
          </div>
        </div>
        <div className="scroll-reveal rounded-3xl overflow-hidden border border-[#e8d5c0] shadow-[0_16px_60px_rgba(163,65,58,0.1)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <div className="p-10 lg:p-14 flex flex-col justify-center space-y-5 bg-white">
              {comingSoonLabel && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-2">{comingSoonLabel}</p>}
              <h2 className="text-section-lg font-serif font-600 text-[#1c1410]">{renderTitleArt(data.title, 'font-serif italic text-[#a3413a]')}</h2>
              {data.nextIssue && <p className="text-[#7a6e65] font-medium mt-1 text-lg">{data.nextIssue}</p>}
              {data.text && <SafeText html={data.text} className="font-serif text-[#3d2b1f]/70 leading-relaxed" />}
              {additionalMedia.length > 0 && <div className="scroll-reveal scroll-reveal-delay-2"><AdditionalMediaGallery items={additionalMedia} imageVersion={imageVersion} variant="light" /></div>}
              <div className="flex items-center gap-3 flex-wrap">
                <Link href="/membership" className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-full text-white hover:opacity-90 transition-opacity" style={{ background: 'linear-gradient(135deg, #a3413a 0%, #a3413a 100%)' }}>
                  {data.cta || 'Join the Community'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {socials.length > 0 && <div className="flex items-center gap-2">{socials.slice(0, 6).map((label: any, i: number) => <span key={`${label}-${i}`} className="text-[#7a6e65] text-sm font-medium">{label}</span>)}</div>}
              </div>
            </div>
            {(data.videoUrl || featureImage) && (
              <div className="overflow-hidden aspect-[4/3] lg:aspect-auto relative">
                {data.videoUrl ? (
                  <>
                    {featureImage && <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.title || data.nextIssue || kicker} className="absolute inset-0 w-full h-full object-cover" />}
                    <video src={fixMagazineImageUrl(data.videoUrl, imageVersion)} poster={featureImage ? fixMagazineImageUrl(featureImage, imageVersion) : undefined} autoPlay muted loop playsInline className="relative w-full h-full object-cover" />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fixMagazineImageUrl(featureImage, imageVersion)} alt={data.title || data.nextIssue || kicker} className="w-full h-full object-cover" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
