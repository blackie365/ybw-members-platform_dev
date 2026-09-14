import { describe, it, expect } from 'vitest';
import { normalizeMagazinePageContent } from '../magazine-utils';

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
