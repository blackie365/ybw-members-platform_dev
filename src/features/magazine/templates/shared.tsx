"use client";

/**
 * shared.tsx — Gen 1 magazine page renderers, lifted from MagazineReader.tsx.
 * These components are the visual gold standard for the digital edition.
 * They accept a flexible `data: any` object (produced by each template's
 * buildViewModel()) and an optional `imageVersion` cache-buster string.
 *
 * All page components are exported so template renderers can import them.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import {
  fixMagazineImageUrl,
  isPlaceholderImageUrl,
  filterNonPlaceholderUrls,
} from "@/lib/magazine-utils";
import { sanitizeHtml } from "@/lib/utils";
import {
  getHtmlBlocks,
  splitPlainTextIntoParagraphs,
  dedupeTextBlocks,
  normalizeRichTextForCompare,
} from "./editorialBlocks";
import type { StorySummary } from "../domain/template-registry";
import type { BroadsheetSocialPost, BroadsheetSocialPlatform } from "../domain/types";

// ─────────────────────────────────────────────
// MASTHEAD LOCKUP
// ─────────────────────────────────────────────

/**
 * The brand wordmark used as the reader masthead. Rendered as a single
 * responsive image (trimmed to its content box, 1863×296 ≈ 6.3:1) so it fits
 * the nameplate band on every reader page without distorting.
 */
export const MagazineMastheadLogo = ({
  alt = "Yorkshire BusinessWoman",
  className = "",
}: {
  alt?: string;
  className?: string;
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/images/logo-masthead.png"
    alt={alt}
    className={`mx-auto h-auto w-full max-w-[560px] select-none ${className}`}
  />
);

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type AdditionalMediaItem = {
  src: string;
  alt: string;
  caption?: string;
  layout?: "inline" | "wide" | "full" | "mosaic";
  ratio?: string;
};

function safeImageSrc(raw: unknown): string {
  const src = String(raw || "").trim();
  if (!src) return "";
  if (isPlaceholderImageUrl(src)) return "";
  return src;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

export function SafeText({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  if (!html) return null;

  let content = html;
  if (!html.includes("<")) {
    const paragraphs = splitPlainTextIntoParagraphs(html);
    content = dedupeTextBlocks(
      paragraphs.map((paragraph) => `<p>${paragraph}</p>`),
    ).join("");
  } else if (!html.includes("<p") && !html.includes("<br")) {
    const blocks = getHtmlBlocks(html);
    if (blocks.length > 0) {
      content = blocks.join("");
    } else {
      content = html.replace(/\n/g, "<br />");
    }
  } else {
    const blocks = getHtmlBlocks(html);
    if (blocks.length > 0) {
      content = blocks.join("");
    }
  }

  const sanitized = sanitizeHtml(content, { allowStyles: true });

  return (
    <div
      lang="en-GB"
      className={[
        "[&_p]:mb-5 [&_p+_p]:mt-5 [&_p:last-child]:mb-0 [&_p]:[text-wrap:pretty] [&_p]:[orphans:2] [&_p]:[widows:2] [&_strong]:font-semibold [&_em]:italic [&_a]:underline [&_a]:underline-offset-2 [&_h2]:[text-wrap:balance] [&_h3]:[text-wrap:balance] [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl [&_img]:my-5 [&_img]:shadow-[0_14px_60px_rgba(0,0,0,0.12)] [&_figure]:my-6 [&_figcaption]:mt-2 [&_figcaption]:text-xs [&_figcaption]:leading-snug [&_figcaption]:opacity-70 [&_blockquote]:my-8 [&_blockquote]:px-6 [&_blockquote]:py-5 [&_blockquote]:rounded-3xl [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#a3413a] [&_blockquote]:bg-[#a3413a]/10 [&_blockquote]:font-serif [&_blockquote]:italic [&_blockquote]:text-[1.05em] [&_blockquote_p]:mb-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

function normalizeAdditionalMedia(
  input: any,
  fallbackAlt: string,
): AdditionalMediaItem[] {
  if (!input) return [];

  const looksLikeUrl = (value: string) => {
    const v = value.trim();
    if (!v) return false;
    return (
      v.startsWith("https://") ||
      v.startsWith("http://") ||
      v.startsWith("/") ||
      v.startsWith("./") ||
      v.startsWith("../") ||
      v.startsWith("data:")
    );
  };

  const raw: any[] = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? (() => {
          const trimmed = input.trim();
          if (!trimmed) return [];

          if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed;
              if (parsed && typeof parsed === "object") return [parsed];
            } catch {}
          }

          if (trimmed.includes("\n")) {
            return trimmed
              .split(/\r?\n+/g)
              .map((s) => s.trim())
              .filter(Boolean);
          }

          const commaSpaceParts = trimmed
            .split(/,\s+/g)
            .map((s) => s.trim())
            .filter(Boolean);
          if (
            commaSpaceParts.length > 1 &&
            commaSpaceParts.every(looksLikeUrl)
          ) {
            return commaSpaceParts;
          }

          const semicolonSpaceParts = trimmed
            .split(/;\s+/g)
            .map((s) => s.trim())
            .filter(Boolean);
          if (
            semicolonSpaceParts.length > 1 &&
            semicolonSpaceParts.every(looksLikeUrl)
          ) {
            return semicolonSpaceParts;
          }

          const httpCount = (trimmed.match(/https?:\/\//g) || []).length;
          if (httpCount >= 2) {
            return trimmed
              .split(/[,;]\s*(?=https?:\/\/)/g)
              .map((s) => s.trim())
              .filter(Boolean);
          }

          return [trimmed];
        })()
      : [];

  const items: AdditionalMediaItem[] = [];

  for (const entry of raw) {
    if (!entry) continue;
    if (typeof entry === "string") {
      const src = entry.trim();
      if (!src) continue;
      if (isPlaceholderImageUrl(src)) continue;
      items.push({ src, alt: fallbackAlt || "Image" });
      continue;
    }

    if (typeof entry === "object") {
      const src = String(
        (entry as any).src || (entry as any).url || (entry as any).image || "",
      ).trim();
      if (!src) continue;
      if (isPlaceholderImageUrl(src)) continue;
      const alt = String(
        (entry as any).alt || (entry as any).title || fallbackAlt || "Image",
      ).trim();
      const caption =
        String((entry as any).caption || (entry as any).credit || "").trim() ||
        undefined;
      const layout = String((entry as any).layout || "").trim();
      const ratio = String(
        (entry as any).ratio || (entry as any).aspect || "",
      ).trim();
      items.push({
        src,
        alt,
        caption,
        layout:
          layout === "inline" ||
          layout === "wide" ||
          layout === "full" ||
          layout === "mosaic"
            ? layout
            : undefined,
        ratio: ratio || undefined,
      });
    }
  }

  return items;
}

function getAdditionalMedia(
  data: any,
  fallbackAlt: string,
): AdditionalMediaItem[] {
  const main = safeImageSrc(data?.featureImage || data?.image || "");
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
    let v = String(value || "").trim();
    if (!v) return "";
    v = v.replace(/&ldquo;|&rdquo;|&quot;/g, '"').trim();
    v = v
      .replace(/^["'""]+/, "")
      .replace(/["'""]+$/, "")
      .trim();
    v = v
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return v;
  };

  const raw: any[] = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? (() => {
          const trimmed = input.trim();
          if (!trimmed) return [];
          if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed;
              if (parsed && typeof parsed === "object") return [parsed];
            } catch {}
          }
          if (trimmed.includes("\n")) {
            return trimmed
              .split(/\r?\n+/g)
              .map((s) => s.trim())
              .filter(Boolean);
          }
          return [trimmed];
        })()
      : [input];

  const out: string[] = [];
  for (const entry of raw) {
    if (!entry) continue;
    if (typeof entry === "string") {
      const text = clean(entry);
      if (text) out.push(text);
      continue;
    }
    if (typeof entry === "object") {
      const text = clean(
        (entry as any).text ||
          (entry as any).quote ||
          (entry as any).value ||
          "",
      );
      if (text) out.push(text);
    }
  }

  return out.slice(0, 4);
}

const PLATFORM_LABEL: Record<BroadsheetSocialPlatform, string> = {
  twitter: "X / Twitter",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function SocialInitialsMark({ accountName }: { accountName: string }) {
  const cleaned = accountName.trim() || "Y";
  const words = cleaned.split(/\s+/).filter(Boolean);
  const first = (words[0]?.[0] ?? "Y").toUpperCase();
  const second = words.length > 1 ? (words[1]?.[0] ?? "").toUpperCase() : "";
  const mark = second ? `${first}${second}` : first;
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#191412]/40 bg-[#fdfdfb]"
      aria-hidden="true"
    >
      <span className="font-serif text-[1.35rem] font-bold leading-none text-[#191412]">
        {mark}
      </span>
    </div>
  );
}

export function BroadsheetSocialPostCard({
  post,
  slot = "grid",
  imageVersion = "",
}: {
  post: BroadsheetSocialPost;
  slot?: "rail" | "grid";
  imageVersion?: string;
}) {
  const isRail = slot === "rail";
  const safeImg = safeImageSrc(post.imageUrl);
  const bodyHtml = sanitizeHtml(splitPlainTextIntoParagraphs(post.body || "").join("\n"));

  return (
    <article
      className={[
        "relative flex flex-col",
        isRail ? "" : "h-full",
      ].join(" ")}
    >
      {isRail && (
        <div
          className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-[#a3413a]"
          aria-hidden="true"
        />
      )}
      <div className={isRail ? "pl-4" : ""}>
        <header className="mb-3 flex items-start gap-3">
          <SocialInitialsMark accountName={post.accountName || post.handle || "Y"} />
          <div className="min-w-0 flex-1">
            <span className="block font-sans text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#a3413a]">
              {PLATFORM_LABEL[post.platform] || "Social"}
            </span>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="truncate font-serif text-[0.98rem] font-bold leading-tight text-[#191412]">
                {post.accountName || post.handle || ""}
              </p>
              {post.handle ? (
                <span className="font-sans text-[0.72rem] text-[#191412]/50">
                  @{post.handle.replace(/^@/, "")}
                </span>
              ) : null}
            </div>
            {post.date ? (
              <p className="mt-0.5 font-sans text-[0.65rem] uppercase tracking-[0.16em] text-[#191412]/45">
                {post.date}
              </p>
            ) : null}
          </div>
        </header>

        {safeImg ? (
          <figure className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fixMagazineImageUrl(safeImg, imageVersion)}
              alt={post.caption || post.accountName || "Social post image"}
              className="w-full object-cover"
            />
            {post.caption ? (
              <figcaption className="mt-1.5 border-b border-[#191412]/30 pb-1.5 font-sans text-[0.68rem] leading-snug italic text-[#191412]/60">
                {post.caption}
              </figcaption>
            ) : (
              <div className="mt-1.5 h-px w-full bg-[#191412]/25" />
            )}
          </figure>
        ) : null}

        <SafeText
          html={bodyHtml}
          className="magazine-body font-serif text-[0.95rem] leading-[1.52] text-[#191412]/85 [&_p]:[text-align:left]"
        />

        <footer className="mt-4 flex items-center justify-between border-t border-[#191412]/25 pt-3">
          <span
            className="font-serif text-[1.05rem] leading-none text-[#191412]/60"
            aria-hidden="true"
          >
            ◆
          </span>
          {post.postUrl ? (
            <a
              href={fixMagazineImageUrl(post.postUrl, imageVersion)}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-[#191412]/75 transition-colors hover:text-[#a3413a]"
            >
              Read the post
              <ExternalLink className="h-3 w-3 stroke-[2]" aria-hidden="true" />
            </a>
          ) : (
            <span className="font-sans text-[0.62rem] uppercase tracking-[0.26em] text-[#191412]/40">
              Post
            </span>
          )}
        </footer>
      </div>
    </article>
  );
}

function getMosaicClassName(index: number, count: number) {
  if (count <= 1) return "col-span-12 aspect-[16/9]";
  if (count === 2) return "col-span-12 md:col-span-6 aspect-[4/3]";
  if (count === 3) {
    if (index === 0) return "col-span-12 md:col-span-7 aspect-[16/10]";
    return "col-span-6 md:col-span-5 aspect-[4/3]";
  }
  if (count === 4) {
    if (index === 0) return "col-span-12 md:col-span-8 aspect-[16/9]";
    if (index === 1) return "col-span-6 md:col-span-4 aspect-[4/5]";
    return "col-span-6 md:col-span-4 aspect-[4/3]";
  }
  if (index === 0) return "col-span-12 md:col-span-6 aspect-[16/10]";
  if (index === 1) return "col-span-6 md:col-span-3 aspect-[4/5]";
  if (index === 2) return "col-span-6 md:col-span-3 aspect-[4/5]";
  return "col-span-6 md:col-span-4 aspect-[4/3]";
}

function AdditionalMediaGallery({
  items,
  imageVersion,
  variant = "light",
}: {
  items: AdditionalMediaItem[];
  imageVersion: string;
  variant?: "light" | "dark";
}) {
  const safeItems = Array.isArray(items)
    ? items.filter(Boolean).slice(0, 10)
    : [];
  if (safeItems.length === 0) return null;

  const cardClassName =
    variant === "dark"
      ? "border border-white/10 bg-white/5"
      : "border border-[#e8d5c0] bg-white";
  const captionClassName =
    variant === "dark" ? "text-white/70" : "text-[#7a6e65]";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-3">
        {safeItems.map((item, i) => (
          <div
            key={`${item.src}-${i}`}
            className={[
              "relative overflow-hidden rounded-2xl shadow-[0_14px_60px_rgba(0,0,0,0.10)]",
              cardClassName,
              getMosaicClassName(i, safeItems.length),
            ].join(" ")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fixMagazineImageUrl(item.src, imageVersion)}
              alt={item.alt}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-700 ease-out hover:scale-[1.04]"
              loading="lazy"
            />
            {item.caption ? (
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div
                  className={
                    variant === "dark"
                      ? "rounded-xl bg-black/45 backdrop-blur-sm border border-white/10 px-3 py-2"
                      : "rounded-xl bg-white/80 backdrop-blur-sm border border-[#e8d5c0] px-3 py-2"
                  }
                >
                  <p
                    className={[
                      "text-[11px] leading-snug",
                      captionClassName,
                    ].join(" ")}
                  >
                    {item.caption}
                  </p>
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

export function renderTitleArt(
  text: unknown,
  emphasisClassName?: string,
): React.ReactNode {
  const raw = String(text ?? "").trim();
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
      <span
        key={`ta-${key++}`}
        className={emphasisClassName || "font-serif italic text-[#a3413a]"}
      >
        {m[1]}
      </span>,
    );
    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < raw.length) nodes.push(raw.slice(lastIndex));
  return <>{nodes}</>;
}

function addClassToFirstParagraph(html: string, className: string) {
  if (!html) return html;
  return html.replace(/<p(\s[^>]*)?>/i, (full, attrs = "") => {
    const hasClass = /\sclass=/.test(attrs);
    if (!hasClass) return `<p${attrs} class="${className}">`;
    return full.replace(
      /class=(['"])(.*?)\1/i,
      (_m, q, existing) => `class=${q}${existing} ${className}${q}`,
    );
  });
}

function normalizeLeadComparisonText(value: string) {
  return normalizeRichTextForCompare(value);
}

function getDistinctFeatureQuote(rawQuote: unknown, leadHtml: string) {
  const quote = String(rawQuote || "").trim();
  if (!quote) return "";

  const normalizedQuote = normalizeLeadComparisonText(quote);
  const normalizedLead = normalizeLeadComparisonText(leadHtml);
  if (normalizedQuote && normalizedQuote === normalizedLead) {
    return "";
  }

  return quote;
}

function getDistinctFeaturePullQuotes(
  rawPullQuotes: unknown,
  options?: {
    leadHtml?: string;
    featureQuote?: string;
  },
) {
  const normalizedLead = normalizeLeadComparisonText(options?.leadHtml || "");
  const normalizedFeatureQuote = normalizeLeadComparisonText(
    options?.featureQuote || "",
  );
  const seen = new Set<string>();

  return normalizePullQuotes(rawPullQuotes)
    .filter((quote) => {
      const normalizedQuote = normalizeLeadComparisonText(quote);
      if (!normalizedQuote) return false;
      if (normalizedQuote === normalizedLead) return false;
      if (normalizedQuote === normalizedFeatureQuote) return false;
      if (seen.has(normalizedQuote)) return false;
      seen.add(normalizedQuote);
      return true;
    })
    .slice(0, 1);
}
function buildFeatureTextSections(
  data: any,
  options?: { dropCap?: boolean },
): { leadHtml: string; bodyBlocks: string[] } {
  const dropCap = options?.dropCap ?? false;
  const introSource = String(
    data.intro || data.standfirst || data.subheadline || "",
  ).trim();
  const sourceBody = String(data.text || data.textarea || data.body || "").trim();
  const initialBodyBlocks = getHtmlBlocks(sourceBody);

  if (introSource) {
    const introBlocks = getHtmlBlocks(introSource);
    const [firstIntroBlock = ""] = introBlocks;
    const dedupedBodyBlocks = [...initialBodyBlocks];
    const normalizedLead = normalizeLeadComparisonText(firstIntroBlock);

    while (
      normalizedLead &&
      dedupedBodyBlocks.length > 0 &&
      normalizeLeadComparisonText(dedupedBodyBlocks[0]) === normalizedLead
    ) {
      dedupedBodyBlocks.shift();
    }

    return {
      leadHtml: dropCap
        ? addClassToFirstParagraph(firstIntroBlock, "editorial-dropcap")
        : firstIntroBlock,
      bodyBlocks: dedupedBodyBlocks,
    };
  }

  if (initialBodyBlocks.length === 0) {
    return { leadHtml: "", bodyBlocks: [] };
  }

  const [firstBlock, ...remainingBlocks] = initialBodyBlocks;
  const dedupedRemainingBlocks = [...remainingBlocks];
  const normalizedLead = normalizeLeadComparisonText(firstBlock);

  while (
    normalizedLead &&
    dedupedRemainingBlocks.length > 0 &&
    normalizeLeadComparisonText(dedupedRemainingBlocks[0]) === normalizedLead
  ) {
    dedupedRemainingBlocks.shift();
  }

  return {
    leadHtml: dropCap
      ? addClassToFirstParagraph(firstBlock, "editorial-dropcap")
      : firstBlock,
    bodyBlocks: dedupedRemainingBlocks,
  };
}

export function useScrollReveal(
  ref: React.RefObject<HTMLElement | null>,
  options?: IntersectionObserverInit,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("revealed");
        });
      },
      options ?? { threshold: 0.08 },
    );
    root
      .querySelectorAll(".scroll-reveal")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ref, options]);
}

// ─────────────────────────────────────────────
// FULL PAGE AD
// ─────────────────────────────────────────────
export const PageFullPageAd = ({ data, imageVersion }: any) => {
  const image = safeImageSrc(data?.image || data?.featureImage || "");
  const backgroundImage = safeImageSrc(data?.backgroundImage || "");
  const videoUrl = String(data?.videoUrl || "").trim();
  const rawPdf = String(data?.pdfUrl || "").trim();
  const pdfUrl = rawPdf ? fixMagazineImageUrl(rawPdf, imageVersion) : "";
  const label = String(data?.label || "Advertisement").trim();
  const alt = String(data?.alt || label || "Advertisement").trim();
  const hasBackgroundMedia = Boolean(videoUrl || backgroundImage);
  const rawLink = String(data?.linkUrl || "").trim();
  const href = rawLink
    ? rawLink.startsWith("https://") || rawLink.startsWith("http://")
      ? rawLink
      : `https://${rawLink}`
    : "";
  const logo = String(
    data?.logoImage || data?.partnerLogo || "",
  ).trim();
  const resolvedImage = image
    ? fixMagazineImageUrl(image, imageVersion)
    : "";
  const looksLikePdf = (url: string) =>
    /\.pdf(\?|$)/i.test(url.split("?")[0] || "");
  const resolvedBg =
    backgroundImage && !looksLikePdf(backgroundImage)
      ? fixMagazineImageUrl(backgroundImage, imageVersion)
      : resolvedImage && !looksLikePdf(resolvedImage)
        ? resolvedImage
        : "";

  return (
    <div className="relative min-h-full bg-[#0c0a09] overflow-hidden">
      {/* ALWAYS render the blurred backdrop first (image or gradient) so
          even if iframe/video/PDF fails the page isn't pitch blank. */}
      {resolvedBg ? (
        <Image
          src={resolvedBg}
          alt=""
          fill
          sizes="100vw"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className={
            pdfUrl
              ? "object-cover blur-2xl scale-105 opacity-25"
              : "object-cover blur-2xl scale-105 opacity-35"
          }
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c0a09] via-[#141210] to-[#0c0a09]" />
      )}

      {/* PDF handling: DO NOT use inline iframes (Firebase Storage blocks with XFO/CSP + Chromium ORB
          rejects them for .pdf). Instead render a large tap-friendly centre card that opens the PDF
          in a new tab. A blurred image background + gradient fallback ensure the page is NEVER blank. */}
      {pdfUrl ? (
        <div className="absolute inset-0 z-[2] flex items-center justify-center p-8 sm:p-12 lg:p-16">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="group w-full max-w-md flex flex-col items-center gap-5 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] hover:shadow-[0_24px_100px_rgba(163,65,58,0.35)] hover:border-white/30 hover:bg-white/10 transition-all p-8 text-center"
          >
            <div className="h-20 w-20 rounded-2xl bg-[#a3413a]/80 border border-white/20 flex items-center justify-center text-5xl shadow-lg group-hover:scale-105 transition-transform">
              📄
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold text-white tracking-tight">
                {label || "Advertisement"}
              </p>
              <p className="text-sm text-white/75 leading-relaxed">
                Tap to open the full advertisement PDF in a new tab.
              </p>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#a3413a] text-white text-sm font-semibold shadow-[0_10px_30px_rgba(163,65,58,0.4)] group-hover:bg-[#bb4f46] transition-colors">
              Open Advert PDF
              <ExternalLink className="h-4 w-4 ml-1" />
            </div>
          </a>
        </div>
      ) : videoUrl ? (
        <video
          src={fixMagazineImageUrl(videoUrl, imageVersion)}
          poster={
            backgroundImage
              ? fixMagazineImageUrl(backgroundImage, imageVersion)
              : resolvedImage || undefined
          }
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : null}

      {/* For non-PDF, non-video ads: show the main creative at full contain size
          (skip if resolvedImage is itself a PDF — Next.js Image cannot render it) */}
      {!pdfUrl && !videoUrl && resolvedImage && !looksLikePdf(resolvedImage) ? (
        <div
          className={`absolute inset-0 ${hasBackgroundMedia ? "p-6 sm:p-8 lg:p-10" : ""}`}
        >
          <div className="relative w-full h-full">
            <Image
              src={resolvedImage}
              alt={alt}
              fill
              sizes="100vw"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="object-contain"
            />
          </div>
        </div>
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 z-[1] pointer-events-none" />

      <div className="absolute top-5 left-5 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-sm border border-white/10">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a3413a]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
            {label || "Advertisement"}
          </span>
        </div>
      </div>

      {/* Priority 1: PDF link button (always show if PDF exists, browsers often block inline PDF iframes on mobile Safari / strict CSP) */}
      {pdfUrl ? (
        <div className="absolute bottom-6 right-6 z-10 flex flex-wrap gap-2 items-end justify-end">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#a3413a]/90 hover:bg-[#a3413a] text-white text-xs font-semibold backdrop-blur-md border border-white/15 transition-colors shadow-[0_6px_24px_rgba(163,65,58,0.35)]"
          >
            📄 Open Advert PDF
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-semibold hover:bg-white/15 hover:border-white/25 transition-colors"
            >
              Visit
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      ) : href ? (
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

      {logo ? (
        <div className="absolute bottom-6 left-6 z-10 pointer-events-none">
          <div className="flex items-center max-w-[42%] px-3 py-2 rounded-xl bg-black/45 backdrop-blur-sm border border-white/10">
            <Image
              src={fixMagazineImageUrl(logo, imageVersion)}
              alt={String(data?.brand || label || "Sponsor logo").trim()}
              width={256}
              height={64}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="h-auto max-h-16 w-auto object-contain"
              style={{ maxHeight: 64 }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────
// ADS (paper style) — full-page advert for the newspaper reader.
// Primary creative is a PNG; an optional muted autoplay video (videoUrl)
// replaces the static background. Rendered on the paper stock (#fdfdfb) with
// the ink text (#191412) used across the newspaper spreads.
// ─────────────────────────────────────────────
export const PageAds = ({ data, imageVersion = "" }: any) => {
  const image = safeImageSrc(data?.image || data?.featureImage || "");
  const resolvedImage = image ? fixMagazineImageUrl(image, imageVersion) : "";
  const backgroundImage = safeImageSrc(data?.backgroundImage || "");
  const resolvedBg = backgroundImage
    ? fixMagazineImageUrl(backgroundImage, imageVersion)
    : "";
  const videoUrl = String(data?.videoUrl || "").trim();
  const label = String(data?.label || "Advertisement").trim();
  const alt = String(data?.alt || label || "Advertisement").trim();
  const rawHref = String(data?.linkUrl || "").trim();
  const href = rawHref
    ? rawHref.startsWith("https://") || rawHref.startsWith("http://")
      ? rawHref
      : `https://${rawHref}`
    : "";
  const logo = String(data?.logo || data?.logoImage || "").trim();
  const resolvedVideo = videoUrl
    ? fixMagazineImageUrl(videoUrl, imageVersion)
    : "";
  const looksLikePdf = (url: string | undefined | null) =>
    /\.pdf(\?|$)/i.test(String(url || "").split("?")[0] || "");
  const hasCreative = resolvedImage && !looksLikePdf(resolvedImage);

  return (
    <div className="relative flex min-h-full w-full flex-col bg-[#fdfdfb] text-[#191412]">
      {/* Plate header — hairline band + centered label, matching the
          newspaper masthead collar */}
      <div className="px-6 pt-6 sm:px-10 sm:pt-8">
        <header className="flex items-center justify-between gap-4 pb-2">
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            Advertisement
          </span>
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            {label}
          </span>
        </header>
        <div className="h-px w-full bg-[#191412]/25" />
        <div className="mt-2 flex items-center gap-4">
          <div className="h-1 w-1 shrink-0 rotate-45 bg-[#a3413a]" />
          <div className="h-px flex-1 bg-[#191412]/15" />
        </div>
      </div>

      {/* Creative stage — video fills behind, PNG contained on top */}
      <div className="relative flex-1 overflow-hidden">
        {resolvedVideo && !looksLikePdf(resolvedVideo) ? (
          <video
            src={resolvedVideo}
            poster={resolvedBg || resolvedImage || undefined}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full bg-[#fdfdfb] object-cover"
          />
        ) : resolvedBg && !looksLikePdf(resolvedBg) ? (
          <Image
            src={resolvedBg}
            alt=""
            fill
            sizes="100vw"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            className="object-cover"
          />
        ) : null}

        {hasCreative ? (
          <a
            href={href || undefined}
            target={href ? "_blank" : undefined}
            rel={href ? "noreferrer noopener" : undefined}
            className="absolute inset-0 z-[1] flex items-center justify-center"
          >
            <Image
              src={resolvedImage}
              alt={alt}
              fill
              sizes="100vw"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="p-6 sm:p-10 lg:p-12 object-contain"
              style={{ padding: "clamp(1rem, 5vw, 4rem)" }}
            />
          </a>
        ) : !resolvedVideo ? (
          <div className="absolute inset-0 flex items-center justify-center p-10">
            <div className="w-full max-w-2xl border border-dashed border-[#191412]/25 p-10 text-center">
              <p className="font-serif text-2xl font-bold text-[#191412]/60 sm:text-3xl">
                {label || "Advertisement"}
              </p>
              <p className="mt-3 font-sans text-[0.62rem] uppercase tracking-[0.28em] text-[#191412]/45">
                Upload a PNG creative or set a video background URL
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Plate footer — hairline + tiny caps, optional click-through + logo */}
      <div className="px-6 pb-5 pt-3 sm:px-10 sm:pb-6">
        <div className="h-px w-full bg-[#191412]/25" />
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="font-sans text-[0.58rem] font-medium uppercase tracking-[0.22em] text-[#191412]/50">
            Yorkshire BusinessWoman · Advertisement
          </span>
          {logo ? (
            <Image
              src={fixMagazineImageUrl(logo, imageVersion)}
              alt="Sponsor logo"
              width={256}
              height={64}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="mx-auto h-auto max-h-10 w-auto object-contain"
            />
          ) : null}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex shrink-0 items-center gap-1 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#a3413a] hover:text-[#bb4f46]"
            >
              Visit
              <ArrowRight className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// AD SLOTS — printable placeholder rails for the broadsheet spread.
// Consumers pass `data.ads` (array of {image,url,alt,label,format}) for real
// sold creative, or `data.adSlots` (count) to reserve empty placeholder boxes.
// Leaderboard-format ads render as a full-width header banner; everything else
// renders in the side rail. Mirrors the site Ads formats (leaderboard/MPU).
// ─────────────────────────────────────────────
export interface AdSlotData {
  image: string;
  url: string;
  alt: string;
  label: string;
  format?: 'leaderboard' | 'mpu' | 'square';
}

export function resolveAdSlots(data: any): AdSlotData[] {
  const raw = Array.isArray(data?.ads) ? (data.ads as any[]) : [];
  const count = Math.max(0, Number(data?.adSlots) || 0);
  const out: AdSlotData[] = raw.map((ad) => ({
    image: String(ad?.image || ad?.imageUrl || ad?.src || "").trim(),
    url: String(ad?.url || ad?.href || ad?.linkUrl || "").trim(),
    alt: String(ad?.alt || ad?.label || "").trim(),
    label: String(ad?.label || ad?.name || "").trim(),
    format: String(ad?.format || "").trim() as AdSlotData["format"],
  }));
  // Pad up to the reserved count (caps at 6 so a misconfigured edition
  // can't blow up into an unbounded wall of placeholders).
  for (let i = out.length; i < Math.min(Math.max(count, out.length), 6); i++) {
    out.push({ image: "", url: "", alt: "", label: "", format: "mpu" });
  }
  return out;
}

function isLeaderboardFormat(ad: AdSlotData): boolean {
  return String(ad.format || "").toLowerCase() === "leaderboard";
}

export function AdSlot({ ad, index, slots }: { ad: AdSlotData; index: number; slots: number }) {
  const leaderboard = isLeaderboardFormat(ad);
  return (
    <figure className="break-inside-avoid border border-[#191412]/30 bg-[#f5f1ea]">
      <figcaption className="flex items-center justify-between gap-2 border-b border-[#191412]/15 px-3 py-1.5">
        <span className="font-sans text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-[#191412]/55">
          Advertisement
        </span>
        <span className="font-sans text-[0.5rem] uppercase tracking-[0.2em] text-[#191412]/40">
          Slot {index + 1} of {slots}
        </span>
      </figcaption>
      {ad.image ? (
        ad.url ? (
          <a href={ad.url} target="_blank" rel="noreferrer noopener">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.image}
              alt={ad.alt || ad.label || "Advertisement"}
              className={`w-full ${leaderboard ? "object-contain" : "object-contain"}`}
            />
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.image} alt={ad.alt || ad.label || "Advertisement"} className={`w-full ${leaderboard ? "object-contain" : "object-contain"}`} />
        )
      ) : (
        <div className={`flex min-h-[180px] flex-col items-center justify-center gap-2 px-4 py-6 text-center ${leaderboard ? "min-h-[90px]" : ""}`}>
          <span className="font-serif text-[0.95rem] italic leading-snug text-[#191412]/60">
            {ad.label || "Your advertisement here"}
          </span>
          <span className="font-sans text-[0.55rem] uppercase tracking-[0.26em] text-[#191412]/45">
            Reserved
          </span>
        </div>
      )}
    </figure>
  );
}

/**
 * Full-width header banner ad for the broadsheet spread. Rendered between the
 * masthead rule stack and the kicker, sized to the leaderboard 780×90 format
 * (scaled to fit), with the creative shown at natural aspect ratio (contain,
 * never cropped).
 */
export function HeaderAdBanner({ ad }: { ad: AdSlotData }) {
  return (
    <figure className="my-6 border border-[#191412]/30 bg-[#f5f1ea]">
      <figcaption className="flex items-center justify-between gap-2 border-b border-[#191412]/15 px-3 py-1.5">
        <span className="font-sans text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-[#191412]/55">
          Advertisement
        </span>
        <span className="font-sans text-[0.5rem] uppercase tracking-[0.2em] text-[#191412]/40">
          Leaderboard
        </span>
      </figcaption>
      {ad.image ? (
        <div className="flex w-full items-center justify-center bg-[#f5f1ea]">
          {ad.url ? (
            <a href={ad.url} target="_blank" rel="noreferrer noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ad.image}
                alt={ad.alt || ad.label || "Advertisement"}
                className="mx-auto max-h-[140px] w-auto max-w-full object-contain"
              />
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.image}
              alt={ad.alt || ad.label || "Advertisement"}
              className="mx-auto max-h-[140px] w-auto max-w-full object-contain"
            />
          )}
        </div>
      ) : (
        <div className="flex aspect-[780/90] flex-col items-center justify-center gap-1 px-4 text-center">
          <span className="font-serif text-[0.9rem] italic leading-snug text-[#191412]/60">
            {ad.label || "Your advertisement here"}
          </span>
          <span className="font-sans text-[0.55rem] uppercase tracking-[0.26em] text-[#191412]/45">
            Leaderboard · Reserved
          </span>
        </div>
      )}
    </figure>
  );
}

export const PageNewspaperSpread = ({ data, imageVersion = "", siblings = [] }: any) => {
  const ref = useRef<HTMLDivElement>(null);

  const kicker = String((data.kicker || data.category) ?? "").trim();
  const name = String(data.name || data.author || "").trim();
  const title = String(data.title || data.name || kicker || "Feature").trim();
  const featureImage = safeImageSrc(data.featureImage || data.image || "");
  const { leadHtml, bodyBlocks } = buildFeatureTextSections(data, {
    dropCap: false,
  });
  const featureQuote = getDistinctFeatureQuote(data.quote, leadHtml);
  const pullQuotes = getDistinctFeaturePullQuotes(data.pullQuotes || data.quotes, {
    leadHtml,
    featureQuote,
  });
  const stats = Array.isArray(data.stats) ? data.stats : [];
  const moreStories = Array.isArray(siblings) ? siblings.slice(0, 4) : [];
  const adSlots = resolveAdSlots(data);
  // Page-level ad placement (2026-09-11 redesign):
  //   * The old full-width HeaderAdBanner (leaderboard, 780×90 max-h-140)
  //     rendered between the printer's rule stack and the kicker. Users
  //     reported this was far too small / cramped to read at the narrow
  //     spread header so we've retired it entirely. If a page explicitly
  //     passes a leaderboard-formatted ad we still accept the creative
  //     but render it inline (same sizing as MPU/square).
  //   * The old 340 px right-hand rail ("<aside> Advertisement / AdSlot …
  //     ") ate the entire right column even on pages that only had a single
  //     MPU. Rail ads now ride inside the multicol body as full-column-width
  //     figures interleaved with the text — exactly like gallery photos — so
  //     the column grid keeps its width. Only pullQuotes and social embeds
  //     still open the quote/social rail; a page with ads alone keeps the
  //     full-width 3-column text layout, with the ad inside the flow.
  const inlineAds = adSlots.slice(0, 2);

  const rawSocial = [
    data.socialEmbeds ?? [],
    data.social ?? [],
    data.socialPosts ?? [],
  ].flat();
  const socialSeen = new Set<string>();
  const socialEmbeds: BroadsheetSocialPost[] = [];
  for (const raw of rawSocial) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const platform = p.platform as BroadsheetSocialPlatform | undefined;
    const handle = String(p.handle || "").trim();
    const postUrl = String(p.postUrl || "").trim();
    const date = String(p.date || "").trim();
    const body = String(p.body || "").trim().slice(0, 80);
    const key = `${platform || ""}|${handle}|${postUrl}|${date}|${body}`;
    if (socialSeen.has(key)) continue;
    socialSeen.add(key);
    if (!platform || !["twitter","instagram","facebook","linkedin","tiktok","youtube"].includes(platform)) continue;
    const accountName = String(p.accountName || "").trim();
    const imageUrl = safeImageSrc(p.imageUrl);
    socialEmbeds.push({
      platform,
      handle: handle || accountName || "ybw",
      accountName: accountName || handle || "YBW",
      date: date || "",
      body: String(p.body || "").trim(),
      imageUrl: imageUrl || undefined,
      caption: p.caption ? String(p.caption).trim() || undefined : undefined,
      postUrl: fixMagazineImageUrl(postUrl, imageVersion) || "#",
      layout: p.layout === "rail" || p.layout === "column-half" || p.layout === "column-full"
        ? (p.layout as "rail" | "column-half" | "column-full")
        : undefined,
    });
  }

  // Gallery plates for the body columns (everything after the hero), deduped
  // and with hero skipped.
  const hasRailContent =
    pullQuotes.length > 0 || socialEmbeds.length > 0;
  const gallerySources: string[] = useMemo(() => {
    const raw = Array.isArray(data.gallery)
      ? data.gallery
      : Array.isArray(data.images)
        ? data.images
        : Array.isArray(data.additionalImages)
          ? data.additionalImages
          : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
      let src = "";
      if (typeof item === "string") src = String(item || "").trim();
      else if (item && typeof item === "object") {
        const r = item as Record<string, unknown>;
        src = String(r.src || r.image || r.url || "").trim();
      }
      const fixed = fixMagazineImageUrl(src, imageVersion);
      if (!fixed || isPlaceholderImageUrl(fixed)) continue;
      if (seen.has(fixed)) continue;
      seen.add(fixed);
      if (featureImage && fixed === fixMagazineImageUrl(featureImage, imageVersion))
        continue;
      out.push(fixed);
    }
    return out;
  }, [data, featureImage, imageVersion]);

  // The body set in native CSS multicol: text blocks flow in reading order with
  // figures (gallery images + inline ads) interleaved roughly evenly, so the
  // browser balances the columns itself (no JS height estimator). Every figure
  // gets break-inside-avoid and spans the full column width.
  const flowItems = useMemo(() => {
    const figures: Array<
      | { kind: "img"; src: string; alt: string }
      | {
          kind: "ad";
          image: string;
          url: string;
          alt: string;
          label: string;
        }
    > = [
      ...gallerySources.map((src) => ({
        kind: "img" as const,
        src,
        alt: String(data.title || "Story image"),
      })),
      ...inlineAds
        .filter((ad) => ad && String(ad.image || "").trim())
        .map((ad) => ({
          kind: "ad" as const,
          image: String(ad.image),
          url: String(ad.url || ""),
          alt: String(ad.alt || ad.label || "Advertisement"),
          label: String(ad.label || "Advertisement"),
        })),
    ];
    if (bodyBlocks.length === 0) {
      return figures.map((figure) => ({ kind: "figure" as const, figure }));
    }
    if (figures.length === 0) {
      return bodyBlocks.map((html) => ({ kind: "text" as const, html }));
    }
    // Interleave figure i before text block ~i·(total/figures+1) so plates sit
    // at even thirds/halves of the article instead of clustering at the end.
    const out: Array<{ kind: "figure"; figure: (typeof figures)[number] } | { kind: "text"; html: string }> = [];
    let f = 0;
    for (let i = 0; i < bodyBlocks.length; i++) {
      while (f < figures.length && i >= Math.floor(((f + 1) * bodyBlocks.length) / (figures.length + 1))) {
        out.push({ kind: "figure", figure: figures[f] });
        f += 1;
      }
      out.push({ kind: "text", html: bodyBlocks[i] });
    }
    while (f < figures.length) {
      out.push({ kind: "figure", figure: figures[f] });
      f += 1;
    }
    return out;
  }, [bodyBlocks, gallerySources, inlineAds, data]);

  return (
    <div
      ref={ref}
      className="min-h-full w-full bg-[#fdfdfb] text-[#191412]"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        {/* Masthead band */}
        <header className="flex items-center justify-between gap-4 pb-2">
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            {kicker || "Digital Edition"}
          </span>
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            Yorkshire BusinessWoman
          </span>
        </header>
        <div className="h-px w-full bg-[#191412]/25" />
        <div className="hidden py-3 text-center sm:block">
          <h1 className="py-1 text-center">
            <MagazineMastheadLogo />
          </h1>
          <p className="mt-1.5 font-sans text-[0.6rem] uppercase tracking-[0.34em] text-[#191412]/50 sm:text-[0.65rem]">
            News for the region&rsquo;s entrepreneurs &amp; businesswomen
          </p>
        </div>
        {/* Dateline + printer's graduated rule stack */}
        <div className="flex flex-col items-center justify-between gap-1 border-b border-t border-[#191412] py-1.5 sm:flex-row">
          <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
            The finest of its kind, printed without apology
          </span>
          <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
            YBW · No. 32
          </span>
        </div>
        <div className="mt-0 h-[2px] w-full bg-[#191412]" />
        <div className="h-px w-full bg-[#191412]/70" />
        <div className="h-[3px] w-full bg-[#191412]" />

        {/* (Header leaderboard ad banner retired 2026-09-11 — too small in
             the narrow spread header. Ads now render inline inside the body
             text column so editorial copy wraps around them.) */}

        {/* Kicker + byline */}
        <div className="flex flex-col gap-2 pt-10 sm:flex-row sm:items-end sm:justify-between">
          <span className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#a3413a]">
            {kicker}
          </span>
          {name && (
            <span className="font-sans text-[0.7rem] text-[#191412]/70">{name}</span>
          )}
        </div>

        {/* Headline */}
        <div className="mt-4 max-w-3xl border-b border-[#191412] pb-3">
          <h2 className="font-serif text-[clamp(1.9rem,6vw,3.7rem)] font-bold leading-[0.98] tracking-tight text-[#191412] [&_span]:font-normal">
            {renderTitleArt(title, "font-serif italic text-[#a3413a]")}
          </h2>
        </div>

        {/* Hero plate */}
        {featureImage ? (
          <figure className="mt-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fixMagazineImageUrl(featureImage, imageVersion)}
              alt={title}
              className="w-full object-cover"
            />
            <div className="flex items-end justify-between gap-4 border-b border-[#191412]/30 pt-2">
              <figcaption className="font-sans text-[0.72rem] leading-snug text-[#191412]/75">
                {title}
              </figcaption>
              <span className="shrink-0 font-sans text-[0.6rem] uppercase tracking-[0.14em] text-[#191412]/50">
                YBW
              </span>
            </div>
            <div className="my-6 h-[3px] w-full bg-[#191412]" />
            <div className="h-px w-full bg-[#191412]/40" />
          </figure>
        ) : null}

        {/* Lead + pull-quote/social rail (quote/social only; ads moved inline) */}
        <div className={`mt-4 grid grid-cols-1 gap-8 ${hasRailContent ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]" : ""}`}>
          <article>
            {leadHtml ? (
              <SafeText
                html={leadHtml}
                className="font-serif text-[1.05rem] leading-[1.75] text-[#191412]/90 sm:text-[1.15rem] sm:leading-[1.7] [&_p]:max-w-[63ch] first:[&_p]:first-letter:float-left first:[&_p]:first-letter:mt-1 first:[&_p]:first-letter:pr-3 first:[&_p]:first-letter:font-serif first:[&_p]:first-letter:text-[2.9rem] first:[&_p]:first-letter:font-bold first:[&_p]:first-letter:leading-[0.78] first:[&_p]:first-letter:text-[#a3413a]"
              />
            ) : null}

            <div className="my-7 h-px w-full bg-[#191412]/25" />

            {/* Body set in native CSS multi-columns — the browser balances the
                 columns itself and paragraphs overflow naturally across column
                 boundaries. Figures (gallery plates + ad creative) interleave
                 through the flow at even intervals and are kept whole with
                 break-inside-avoid, spanning the full column width. */}
            {flowItems.length > 0 ? (
              <div className="mt-6 columns-1 gap-10 md:columns-2 lg:columns-3 md:[column-rule:1px_solid_rgba(25,20,18,0.18)]">
                {(() => {
                  const nodes: React.ReactNode[] = [];
                  let html = "";
                  const flush = () => {
                    if (!html) return;
                    nodes.push(
                      <SafeText
                        key={`flow-t-${nodes.length}`}
                        html={html}
                        className="magazine-body font-serif text-[0.98rem] leading-[1.45] tracking-[-0.01em] text-[#191412]/88 [&_p]:font-serif [&_p]:tracking-[-0.01em] [&_p]:[text-align:left] [&_figure]:break-inside-avoid"
                      />,
                    );
                    html = "";
                  };
                  flowItems.forEach((item, i) => {
                    if (item.kind === "text") {
                      html += item.html;
                      return;
                    }
                    flush();
                    const fig = item.figure;
                    nodes.push(
                      <figure
                        key={`flow-fig-${i}`}
                        className="mb-5 w-full break-inside-avoid"
                      >
                        {fig.kind === "img" ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={fig.src}
                              alt={fig.alt}
                              className="w-full object-cover"
                            />
                            <figcaption className="mt-1.5 border-b border-[#191412]/30 pb-1.5 font-sans text-[0.68rem] leading-snug text-[#191412]/60">
                              {title}
                            </figcaption>
                          </>
                        ) : (
                          <>
                            {fig.url ? (
                              <a
                                href={fig.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="group block w-full"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={fig.image}
                                  alt={fig.alt}
                                  className="w-full object-contain group-hover:opacity-95 transition-opacity"
                                  loading="lazy"
                                />
                              </a>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={fig.image}
                                alt={fig.alt}
                                className="w-full object-contain"
                                loading="lazy"
                              />
                            )}
                            <figcaption className="mt-1.5 border-b border-[#191412]/30 pb-1.5 font-sans text-[0.68rem] leading-snug text-[#191412]/60">
                              {fig.label || "Advertisement"}
                            </figcaption>
                          </>
                        )}
                      </figure>,
                    );
                  });
                  flush();
                  return nodes;
                })()}
              </div>
            ) : null}
          </article>

          {/* Pull-quote / social rail (sibling column on lg only when quote
               or social embeds exist; ads moved inline into the article body) */}
          {hasRailContent ? (
            <aside className="border-t-[3px] border-[#191412] pt-6 lg:border-t-0 lg:pt-0 lg:pl-10 lg:[border-left:1px_solid_rgba(25,20,18,0.22)]">
              {pullQuotes.length > 0 && (
                <>
                  <span className="mb-4 block font-sans text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#a3413a]">
                    In this feature
                  </span>
                  <figure>
                    <span
                      aria-hidden="true"
                      className="block font-serif text-[3rem] leading-none text-[#191412]/25"
                    >
                      &ldquo;
                    </span>
                    <blockquote className="-mt-6 font-serif text-[1.25rem] italic leading-[1.35] text-[#191412] lg:text-[1.35rem]">
                      {pullQuotes[0]}
                    </blockquote>
                  </figure>
                  {pullQuotes.length > 1 && (
                    <figure className="mt-7 border-t border-[#191412]/25 pt-4">
                      <blockquote className="font-serif text-[1.05rem] leading-[1.5] italic text-[#191412]/80">
                        {pullQuotes[1]}
                      </blockquote>
                    </figure>
                  )}
                </>
              )}
              {socialEmbeds.length > 0 && (
                <>
                  {pullQuotes.length > 0 ? (
                    <div className="mt-7 border-t border-[#191412]/25 pt-4" />
                  ) : null}
                  <span className="mb-4 block font-sans text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#a3413a]">
                    {socialEmbeds.length >= 3 && socialEmbeds[0].platform === "instagram"
                      ? "Readers on Instagram"
                      : "From our social"}
                  </span>
                  <div className="flex flex-col gap-7">
                    {socialEmbeds.slice(0, 2).map((post, i) => (
                      <div key={`rail-social-${i}`} className={i > 0 ? "border-t border-[#191412]/25 pt-6" : ""}>
                        <BroadsheetSocialPostCard post={post} slot="rail" imageVersion={imageVersion} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </aside>
          ) : null}
        </div>

        {/* Stats band */}
        {stats.length > 0 ? (
          <div className="mt-12 grid grid-cols-1 gap-px border border-[#191412]/20 bg-[#191412]/20 sm:grid-cols-3">
            {stats.slice(0, 3).map((stat: any, i: number) => (
              <div
                key={`${stat?.label ?? "stat"}-${i}`}
                className={`bg-[#fdfdfb] px-6 py-6 ${
                  i > 0 ? "border-l border-[#191412]/20" : ""
                }`}
              >
                <p className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.26em] text-[#a3413a]">
                  {stat?.label}
                </p>
                <p className="mt-2 font-serif text-3xl font-bold leading-none text-[#191412]">
                  {stat?.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Social embed grid (newspaper hairline column separators, 1/2/3 col) */}
        {socialEmbeds.length >= 3 ? (
          <section className="mt-14">
            <div className="flex flex-col items-center gap-3 pb-4">
              <span className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#a3413a]">
                {socialEmbeds[0].platform === "instagram"
                  ? "Readers on Instagram"
                  : "From our social"}
              </span>
              <div className="flex items-center gap-2 text-[#191412]/60" aria-hidden="true">
                <span className="font-serif text-[1.05rem] leading-none">◆</span>
                <span className="font-serif text-[1.05rem] leading-none">◆</span>
                <span className="font-serif text-[1.05rem] leading-none">◆</span>
              </div>
            </div>
            <div className="h-px w-full bg-[#191412]/60" />
            <div className="h-[3px] w-full bg-[#191412]" />
            <div className="grid grid-cols-1 gap-0 md:grid-cols-2 xl:grid-cols-3">
              {socialEmbeds.slice(0, 9).map((post, i) => (
                <div
                  key={`grid-social-${i}`}
                  className={[
                    "border-b border-[#191412]/25 bg-[#fdfdfb] px-6 py-7",
                    i > 0 ? "md:border-l md:border-[#191412]/20" : "",
                    i >= 2 ? "xl:border-l xl:border-[#191412]/20" : "",
                    i >= 1 ? "md:border-t md:border-[#191412]/15" : "",
                    i >= 3 ? "xl:border-t xl:border-[#191412]/15 md:border-t-0" : "",
                    i >= 2 ? "md:border-t-0" : "",
                  ].join(" ")}
                >
                  <BroadsheetSocialPostCard post={post} slot="grid" imageVersion={imageVersion} />
                </div>
              ))}
            </div>
            <div className="h-px w-full bg-[#191412]/40" />
          </section>
        ) : null}

        {/* More from this edition — newspaper-style story mixing */}
        {moreStories.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-center justify-between gap-4 pb-2">
              <h3 className="font-serif text-[0.85rem] font-bold uppercase tracking-[0.22em] text-[#191412]/70">
                More from this edition
              </h3>
              <span className="font-sans text-[0.6rem] uppercase tracking-[0.18em] text-[#191412]/45">
                Yorkshire BusinessWoman
              </span>
            </div>
            <div className="h-px w-full bg-[#191412]/60" />
            <div
              className={[
                "mt-0 grid gap-px border-x border-b border-[#191412]/25 bg-[#191412]/25",
                moreStories.length === 1
                  ? "grid-cols-1"
                  : moreStories.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : moreStories.length === 3
                      ? "grid-cols-1 sm:grid-cols-3"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
              ].join(" ")}
            >
              {moreStories.map((s: any, i: number) => {
                const pos = Number.parseInt(String(s?.position ?? ""), 10);
                const nums = Number.isFinite(pos) && pos > 0 ? pos : i + 1;
                const href = Number.isFinite(nums) ? `?page=${nums}` : "#";
                return (
                  <a
                    key={`${s?.pageId ?? "story"}-${i}`}
                    href={href}
                    data-page={Number.isFinite(nums) ? String(nums) : undefined}
                    className="group flex flex-col bg-[#fdfdfb] p-5 text-left transition-colors hover:bg-[#f3efe8]"
                    aria-label={s?.title ? `Jump to page ${nums}: ${String(s.title)}` : undefined}
                  >
                    <span className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[#a3413a]">
                      #{String(nums).padStart(2, "0")} · {String(s?.kicker || "Feature").toUpperCase()}
                    </span>
                    <span className="mt-3 font-serif text-[1.05rem] font-bold leading-snug text-[#191412] group-hover:underline">
                      {s?.title}
                    </span>
                    {s?.standfirst ? (
                      <span className="mt-2 line-clamp-3 font-sans text-[0.78rem] leading-relaxed text-[#191412]/65">
                        {s?.standfirst}
                      </span>
                    ) : null}
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Folio with ornamental centre */}
        <footer className="mt-12 pt-6">
          <div className="h-[3px] w-full bg-[#191412]" />
          <div className="h-px w-full bg-[#191412]/50" />
          <div className="flex items-center justify-between pt-3 font-sans text-[0.65rem] uppercase tracking-[0.18em] text-[#191412]/55">
            <span>YBW</span>
            <span className="hidden text-[#a3413a] sm:inline">◆ ◆ ◆</span>
            <span>{kicker}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// NEWSPAPER COVER — broadsheet front page
// ─────────────────────────────────────────────
export const PageNewspaperCover = ({
  data,
  imageVersion = "",
  editionSlug = "",
  siblings = [],
}: {
  data: any;
  imageVersion?: string;
  editionSlug?: string;
  siblings?: StorySummary[];
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const title = String(data.title || data.headline || "").trim();
  const subheadline = String(
    data.subheadline || data.standfirst || data.description || "",
  ).trim();
  const kicker = String(data.kicker || data.badge || data.category || "").trim();
  const date = String(data.date || data.issue || "").trim();
  const coverImage = safeImageSrc(data.image || data.featureImage || "");
  const teasers = Array.isArray(siblings)
    ? siblings
        .filter((story) => story && String(story.title || "").trim())
        .slice(0, 4)
    : [];

  const [slug, setSlug] = useState("");
  useEffect(() => {
    if (editionSlug) {
      setSlug(editionSlug);
      return;
    }
    try {
      const match = window.location.pathname.match(/\/magazine\/read\/([^/?]+)/);
      if (match) setSlug(decodeURIComponent(match[1]));
    } catch {}
  }, [editionSlug]);

  return (
    <div
      ref={ref}
      className="min-h-full w-full bg-[#fdfdfb] text-[#191412]"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        {/* Masthead band */}
        <header className="flex items-center justify-between gap-4 pb-2">
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            {date || "Digital Edition"}
          </span>
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            {kicker || "Yorkshire BusinessWoman"}
          </span>
        </header>
        <div className="h-px w-full bg-[#191412]/25" />
        <div className="py-3 text-center">
          <h1 className="py-1 text-center">
            <MagazineMastheadLogo />
          </h1>
          <p className="mt-1.5 font-sans text-[0.6rem] uppercase tracking-[0.34em] text-[#191412]/50 sm:text-[0.65rem]">
            News for the region&rsquo;s entrepreneurs &amp; businesswomen
          </p>
        </div>
        <div className="h-px w-full bg-[#191412]/25" />
        <div className="flex flex-col items-center justify-between gap-1 py-2 sm:flex-row">
          <span className="font-sans text-[0.65rem] text-[#191412]/60">
            The finest of its kind, printed without apology
          </span>
          <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
            {date || "YBW"}
          </span>
        </div>
        <div className="h-px w-full bg-[#191412]/60" />

        {/* Front-page splash image */}
        {coverImage ? (
          <figure className="mt-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fixMagazineImageUrl(coverImage, imageVersion)}
              alt={title}
              className="w-full object-cover"
            />
            <div className="flex items-end justify-between gap-4 border-b border-[#191412]/30 pt-2">
              <figcaption className="font-sans text-[0.72rem] leading-snug text-[#191412]/75">
                {title}
              </figcaption>
              <span className="shrink-0 font-sans text-[0.6rem] uppercase tracking-[0.14em] text-[#191412]/50">
                YBW
              </span>
            </div>
            <div className="my-6 h-[3px] w-full bg-[#191412]" />
          </figure>
        ) : (
          <div className="my-10 h-[3px] w-full bg-[#191412]" />
        )}

        {/* Skyline */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div>
            {kicker ? (
              <span className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#a3413a]">
                {kicker}
              </span>
            ) : null}
            {title ? (
              <h2 className="mt-3 font-serif text-[clamp(1.9rem,6vw,3.7rem)] leading-[1.02] tracking-tight text-[#191412]">
                {renderTitleArt(title, "font-serif text-[#191412]")}
              </h2>
            ) : null}
            {subheadline ? (
              <SafeText
                html={subheadline}
                className="mt-5 font-serif text-[1.05rem] leading-[1.75] text-[#191412]/90 sm:text-[1.15rem] sm:leading-[1.7]"
              />
            ) : null}
          </div>

          {/* Cover rail — numbered front-page teasers (01 The Founder…) */}
          <aside className="border-t-[3px] border-[#191412] pt-5 md:border-t-0 md:pt-0 md:pl-10 md:[border-left:1px_solid_rgba(25,20,18,0.2)]">
            <span className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#a3413a]">
              Front page
            </span>
            {teasers.length > 0 ? (
              <ol className="mt-4">
                {teasers.map((story, i) => {
                  const pos = Number(story.position) || i + 1;
                  const href = slug
                    ? `/magazine/read/${slug}?page=${pos}`
                    : `#page-${pos}`;
                  return (
                    <li
                      key={String(story.pageId ?? "") || `teaser-${i}`}
                      className="mt-4 border-t border-[#191412]/15 pt-4 first:mt-0 first:border-t-0 first:pt-0"
                    >
                      <a href={href} data-page={String(pos)} className="group block">
                        <span className="flex items-baseline gap-3">
                          <span className="font-serif text-[2.3rem] leading-none tracking-tight text-[#a3413a]">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="font-serif text-[1.12rem] font-bold leading-[1.2] text-[#191412] group-hover:underline">
                            {story.title}
                          </span>
                        </span>
                        {story.kicker ? (
                          <span className="mt-1.5 block font-sans text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#191412]/55">
                            {String(story.kicker).toUpperCase()}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="-mt-1 font-serif text-[1.25rem] leading-[1.35] text-[#191412] lg:text-[1.4rem]">
                {subheadline || title || "A new edition, ready to read"}
              </p>
            )}
          </aside>
        </div>

        {/* Folio */}
        <footer className="mt-12">
          <div className="h-px w-full bg-[#191412]/25" />
          <div className="flex items-center justify-between pt-3 font-sans text-[0.65rem] uppercase tracking-[0.18em] text-[#191412]/55">
            <span>YBW</span>
            <span className="text-[#a3413a]">◆ broadsheet</span>
            <span>{kicker || "cover"}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// NEWSPAPER CONTENTS — broadsheet table of contents
// ─────────────────────────────────────────────
export const PageNewspaperContents = ({ data, imageVersion = "", editionSlug }: any) => {
  const ref = useRef<HTMLDivElement>(null);

  const items = Array.isArray(data.items) ? data.items : [];
  const title = String(data.title || "In This Issue").trim();
  const kicker = String(data.kicker || data.category || "").trim();

  const [slug, setSlug] = useState("");
  useEffect(() => {
    if (editionSlug) {
      setSlug(editionSlug);
      return;
    }
    try {
      const match = window.location.pathname.match(/\/magazine\/read\/([^/?]+)/);
      if (match) setSlug(decodeURIComponent(match[1]));
    } catch {}
  }, [editionSlug]);

  return (
    <div
      ref={ref}
      className="min-h-full w-full bg-[#fdfdfb] text-[#191412]"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        {/* Masthead band */}
        <header className="flex items-center justify-between gap-4 pb-2">
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            {kicker || "Contents"}
          </span>
          <span className="font-sans text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#191412]/55 sm:text-[0.68rem]">
            Yorkshire BusinessWoman
          </span>
        </header>
        <div className="h-px w-full bg-[#191412]/25" />
        <div className="py-3 text-center">
          <h1 className="py-1 text-center">
            <MagazineMastheadLogo />
          </h1>
          <p className="mt-1.5 font-sans text-[0.6rem] uppercase tracking-[0.34em] text-[#191412]/50 sm:text-[0.65rem]">
            In this issue
          </p>
        </div>
        <div className="h-px w-full bg-[#191412]/25" />
        <div className="flex flex-col items-center justify-between gap-1 py-2 sm:flex-row">
          <span className="font-sans text-[0.65rem] text-[#191412]/60">
            What&rsquo;s inside
          </span>
          <span className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[#191412]/60">
            {kicker || "YBW"}
          </span>
        </div>
        <div className="h-px w-full bg-[#191412]/60" />

        {/* Contents heading */}
        <div className="flex flex-col gap-2 pt-10 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-serif text-[clamp(1.6rem,4.5vw,2.8rem)] leading-[1.02] tracking-tight text-[#191412]">
            {renderTitleArt(title, "font-serif text-[#191412]")}
          </h2>
          <span className="font-sans text-[0.7rem] text-[#191412]/70">
            {items.length} stories
          </span>
        </div>

        {/* Contents grid — newspaper columns; rows styled like the cover's
            front-page teasers (big terracotta numeral + serif title + kicker) */}
        {items.length > 0 ? (
          <ol className="mt-10 columns-1 gap-10 md:columns-2 xl:columns-3 md:[column-rule:1px_solid_rgba(25,20,18,0.18)]">
            {items.map((item: any, i: number) => {
              const rawPage = item?.page;
              const pageNum =
                typeof rawPage === "number"
                  ? rawPage
                  : Number.parseInt(String(rawPage ?? "").trim(), 10);
              const nums = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : i + 1;
              const pageLabel = String(nums).padStart(2, "0");
              const hashHref = Number.isFinite(pageNum) ? `#page-${pageNum}` : "#";
              const pageHref =
                slug && Number.isFinite(pageNum)
                  ? `/magazine/read/${slug}?page=${pageNum}`
                  : hashHref;
              return (
                <li
                  key={`${pageLabel}-${item?.title ?? i}`}
                  className="mb-6 break-inside-avoid border-b border-[#191412]/15 pb-5"
                >
                  <a
                    href={pageHref}
                    data-page={Number.isFinite(pageNum) ? String(pageNum) : undefined}
                    className="group block text-left"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="font-serif text-[2rem] leading-none tracking-tight text-[#a3413a]">
                        {pageLabel}
                      </span>
                      <span className="font-serif text-[1.05rem] font-bold leading-[1.2] text-[#191412] group-hover:underline">
                        {item?.title}
                      </span>
                    </span>
                    {item?.kicker ? (
                      <span className="mt-1.5 block font-sans text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#191412]/55">
                        {String(item.kicker).toUpperCase()}
                      </span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ol>
        ) : null}

        {/* Folio */}
        <footer className="mt-12">
          <div className="h-px w-full bg-[#191412]/25" />
          <div className="flex items-center justify-between pt-3 font-sans text-[0.65rem] uppercase tracking-[0.18em] text-[#191412]/55">
            <span>YBW</span>
            <span className="text-[#a3413a]">◆ broadsheet</span>
            <span>{kicker || "contents"}</span>
          </div>
        </footer>
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
  const kicker = String(data.kicker || "").trim();
  const comingSoonLabel = String(data.comingSoonLabel || "").trim();
  const mediaLayout = String(data.mediaLayout || "").trim();
  const isFullBackground = mediaLayout === "background";
  const additionalMedia = getAdditionalMedia(
    data,
    String(data.title || data.nextIssue || kicker || "Back Cover").trim(),
  );
  const featureImage = safeImageSrc(data.featureImage || data.image || "");
  const backgroundMedia = featureImage;
  const rawLink = String(data.linkUrl || "").trim();
  const ctaHref = rawLink
    ? rawLink.startsWith("/") ||
      rawLink.startsWith("#") ||
      rawLink.startsWith("http://") ||
      rawLink.startsWith("https://")
      ? rawLink
      : `https://${rawLink}`
    : "/membership";

  if (isFullBackground) {
    return (
      <div
        ref={ref}
        className="relative min-h-full overflow-hidden bg-[#0c0a09]"
      >
        {backgroundMedia && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fixMagazineImageUrl(backgroundMedia, imageVersion)}
            alt={data.title || data.nextIssue || kicker}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {data.videoUrl && (
          <video
            src={fixMagazineImageUrl(data.videoUrl, imageVersion)}
            poster={
              backgroundMedia
                ? fixMagazineImageUrl(backgroundMedia, imageVersion)
                : undefined
            }
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/68 via-black/36 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/56 via-black/16 to-transparent" />
        <div className="relative z-10 py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-md shadow-[0_24px_90px_rgba(0,0,0,0.55)] p-7 sm:p-10 space-y-6">
              {kicker && (
                <div className="flex items-center gap-4 w-full min-w-0">
                  <div className="h-px flex-1 bg-gradient-to-r from-[#a3413a]/60 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white whitespace-normal break-words leading-tight max-w-[28rem] text-right">
                    {kicker}
                  </span>
                </div>
              )}
              <div>
                {comingSoonLabel && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white mb-2">
                    {comingSoonLabel}
                  </p>
                )}
                <h2 className="text-section-lg font-serif font-600 text-white">
                  {renderTitleArt(data.title, "font-serif italic text-white")}
                </h2>
                {data.nextIssue && (
                  <p className="text-white font-medium mt-1 text-lg">
                    {data.nextIssue}
                  </p>
                )}
              </div>
              {data.text && (
                <SafeText
                  html={data.text}
                  className="font-serif text-white leading-relaxed [&_p]:text-white"
                />
              )}
              {additionalMedia.length > 0 && (
                <div className="scroll-reveal">
                  <AdditionalMediaGallery
                    items={additionalMedia}
                    imageVersion={imageVersion}
                    variant="dark"
                  />
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-full text-white hover:opacity-90 transition-opacity"
                  style={{
                    background:
                      "linear-gradient(135deg, #a3413a 0%, #a3413a 100%)",
                  }}
                >
                  {data.cta || "Join the Community"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {socials.length > 0 && (
                  <div className="flex items-center gap-2">
                    {socials.slice(0, 6).map((label: any, i: number) => (
                      <span
                        key={`${label}-${i}`}
                        className="text-white text-sm font-medium"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
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
            {kicker && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3413a] whitespace-normal break-words leading-tight max-w-[28rem] text-right">
                {kicker}
              </span>
            )}
          </div>
        </div>
        <div className="scroll-reveal rounded-3xl overflow-hidden border border-[#e8d5c0] shadow-[0_16px_60px_rgba(163,65,58,0.1)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <div className="p-10 lg:p-14 flex flex-col justify-center space-y-5 bg-white">
              {comingSoonLabel && (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3413a] mb-2">
                  {comingSoonLabel}
                </p>
              )}
              <h2 className="text-section-lg font-serif font-600 text-[#1c1410]">
                {renderTitleArt(data.title, "font-serif italic text-[#a3413a]")}
              </h2>
              {data.nextIssue && (
                <p className="text-[#7a6e65] font-medium mt-1 text-lg">
                  {data.nextIssue}
                </p>
              )}
              {data.text && (
                <SafeText
                  html={data.text}
                  className="font-serif text-[#3d2b1f]/70 leading-relaxed"
                />
              )}
              {additionalMedia.length > 0 && (
                <div className="scroll-reveal scroll-reveal-delay-2">
                  <AdditionalMediaGallery
                    items={additionalMedia}
                    imageVersion={imageVersion}
                    variant="light"
                  />
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-full text-white hover:opacity-90 transition-opacity"
                  style={{
                    background:
                      "linear-gradient(135deg, #a3413a 0%, #a3413a 100%)",
                  }}
                >
                  {data.cta || "Join the Community"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {socials.length > 0 && (
                  <div className="flex items-center gap-2">
                    {socials.slice(0, 6).map((label: any, i: number) => (
                      <span
                        key={`${label}-${i}`}
                        className="text-[#7a6e65] text-sm font-medium"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {(data.videoUrl || featureImage || data.pdfUrl) && (
              <div className="overflow-hidden aspect-[4/3] lg:aspect-auto relative rounded-2xl border border-stone-200/80 shadow-sm bg-stone-50">
                {data.pdfUrl ? (
                  <a
                    href={fixMagazineImageUrl(data.pdfUrl, imageVersion)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="absolute inset-0 flex items-center justify-center p-6 bg-gradient-to-br from-[#faf8f5] via-white to-stone-100 text-center group hover:from-stone-100 hover:via-white hover:to-[#f5efe8] transition-colors"
                  >
                    <div className="flex flex-col items-center gap-4 max-w-xs">
                      <div className="h-16 w-16 rounded-2xl bg-[#a3413a]/90 border border-white/20 flex items-center justify-center text-4xl shadow-md group-hover:scale-105 transition-transform">
                        📄
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-base font-bold text-stone-900 tracking-tight">
                          {data.title || data.nextIssue || "Back Cover Media"}
                        </p>
                        <p className="text-xs text-stone-500 leading-relaxed">
                          Tap to open the PDF in a new tab.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#a3413a] text-white text-xs font-semibold shadow-md group-hover:bg-[#bb4f46] transition-colors">
                        Open PDF
                        <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </a>
                ) : data.videoUrl ? (
                  <>
                    {featureImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fixMagazineImageUrl(featureImage, imageVersion)}
                        alt={data.title || data.nextIssue || kicker}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <video
                      src={fixMagazineImageUrl(data.videoUrl, imageVersion)}
                      poster={
                        featureImage
                          ? fixMagazineImageUrl(featureImage, imageVersion)
                          : undefined
                      }
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="relative w-full h-full object-cover"
                    />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fixMagazineImageUrl(featureImage, imageVersion)}
                    alt={data.title || data.nextIssue || kicker}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
