import { describe, it, expect } from 'vitest';
import {
  applyMagazineAdsToEdition,
  normalizeMagazineAdRecord,
  resolveAdFormat,
  sortMagazineAds,
  toCreative,
} from '../magazine-ads';

const CATALOG = [
  { id: 'ad-1', label: 'Quilter', image: 'https://img/qc.jpg', url: 'https://qc.example', alt: 'Advertisement', enabled: true, position: 0 },
  { id: 'ad-2', label: 'Acme', image: 'https://img/acme.jpg', url: 'https://acme.example', alt: 'Sponsored', enabled: true, position: 1 },
];

function spreadPage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'page-4',
    position: 4,
    template: 'feature-right',
    content: {
      title: 'A feature',
      body: 'Some copy.',
      pullQuotes: ['A quote.'],
      ...(overrides.content || {}),
    },
    ...overrides,
  };
}

describe('resolveAdFormat', () => {
  it('lets an explicit format win', () => {
    expect(resolveAdFormat('leaderboard', 'sidebarMpu-123')).toBe('leaderboard');
    expect(resolveAdFormat('square', 'headerLeaderboard')).toBe('square');
    expect(resolveAdFormat('mpu', 'headerLeaderboard')).toBe('mpu');
  });

  it('derives from the site slot name when no explicit format is set', () => {
    expect(resolveAdFormat(undefined, 'headerLeaderboard')).toBe('leaderboard');
    expect(resolveAdFormat(undefined, 'ads/headerLeaderboard')).toBe('leaderboard');
    expect(resolveAdFormat(undefined, 'sidebarMpu-123')).toBe('mpu');
    expect(resolveAdFormat(undefined, 'midArticle')).toBe('mpu');
    expect(resolveAdFormat(undefined, 'skyscraper')).toBe('mpu');
  });

  it('falls back to mpu for unknown ids and empty input', () => {
    expect(resolveAdFormat(undefined, 'ad-1')).toBe('mpu');
    expect(resolveAdFormat(undefined, undefined)).toBe('mpu');
  });
});

describe('normalizeMagazineAdRecord', () => {
  it('reads image/url/alt/label from the stored record', () => {
    const r = normalizeMagazineAdRecord({ id: 'a', label: 'X', image: 'https://x/i.jpg', url: 'https://x', alt: 'Ad' });
    expect(r).toEqual({ id: 'a', label: 'X', image: 'https://x/i.jpg', url: 'https://x', alt: 'Ad', enabled: true, position: 0, format: 'mpu' });
  });

  it('handles legacy field names (imageUrl/linkUrl/altText)', () => {
    const r = normalizeMagazineAdRecord({ id: 'a', imageUrl: 'https://x/i.jpg', linkUrl: 'https://x', altText: 'Ad' });
    expect(r?.image).toBe('https://x/i.jpg');
    expect(r?.url).toBe('https://x');
    expect(r?.alt).toBe('Ad');
  });

  it('returns null when there is no image', () => {
    expect(normalizeMagazineAdRecord({ id: 'a' })).toBeNull();
    expect(normalizeMagazineAdRecord(null)).toBeNull();
    expect(normalizeMagazineAdRecord('nope')).toBeNull();
    expect(normalizeMagazineAdRecord({ id: 'a', enabled: false })).toBeNull();
  });
});

describe('sortMagazineAds', () => {
  it('orders by position then id', () => {
    const sorted = sortMagazineAds([
      { id: 'b', image: 'https://x/b.jpg', position: 2 },
      { id: 'a', image: 'https://x/a.jpg', position: 0 },
      { id: 'c', image: 'https://x/c.jpg', position: 1 },
    ]);
    expect(sorted.map((a) => a.id)).toEqual(['a', 'c', 'b']);
  });

  it('drops records with no image', () => {
    expect(sortMagazineAds([{ id: 'a', image: '' }])).toEqual([]);
  });
});

describe('toCreative', () => {
  it('maps to the rail creative shape with a derived format', () => {
    expect(toCreative(CATALOG[0])).toEqual({
      image: 'https://img/qc.jpg',
      url: 'https://qc.example',
      alt: 'Advertisement',
      label: 'Quilter',
      format: 'mpu',
    });
  });

  it('derives leaderboard format from a header slot id', () => {
    const ad = { id: 'headerLeaderboard', label: 'QC', image: 'https://img/qc.jpg', url: 'https://qc.example', alt: 'Ad' };
    expect(toCreative(ad).format).toBe('leaderboard');
  });
});

describe('applyMagazineAdsToEdition', () => {
  it('returns the edition untouched when there are no pages', () => {
    const edition = { id: 'e', pages: [] };
    expect(applyMagazineAdsToEdition(edition, CATALOG)).toBe(edition);
  });

  it('does not mutate the input edition or pages', () => {
    const edition = { id: 'e', pages: [spreadPage()] };
    const next = applyMagazineAdsToEdition(edition, CATALOG) as any;
    expect(next).not.toBe(edition);
    expect(next.pages).not.toBe(edition.pages);
    expect(next.pages[0]).not.toBe(edition.pages[0]);
    expect((edition.pages[0].content as any).ads).toBeUndefined();
  });

  it('leaves non-spread templates alone', () => {
    const edition = { id: 'e', pages: [{ id: 'p1', template: 'cover', content: {} }] };
    const next = applyMagazineAdsToEdition(edition, CATALOG) as any;
    expect(next.pages[0]).toEqual({ id: 'p1', template: 'cover', content: {} });
  });

  it('default-fills a quote-rail spread with one slot per catalog creative (header + rail), capped at 2', () => {
    const edition = { id: 'e', pages: [spreadPage()] };
    const next = applyMagazineAdsToEdition(edition, CATALOG) as any;
    expect(next.pages[0].content.adSlots).toBe(2);
    expect(next.pages[0].content.ads).toEqual([
      toCreative(CATALOG[0]),
      toCreative(CATALOG[1]),
    ]);
  });

  it('puts a leaderboard creative first so it lands in the header, plus one rail ad', () => {
    const lead = { id: 'ads/headerLeaderboard', label: 'QC', image: 'https://img/qc.jpg', url: 'https://qc.example', alt: 'Ad', enabled: true, position: 0 };
    const mpu = { ...CATALOG[1], position: 1 };
    const edition = { id: 'e', pages: [spreadPage()] };
    const next = applyMagazineAdsToEdition(edition, [lead, mpu]) as any;
    expect(next.pages[0].content.ads).toEqual([toCreative(lead), toCreative(mpu)]);
    expect(next.pages[0].content.ads[0].format).toBe('leaderboard');
    expect(next.pages[0].content.ads[1].format).toBe('mpu');
  });

  it('default-fills a single header slot when the catalog only has a leaderboard', () => {
    const lead = { id: 'ads/headerLeaderboard', label: 'QC', image: 'https://img/qc.jpg', url: 'https://qc.example', alt: 'Ad', enabled: true, position: 0 };
    const edition = { id: 'e', pages: [spreadPage()] };
    const next = applyMagazineAdsToEdition(edition, [lead]) as any;
    expect(next.pages[0].content.adSlots).toBe(1);
    expect(next.pages[0].content.ads[0].format).toBe('leaderboard');
  });

  it('leaves quote-rail spreads alone when the catalog has no enabled creative', () => {
    const edition = {
      id: 'e',
      pages: [spreadPage({ content: { pullQuotes: undefined } })],
    };
    const emptyCatalog = [{ id: 'a', image: 'https://x/a.jpg', enabled: false }];
    const next = applyMagazineAdsToEdition(edition, emptyCatalog) as any;
    expect(next.pages[0].content.ads).toBeUndefined();
  });

  it('does not default-fill a spread without a quote rail', () => {
    const edition = {
      id: 'e',
      pages: [spreadPage({ content: { pullQuotes: undefined } })],
    };
    const next = applyMagazineAdsToEdition(edition, CATALOG) as any;
    expect(next.pages[0].content.ads).toBeUndefined();
  });

  it('respects an explicit content.ads override and derives its format', () => {
    const explicit = { id: 'ads/headerLeaderboard', image: 'https://x/explicit.jpg', url: 'https://x/x', alt: 'X', label: 'X' };
    const edition = {
      id: 'e',
      pages: [spreadPage({ content: { pullQuotes: undefined, ads: [explicit] } })],
    };
    const next = applyMagazineAdsToEdition(edition, CATALOG) as any;
    expect(next.pages[0].content.ads).toEqual([
      { image: 'https://x/explicit.jpg', url: 'https://x/x', alt: 'X', label: 'X', format: 'leaderboard' },
    ]);
    expect(next.pages[0].content.adSlots).toBe(1);
  });

  it("never overrides an explicit empty ads array (a conscious 'no ads here')", () => {
    const edition = {
      id: 'e',
      pages: [spreadPage({ content: { pullQuotes: ['q'], ads: [] } })],
    };
    const next = applyMagazineAdsToEdition(edition, CATALOG) as any;
    expect(next.pages[0].content).toEqual(next.pages[0].content);
    expect(next.pages[0].content.ads).toEqual([]);
  });

  it('honours an explicit adSlots count, filling from the catalog and cycling creative', () => {
    const edition = {
      id: 'e',
      pages: [spreadPage({ content: { pullQuotes: undefined, adSlots: 3 } })],
    };
    const next = applyMagazineAdsToEdition(edition, CATALOG) as any;
    expect(next.pages[0].content.adSlots).toBe(3);
    expect(next.pages[0].content.ads).toEqual([
      toCreative(CATALOG[0]),
      toCreative(CATALOG[1]),
      toCreative(CATALOG[0]),
    ]);
  });

  it('caps slots at 6', () => {
    const edition = {
      id: 'e',
      pages: [spreadPage({ content: { pullQuotes: undefined, adSlots: 99 } })],
    };
    const next = applyMagazineAdsToEdition(edition, CATALOG) as any;
    expect(next.pages[0].content.adSlots).toBe(6);
    expect(next.pages[0].content.ads).toHaveLength(6);
  });

  it('fills reserved (empty-creative) slots one-for-one even with an empty catalog', () => {
    const edition = {
      id: 'e',
      pages: [spreadPage({ content: { pullQuotes: undefined, adSlots: 2 } })],
    };
    const next = applyMagazineAdsToEdition(edition, []) as any;
    expect(next.pages[0].content.adSlots).toBe(2);
    expect(next.pages[0].content.ads).toHaveLength(2);
    expect(next.pages[0].content.ads[0].image).toBe('');
  });

  it('returns null/undefined editions as-is', () => {
    expect(applyMagazineAdsToEdition(null, CATALOG)).toBeNull();
    expect(applyMagazineAdsToEdition(undefined, CATALOG)).toBeUndefined();
  });
});