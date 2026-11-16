import { describe, expect, it } from 'vitest';

import { buildArticleBodySegments } from '@/lib/news/article-body-segments';
import { generateHeuristicEnhancementDraft } from '@/lib/news/article-enhancement-generator';

describe('generateHeuristicEnhancementDraft', () => {
  it('builds safe blocks from article text already present in the source', () => {
    const draft = generateHeuristicEnhancementDraft({
      slug: 'test-story',
      title: 'Yorkshire firm expands after strong trading year',
      primary_tag: { name: 'Growth' },
      html: `
        <p>Leeds manufacturer Example Group has expanded after a strong trading year and fresh investment in its site.</p>
        <p>"We are investing for the long term and backing demand we can already see," said managing director Anna Smith.</p>
        <p>The company said revenue rose by 18% during the year and it has created 12 new roles.</p>
        <p>The business has also launched a new training programme for early-career staff.</p>
      `,
    });

    expect(draft.insertions.length).toBeGreaterThan(0);
    expect(JSON.stringify(draft)).toContain('18%');
    expect(JSON.stringify(draft)).toContain('12 new roles');
  });
});

describe('buildArticleBodySegments', () => {
  it('injects blocks after the requested paragraph', () => {
    const segments = buildArticleBodySegments(
      '<p>First paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p>',
      {
        slug: 'test-story',
        sourceHash: 'hash',
        generatedAt: new Date().toISOString(),
        generator: { mode: 'heuristic' },
        insertions: [
          {
            afterParagraph: 2,
            blocks: [{ type: 'pull_quote', quote: 'Second paragraph.', attribution: 'Source' }],
          },
        ],
      },
    );

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ kind: 'html' });
    expect(segments[1]).toMatchObject({ kind: 'block' });
    expect(segments[2]).toMatchObject({ kind: 'html' });
  });
});
