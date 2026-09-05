/**
 * DOM-free block splitting helpers for the magazine spread renderers.
 * Kept in a plain module (no JSX, no "use client") so they are unit-testable
 * under Vitest and are shared identically by the server and client bundles
 * (the old client-only DOMParser branch in shared.tsx could diverge from the
 * server's textual splitter and drop standalone <h2>/<ul>/… whenever a <p>
 * was also present).
 */

export function normalizeRichTextForCompare(value: string): string {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function dedupeTextBlocks(blocks: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const block of Array.isArray(blocks) ? blocks : []) {
    const normalized = normalizeRichTextForCompare(block);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(block);
  }

  return deduped;
}

export function splitPlainTextIntoParagraphs(input: string): string[] {
  const normalized = String(input || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!normalized.trim()) return [];

  // A hard newline is an explicit break the author typed (Press Enter in the
  // Editorial Body textarea). Honour it: each non-empty line becomes its own
  // paragraph so the rendered broadsheet skips a line between them. We do NOT
  // merge lines with a heuristic ("sentence punctuation + capital next") —
  // that collapsed real paragraph breaks whenever a line didn't happen to end
  // in .!? or start with a capital, which is exactly the reported bug.
  const lines = normalized
    .split(/\n/g)
    .map((line) => line.replace(/^\s+|\s+$/g, ""))
    .filter(Boolean);
  if (lines.length === 0) return [];
  return lines;
}

const BLOCK_START = /^<(p|h[1-6]|pre|ul|ol|blockquote|figure|table|hr)\b[^>]*>/i;
const BR_SPLITTABLE_BLOCK = /^<(p|h[1-6]|pre)\b[^>]*>/i;
const BLOCK_START_SEARCH = /<(?:p|h[1-6]|pre|ul|ol|blockquote|figure|table|hr)[\s>/]/i;
const BR_SEPARATOR = /\s*<br\s*\/?>\s*/gi;

function closeOpenBlock(segment: string): string {
  const match = segment.match(/^\s*<(p|h[1-6]|pre|ul|ol|blockquote)\b[^>]*>/i);
  if (!match) return `<p>${segment}</p>`;
  return `${segment}</${match[1].toLowerCase()}>`;
}

/**
 * Split an HTML string into block-level fragments without a DOM, shared by the
 * server renderer and the client (so hydration can never diverge).
 *
 *  - fully-formed `<p>/<h1-6>/<ul>/<ol>/<blockquote>/<figure>/<table>` blocks
 *    are kept whole and are never wrapped inside another `<p>`
 *  - `<hr>` becomes its own block
 *  - a `<br>` acts as a paragraph boundary (a spacer = a new paragraph)
 *  - any other run of text / inline tags (e.g. a bare `<strong>…</strong>`
 *    or `<span>…</span>`) becomes a single `<p>` so the container's block
 *    rules still apply
 */
export function splitHtmlIntoBlocks(html: string): string[] {
  const normalized = String(html || "").replace(/\r\n/g, "\n");
  const blocks: string[] = [];
  let rest = normalized;

  const pushParagraphs = (text: string) => {
    for (const chunk of text.split(BR_SEPARATOR)) {
      const segment = chunk.trim();
      if (!segment) continue;
      blocks.push(closeOpenBlock(segment));
    }
  };

  while (rest) {
    const start = rest.match(BLOCK_START);
    if (!start) {
      const nextStart = rest.search(BLOCK_START_SEARCH);
      const head = (nextStart === -1 ? rest : rest.slice(0, nextStart)).trim();
      pushParagraphs(head);
      if (nextStart === -1) return blocks;
      rest = rest.slice(nextStart);
      continue;
    }

    const tag = start[1].toLowerCase();
    const openLength = start[0].length;

    if (tag === "hr") {
      blocks.push("<hr />");
      rest = rest.slice(openLength);
      continue;
    }

    const closeRel = rest
      .slice(openLength)
      .search(new RegExp(`</${tag}\\s*>`, "i"));
    if (closeRel === -1) {
      pushParagraphs(rest.trim());
      return blocks;
    }

    const closeStart = openLength + closeRel;
    const closeMatch = rest.slice(closeStart).match(/^<\/[^>]*>/i);
    const blockEnd = closeStart + (closeMatch ? closeMatch[0].length : 0);
    const blockText = rest.slice(0, blockEnd).trim();

    if (BR_SPLITTABLE_BLOCK.test(start[0]) && /<br\s*\/?>/i.test(blockText)) {
      // A <br> inside a paragraph/heading is a paragraph boundary.
      const inner = blockText
        .replace(/^<[^>]+>\s*/i, "")
        .replace(/\s*<\/[^>]+>$/i, "");
      pushParagraphs(inner);
    } else {
      blocks.push(blockText);
    }

    rest = rest.slice(blockEnd);
  }

  return blocks.filter(Boolean);
}

export function getHtmlBlocks(html: string): string[] {
  if (!html) return [];
  const hasTags = html.includes("<");
  const normalizedRaw = html.replace(/\r\n/g, "\n");

  if (hasTags && !html.includes("<p") && normalizedRaw.includes("\n")) {
    const paragraphs = splitPlainTextIntoParagraphs(normalizedRaw);
    if (paragraphs.length > 1) {
      return dedupeTextBlocks(
        paragraphs.map((paragraph) => `<p>${paragraph}</p>`),
      );
    }
  }

  if (!hasTags) {
    const paragraphs = splitPlainTextIntoParagraphs(normalizedRaw);
    if (paragraphs.length === 0) return [];
    return dedupeTextBlocks(
      paragraphs.map((paragraph) => `<p>${paragraph}</p>`),
    );
  }

  // One shared, DOM-free block splitter runs on the server AND the client, so
  // the hydrated DOM can never diverge from the SSR'd HTML. The toolbar
  // inserts raw tags: <strong>/<em>/<span …> stay inline, while each
  // <p>/<h2>/<h3>/<ul>/<ol>/<blockquote> becomes exactly one block.
  const tagBlocks = splitHtmlIntoBlocks(normalizedRaw);
  if (tagBlocks.length > 0) return dedupeTextBlocks(tagBlocks);

  const parts = normalizedRaw
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return dedupeTextBlocks([html]);
  return dedupeTextBlocks(parts);
}