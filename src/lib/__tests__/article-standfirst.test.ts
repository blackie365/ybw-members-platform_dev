import { describe, expect, it } from 'vitest';

import { getArticleStandfirst } from '../news/article-standfirst';

describe('getArticleStandfirst', () => {
  it('trims an excerpt to the first complete sentence', () => {
    const standfirst = getArticleStandfirst({
      custom_excerpt: 'A major Leeds deal reveals fresh confidence in the city centre office market as investors return',
      html: '<p>A major Leeds deal reveals fresh confidence in the city centre office market.</p><p>Second paragraph.</p>',
    });

    expect(standfirst).toBe('A major Leeds deal reveals fresh confidence in the city centre office market.');
  });

  it('falls back to the first paragraph when no excerpt exists', () => {
    const standfirst = getArticleStandfirst({
      html: '<p>Some of the world&apos;s most extraordinary road journeys already exist.</p><p>More follows.</p>',
    });

    expect(standfirst).toBe("Some of the world's most extraordinary road journeys already exist.");
  });

  it('keeps a fully punctuated excerpt as-is', () => {
    const standfirst = getArticleStandfirst({
      custom_excerpt: 'This is already finished.',
      html: '<p>Ignored paragraph.</p>',
    });

    expect(standfirst).toBe('This is already finished.');
  });

  it('adds a full stop when the excerpt has no clean sentence ending', () => {
    const standfirst = getArticleStandfirst({
      custom_excerpt: 'Quiet growth across the region',
      html: '<p>Fallback paragraph without punctuation</p>',
    });

    expect(standfirst).toBe('Quiet growth across the region.');
  });
});
