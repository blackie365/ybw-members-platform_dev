import { describe, expect, it } from 'vitest';

import { prepareArticleBodyHtml, stripRepeatedLeadParagraph } from '../news/article-body';

describe('article body preparation', () => {
  it('removes a repeated lead paragraph when it matches the standfirst', () => {
    const html = '<p>Lead paragraph.</p><p>Second paragraph.</p>';

    expect(stripRepeatedLeadParagraph(html, 'Lead paragraph.')).toBe('<p>Second paragraph.</p>');
  });

  it('keeps the opening paragraph when it differs from the standfirst', () => {
    const html = '<p>Lead paragraph.</p><p>Second paragraph.</p>';

    expect(stripRepeatedLeadParagraph(html, 'Different standfirst.')).toBe(html);
  });

  it('sanitizes unsafe markup after removing duplicate lead text', () => {
    const html = '<p>Lead paragraph.</p><script>alert(1)</script><p>Second paragraph.</p>';

    expect(prepareArticleBodyHtml(html, 'Lead paragraph.')).toBe('<p>Second paragraph.</p>');
  });
});
