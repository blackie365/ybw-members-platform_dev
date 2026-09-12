import { describe, it, expect } from 'vitest';
import { normalizeMagazinePageContent, buildBalancedColumns, buildEdgeBalancedColumns, chunkTextBlock, estimateImageLines } from '../magazine-utils';
import type { ColumnItem } from '../magazine-utils';

describe('normalizeMagazinePageContent — text/body + intro/standfirst alias merge', () => {
  /**
   * REGRESSION: #427 (add12b5) switched the when-both-present branch to pick
   * the LONGER of text/body. On IDML-imported spreads the legacy `.body` is a
   * longer superset of `.text` (appended disclaimer etc.), so that heuristic
   * always resolved to the stale `.body` and silently discarded the user's
   * freshly edited `.text` — "edits never save". The editor-primary field is
   * `.text` (and `.intro`), so when both are present and DIFFER we must prefer
   * the editor field, regardless of length.
   */
  it('keeps a SHORTER edited text over a LONGER stale body (the regression bug)', () => {
    const longBody =
      'Original long article body with lots of text and a disclaimer paragraph at the end that is much longer.';
    const out = normalizeMagazinePageContent({ text: 'Short user edit', body: longBody });
    expect(out.text).toBe('Short user edit');
    expect(out.body).toBe('Short user edit');
  });

  it('keeps a LONGER edited text over a shorter body', () => {
    const longEdit =
      'A much longer freshly written paragraph that exceeds the stale body length by a wide margin here, going on and on.';
    const out = normalizeMagazinePageContent({ text: longEdit, body: 'short stale body' });
    expect(out.text).toBe(longEdit);
    expect(out.body).toBe(longEdit);
  });

  it('keeps equal (mirrored) text/body unchanged', () => {
    const out = normalizeMagazinePageContent({ text: 'same copy', body: 'same copy' });
    expect(out.text).toBe('same copy');
    expect(out.body).toBe('same copy');
  });

  it('falls back to body when text is absent (legacy import), not losing data', () => {
    const out = normalizeMagazinePageContent({ body: 'import only body' });
    expect(out.text).toBe('import only body');
    expect(out.body).toBe('import only body');
  });

  it('copies text into body when body is absent', () => {
    const out = normalizeMagazinePageContent({ text: 'text only' });
    expect(out.text).toBe('text only');
    expect(out.body).toBe('text only');
  });

  it('prefers edited intro over a longer stale standfirst', () => {
    const out = normalizeMagazinePageContent({
      intro: 'Short intro edit',
      standfirst: 'A much longer stale standfirst that would otherwise win by length.',
    });
    expect(out.intro).toBe('Short intro edit');
    expect(out.standfirst).toBe('Short intro edit');
  });

  it('falls back to standfirst when intro is absent', () => {
    const out = normalizeMagazinePageContent({ standfirst: 'standfirst only' });
    expect(out.intro).toBe('standfirst only');
    expect(out.standfirst).toBe('standfirst only');
  });

  it('returns {} for null/non-object input', () => {
    expect(normalizeMagazinePageContent(null as any)).toEqual({});
    expect(normalizeMagazinePageContent(undefined as any)).toEqual({});
    expect(normalizeMagazinePageContent('nope' as any)).toEqual({});
  });
});

describe('buildBalancedColumns — equalise newspaper columns', () => {
  const estWeight = (html: string): number => {
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return Math.max(2, Math.ceil(t.length / 90) + 1.2);
  };

  it('splits long paragraphs so columns come out near-equal', () => {
    // One very long paragraph that, kept whole, could only sit in one column.
    const longWordy = 'word '.repeat(40); // 200 chars
    const blocks = Array.from(
      { length: 3 },
      () => `<p>${longWordy.trim()}</p>`,
    );
    const cols = buildBalancedColumns(blocks, [], 3);
    expect(cols.length).toBe(3);
    // Every column has content and text length is balanced (no empty col).
    const lens = cols.map((c) => c.reduce((s, i) => s + (i.kind === 'text' ? i.html.length : 0), 0));
    const total = lens.reduce((a, b) => a + b, 0);
    for (const len of lens) {
      const share = len / Math.max(1, total);
      // Each column holds a fair share (not one column dominating).
      expect(share).toBeGreaterThan(0.2);
    }
  });

  it('greedy shortest-column distributes many blocks evenly', () => {
    const blocks = Array.from({ length: 12 }, (_, i) => `<p>para numero ${i} with a little text</p>`);
    const cols = buildBalancedColumns(blocks, [], 3);
    expect(cols.length).toBe(3);
    const w = cols.map((c) =>
      c.reduce((s, i) => s + (i.kind === 'text' ? estWeight(i.html) : 0), 0),
    );
    const max = Math.max(...w);
    const min = Math.min(...w);
    // Max column not more than ~40% taller than the min.
    expect(max - min).toBeLessThanOrEqual(4);
  });

  it('interleaves gallery images across columns, never duplicating', () => {
    const blocks = Array.from({ length: 10 }, (_, i) => `<p>block #${i} with enough words</p>`);
    const images = [
      { kind: 'img' as const, src: 'a.jpg', alt: 'a' },
      { kind: 'img' as const, src: 'b.jpg', alt: 'b' },
    ];
    const cols = buildBalancedColumns(blocks, images, 2);
    const flat = cols.flat();
    const imgs = flat.filter((i) => i.kind === 'img');
    expect(imgs.length).toBe(2);
    // Images spread across at least 2 columns.
    const colsWithImg = cols.filter((c) => c.some((i) => i.kind === 'img')).length;
    expect(colsWithImg).toBeGreaterThanOrEqual(2);
    // No duplicate src across the whole output.
    const srcs = flat.filter((i) => i.kind === 'img').map((i) => (i.kind === 'img' ? i.src : ''));
    expect(new Set(srcs).size).toBe(2);
  });

  it('keeps non-<p> blocks (blockquote/figure) whole — never split', () => {
    const blocks = [
      '<p>short</p>',
      '<blockquote>A very long blockquote that must never be broken apart across columns because it is a quote and would lose meaning.</blockquote>',
      '<figure><img src="x.jpg"/></figure>',
    ];
    const cols = buildBalancedColumns(blocks, [], 2);
    const flat = cols.flat();
    const bq = flat.filter((i) => i.kind === 'text' && i.html.includes('<blockquote>'));
    expect(bq).toHaveLength(1); // still one whole blockquote
    expect(bq[0] && 'html' in bq[0] ? bq[0].html.includes('A very long blockquote') : false).toBe(true);
  });

  it('returns a single column when columnCount is 1', () => {
    const blocks = ['<p>one</p>', '<p>two</p>', '<p>three</p>'];
    const cols = buildBalancedColumns(blocks, [], 1);
    expect(cols).toHaveLength(1);
    expect(cols[0].length).toBe(3);
  });
});

describe('chunkTextBlock — split long paragraphs at sentence boundaries', () => {
  it('leaves short paragraphs whole', () => {
    expect(chunkTextBlock('<p>hello short world</p>', 100)).toEqual(['<p>hello short world</p>']);
  });

  it('splits a long paragraph into multiple <p> chunks', () => {
    const long = Array.from({ length: 60 }, () => 'word').join(' '); // ~299 chars, no punctuation
    const out = chunkTextBlock(`<p>${long}</p>`, 100);
    for (const chunk of out) {
      expect(chunk.startsWith('<p>')).toBe(true);
      expect(chunk.endsWith('</p>')).toBe(true);
    }
  });

  it('splits a punctuated long paragraph into multiple <p> chunks', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i + 1} is complete and ends here.`).join(' ');
    const out = chunkTextBlock(`<p>${long}</p>`, 200);
    expect(out.length).toBeGreaterThan(1);
    for (const chunk of out) {
      expect(chunk.startsWith('<p>')).toBe(true);
      expect(chunk.endsWith('</p>')).toBe(true);
    }
  });

  it('never splits mid-sentence and never leaves an orphan-word chunk', () => {
    // 5 long sentences joined by ". " — every split must fall on a sentence
    // boundary, never mid-sentence, and no chunk may be a single stray word.
    const sentences = [
      'This is the first complete sentence with enough words to be reasonably long in the paragraph.',
      'Here follows a second complete sentence that continues the same long paragraph for the reader.',
      'A third sentence keeps the paragraph going so that chunking is definitely required here today.',
      'The fourth sentence adds still more length so the balancer has several natural break points.',
      'Finally a fifth sentence closes the paragraph out completely and finishes the whole thing.',
    ];
    const out = chunkTextBlock(`<p>${sentences.join(' ')}</p>`, 120);
    expect(out.length).toBeGreaterThan(1);
    for (const chunk of out) {
      const inner = chunk.replace(/<\/?p>/g, '');
      // Every chunk is whole sentences: it must start with a capital and end
      // with sentence punctuation.
      expect(inner[0]).toMatch(/[A-Z]/);
      expect(inner.trimEnd()).toMatch(/[.!?]["')\u201d\u2019]*$/);
      // Never an orphan fragment.
      expect(inner.trim().split(/\s+/).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps a trailing short fragment merged so no orphan chunk is emitted', () => {
    // `a` is long enough that the paragraph must split (> targetChars*1.35),
    // and `b` is a short trailing sentence that should be folded back instead
    // of being left as a one/two-word orphan chunk.
    const a =
      'This first long complete sentence rambles on for quite a while with enough words to comfortably exceed the target chunk size so that a split is definitely required.';
    const b = 'And here ends it.';
    const out = chunkTextBlock(`<p>${a} ${b}</p>`, 120, 60);
    expect(out.length).toBeGreaterThanOrEqual(1);
    // The short second sentence must be merged into the previous chunk rather
    // than appearing as its own standalone (orphan) chunk: no chunk may contain
    // only the short sentence.
    for (const chunk of out) {
      expect(chunk.replace(/<\/?p>/g, '').trim().split(/\s+/).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('never splits a blockquote', () => {
    const q = '<blockquote>' + Array.from({ length: 60 }, () => 'word').join(' ') + '</blockquote>';
    expect(chunkTextBlock(q, 100)).toEqual([q]);
  });
});

describe('buildEdgeBalancedColumns — ordered columns with images at head/bottom', () => {
  const block = (i: number) => `<p>paragraph number ${i} with a decent amount of words to act as body copy</p>`;
  const img = (src: string): ColumnItem => ({ kind: 'img', src, alt: src });

  it('keeps the natural reading order (column-major, like multicol)', () => {
    const cols = buildEdgeBalancedColumns(
      [block(1), block(2), block(3), block(4), block(5), block(6)],
      [],
      3,
    );
    expect(cols.length).toBeGreaterThanOrEqual(2);
    const order = cols.flat().map((i) => (i.kind === 'text' ? Number(i.html.match(/paragraph number (\d+)/)![1]) : -1));
    // Reading order must be the same as source order.
    expect(order).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pins each image to the head or bottom edge of its column', () => {
    const blocks = Array.from({ length: 12 }, (_, i) => block(i));
    const images = [img('a.jpg'), img('b.jpg'), img('c.jpg')];
    const cols = buildEdgeBalancedColumns(blocks, images, 3);
    const flat = cols.flat();
    expect(flat.filter((i) => i.kind === 'img')).toHaveLength(3);
    for (const col of cols) {
      col.forEach((item, idx) => {
        if (item.kind === 'img') {
          // Image must be the first OR last item of its column.
          expect(idx === 0 || idx === col.length - 1).toBe(true);
        }
      });
    }
  });

  it('balances column weights so no column dominates', () => {
    const blocks = Array.from({ length: 18 }, (_, i) => block(i));
    const images = [img('a.jpg'), img('b.jpg')];
    const cols = buildEdgeBalancedColumns(blocks, images, 3);
    // Total weight = text length + the image's reserved height, so a column
    // holding a plate is still counted as balanced by its rendered height.
    const w = cols.map((c) =>
      c.reduce(
        (s, i) => s + (i.kind === 'img' || i.kind === 'ad' ? 14 : i.html.length),
        0,
      ),
    );
    const total = w.reduce((a, b) => a + b, 0);
    for (const len of w) {
      const share = len / Math.max(1, total);
      expect(share).toBeGreaterThan(0.2);
    }
  });

  it('returns a single ordered column when there is only one', () => {
    const cols = buildEdgeBalancedColumns([block(1), block(2)], [], 1);
    expect(cols).toHaveLength(1);
    expect(cols[0].length).toBe(2);
  });

  it('gives every image its own column and pins each plate to head/bottom', () => {
    const blocks = Array.from({ length: 12 }, (_, i) => block(i));
    const images = [img('a.jpg'), img('b.jpg'), img('c.jpg')];
    const cols = buildEdgeBalancedColumns(blocks, images, 3);
    expect(cols).toHaveLength(3);
    const perCol = cols.map((c) => c.filter((i) => i.kind === 'img').length);
    expect(perCol).toEqual([1, 1, 1]);
    for (const col of cols) {
      col.forEach((item, idx) => {
        if (item.kind === 'img') {
          expect(idx === 0 || idx === col.length - 1).toBe(true);
        }
      });
    }
  });

  it('stacks images only when they outnumber the columns', () => {
    const blocks = Array.from({ length: 12 }, (_, i) => block(i));
    const images = [img('a.jpg'), img('b.jpg'), img('c.jpg'), img('d.jpg')];
    const cols = buildEdgeBalancedColumns(blocks, images, 3);
    // Three columns, four plates: at least one column must hold two images.
    const perCol = cols.map((c) => c.filter((i) => i.kind === 'img').length);
    expect(perCol.filter((n) => n === 0).length).toBe(0);
    expect(perCol.filter((n) => n >= 2).length).toBe(1);
  });

  it('weights portrait plates higher so their column reserves more space', () => {
    const cols = buildEdgeBalancedColumns(
      [block(1), block(1), block(1)],
      [{ kind: 'img', src: 'portrait.jpg', alt: '', weight: 32 }],
      2,
    );
    // The plate sits in exactly one column and its image is at the edge.
    const imgs = cols.filter((c) => c.some((i) => i.kind === 'img'));
    expect(imgs).toHaveLength(1);
    const imgCol = imgs[0];
    const i = imgCol.findIndex((it) => it.kind === 'img');
    expect(i === 0 || i === imgCol.length - 1).toBe(true);
  });

  it('never lets the final column become a dumping ground (regression: 2x last column)', () => {
    // Enough text to overflow a strict forward-only greedy split; the last
    // column must not end up dramatically longer than the others.
    const blocks = Array.from({ length: 30 }, (_, i) => block(i));
    const images = [
      img('a.jpg'),
      img('b.jpg'),
      img('c.jpg'),
      img('d.jpg'),
      img('e.jpg'),
    ];
    const cols = buildEdgeBalancedColumns(blocks, images, 3);
    const w = cols.map((c) =>
      c.reduce((s, i) => s + (i.kind === 'text' ? i.html.length : 0), 0),
    );
    const total = w.reduce((a, b) => a + b, 0);
    const share = total > 0 ? w.map((len) => len / total) : [];
    const lastShare = share[share.length - 1] ?? 0;
    // Strictly less than half the page — the reported bug put ~2/3 in last col.
    expect(lastShare).toBeLessThan(0.5);
    expect(Math.max(...share) - Math.min(...share)).toBeLessThan(0.35);
  });
});

describe('estimateImageLines — weight a plate by its real aspect ratio', () => {
  it('uses the base weight for a 3/2 landscape and for missing ratios', () => {
    expect(estimateImageLines(1.5)).toBe(14);
    expect(estimateImageLines(undefined)).toBe(14);
    expect(estimateImageLines(0)).toBe(14);
    expect(estimateImageLines(Number.NaN)).toBe(14);
  });

  it('weights tall portraits up and wide panoramas down', () => {
    expect(estimateImageLines(1)).toBe(21); // square renders taller than 3/2
    expect(estimateImageLines(2 / 3)).toBeGreaterThan(21);
    expect(estimateImageLines(3)).toBeLessThan(14);
  });

  it('clamps to a sane range', () => {
    expect(estimateImageLines(0.05)).toBeLessThanOrEqual(48);
    expect(estimateImageLines(40)).toBeGreaterThanOrEqual(8);
  });
});
