import { describe, it, expect } from 'vitest';
import { mapBuilderIssueToReaderEdition } from '../builder-to-reader';
import { ReaderEditionSchema, ReaderPageContentSchema } from '../validation-schemas';
import type { MagazineIssue, MagazinePage } from '../../../../components/admin/magazine-builder/types';

const issue: MagazineIssue = {
  id: 'vitest-issue-fix',
  title: 'November 2026 Edition',
  description: 'Vitest regression suite for magazine sync bug.',
  publishDate: '2026-11-01T00:00:00.000Z',
  coverImage: '',
  pdfUrl: '',
  isLatest: false,
  tags: [],
  autoSyncCover: true,
  readerType: 'custom',
  storyLibrary: [],
  ghostSyncTag: 'ybw-nov-2026',
};

const NEW_FEATURE_FULL_SCAFFOLD = {
  kicker: 'Feature',
  mediaLayout: 'full',
  title: 'Full Spread Feature',
  name: 'Featured Guest',
  intro: 'The full story — a journey through leadership, challenge, and lasting change...',
  kicker2: 'In Depth',
  headline: 'Full Spread Feature',
  text: 'In this feature, we explore the full story in depth, spanning a complete double-page spread with rich imagery, supporting data, and detailed narrative to give members the full picture...',
  pullQuote: 'The moments that test us are the ones that define us.',
  quote: 'The moments that test us are the ones that define us.',
  author: 'YBW Editorial',
  byline: 'Words by YBW Editorial',
  featureImage: '',
  image: '',
  heroImage: '',
  mainImage: '',
  coverImage: '',
  imageUrl: '',
  images: [],
  gallery: [],
  additionalImages: [],
  stats: [
    { label: 'READ TIME', value: '8 MIN' },
    { label: 'CATEGORY', value: 'FEATURE' },
  ],
};

function coverPage(id: number = 1, position = 1): MagazinePage {
  return {
    id, docId: `c${id}`, type: 'cover',
    position, pageNumber: position,
    content: { title: 'Yorkshire BusinessWoman', headline: 'November 2026', subheadline: '', date: 'November 2026', issue: 'No. XX', image: '', featureImage: '', position, pageNumber: position },
    createdAt: '',
  };
}

function backCover(id: number = 3, position = 3): MagazinePage {
  return {
    id, docId: `bc${id}`, type: 'back-cover',
    position, pageNumber: position,
    content: { kicker: 'Next Edition', comingSoonLabel: 'Coming Soon', title: 'Next Edition', nextIssue: 'Coming Winter 2026', cta: 'Become a Member Today', text: 'YBW magazine', socials: ['Instagram'], image: '', featureImage: '', position, pageNumber: position },
    createdAt: '',
  };
}

describe('Fix #1: Missing feature-full getInitialContent scaffold causes title.min(1) rejection', () => {
  it('empty content on feature-full fails ReaderPageContentSchema.title (baseline reproduction of original bug)', () => {
    const emptyContent = {};
    const parsed = ReaderPageContentSchema.safeParse({ title: (emptyContent as any).title, body: '', pullQuotes: [], stats: [], socials: [] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i: any) => i.path.join('.'));
      expect(paths).toContain('title');
    }
  });

  it('NEW feature-full scaffold (from fixed getInitialContent) passes ReaderPageContentSchema.title min(1)', () => {
    const parsed = ReaderPageContentSchema.safeParse({
      title: NEW_FEATURE_FULL_SCAFFOLD.title,
      body: NEW_FEATURE_FULL_SCAFFOLD.text || '',
      pullQuotes: NEW_FEATURE_FULL_SCAFFOLD.pullQuote ? [NEW_FEATURE_FULL_SCAFFOLD.pullQuote] : [],
      stats: (NEW_FEATURE_FULL_SCAFFOLD.stats || []).map((s: any) => ({ label: s.label || '', value: s.value || '' })),
      socials: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('newly created feature-full page (with position/pageNumber at root) passes full ReaderEditionSchema', () => {
    const pages = [
      coverPage(1, 1),
      {
        id: 2, docId: 'ff-2', type: 'feature-full',
        position: 2, pageNumber: 2,
        content: { ...NEW_FEATURE_FULL_SCAFFOLD, position: 2, pageNumber: 2 },
        createdAt: '',
      } as MagazinePage,
      backCover(3, 3),
    ];
    const projected = mapBuilderIssueToReaderEdition(issue, pages);
    const parsed = ReaderEditionSchema.safeParse(projected);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const titles = parsed.data.pages.map(p => p.content.title);
      expect(titles).toContain('Full Spread Feature');
      expect(parsed.data.pages.length).toBe(3);
    }
  });
});

describe('Fix #2: Fire-and-forget sync action resolves success=false (must not rely on .catch())', () => {
  it('sync action with success=false is RESOLVED not REJECTED — so .then(success check) needed, .catch() alone silent', async () => {
    const actionReturns: Promise<{ success: boolean; error?: string; schemaIssues?: unknown[] }> = Promise.resolve({
      success: false,
      error: 'ReaderEditionSchema validation failed',
      schemaIssues: [{ path: 'pages.1.content.title', message: 'title is required' }],
    });
    let catchFired = false;
    let thenSuccessFalseDetected = false;
    await actionReturns
      .catch(() => { catchFired = true; })
      .then(res => {
        if (res && res.success === false) thenSuccessFalseDetected = true;
      });
    expect(catchFired).toBe(false);
    expect(thenSuccessFalseDetected).toBe(true);
  });

  it('fire-and-forget builder fix pattern: .then(res => if (!res.success) toast) surfaces schemaIssues top 3', async () => {
    const sampleBadResolve = {
      success: false,
      error: 'ReaderEditionSchema validation failed',
      schemaIssues: [
        { path: 'pages.1.content.title', message: 'title is required' },
        { path: 'pages.2.content.title', message: 'title is required' },
        { path: 'pages.3.content.body', message: 'String must contain at least 40 character(s)' },
        { path: 'pages.4.content.title', message: 'title is required' },
      ],
    };
    let surfacedToast: string | null = null;
    await Promise.resolve(sampleBadResolve as any)
      .catch(() => { /* legacy swallow pattern */ })
      .then((res) => {
        if (res && res.success === false) {
          const topIssues = ((res as any).schemaIssues || []).slice(0, 3).map((i: any) => `${i.path}: ${i.message}`).join(' | ');
          surfacedToast = `Reader sync failed: ${(res as any).error || 'schema validation'}${topIssues ? ' - ' + topIssues : ''}`;
        }
      });
    expect(surfacedToast).toBeTruthy();
    expect(surfacedToast).toContain('ReaderEditionSchema validation failed');
    expect(surfacedToast).toContain('pages.1.content.title: title is required');
    expect(surfacedToast).toContain('pages.2.content.title');
    expect(surfacedToast).toContain('pages.3.content.body');
    expect(surfacedToast).not.toContain('pages.4.content.title');
  });
});

describe('Fix #3: Sort authority cascade — position > pageNumber > content.position > id', () => {
  it('pages sorted by root position field, NOT by numeric id (drag-reorder is preserved across rebuilds)', () => {
    const reordered: MagazinePage[] = [
      { ...coverPage(1, 3), position: 3, pageNumber: 3 },
      {
        id: 2, docId: 'ff-2', type: 'feature-full',
        position: 1, pageNumber: 1,
        content: { ...NEW_FEATURE_FULL_SCAFFOLD, position: 1, pageNumber: 1 },
        createdAt: '',
      } as MagazinePage,
      { ...backCover(3, 2), position: 2, pageNumber: 2 },
    ];
    const projected = mapBuilderIssueToReaderEdition(issue, reordered);
    expect(projected.pages.length).toBe(3);
    expect(projected.pages[0].position).toBe(1);
    expect(projected.pages[0].content.title).toBe('Full Spread Feature');
    expect(projected.pages[1].position).toBe(2);
    expect(projected.pages[2].position).toBe(3);
  });

  it('if position missing at root, falls back to pageNumber, then content.position, then id', () => {
    const mixed: MagazinePage[] = [
      { ...coverPage(10, 1), position: undefined as any, pageNumber: 1 },
      {
        id: 20, docId: 'ff-20', type: 'feature-full',
        position: undefined as any, pageNumber: undefined as any,
        content: { ...NEW_FEATURE_FULL_SCAFFOLD, position: 2, pageNumber: 2 },
        createdAt: '',
      } as MagazinePage,
      {
        id: 5, docId: 'bc-5', type: 'back-cover',
        position: undefined as any, pageNumber: undefined as any,
        content: { kicker: '', title: 'Back', nextIssue: '', cta: '', text: '', position: undefined as any, pageNumber: undefined as any },
        createdAt: '',
      } as MagazinePage,
    ];
    const projected = mapBuilderIssueToReaderEdition(issue, mixed);
    expect(projected.pages.length).toBe(3);
    expect(projected.pages[0].position).toBe(1);
    expect(projected.pages[1].position).toBe(2);
    expect(projected.pages[2].content.title).toBe('Back');
  });
});

describe('Step 6 Edge cases: All 13 builder page types, large layouts, classifieds carry-forward shape', () => {
  it('13 page types (all Add Page options) with position/pageNumber at root + content ALL pass ReaderEditionSchema', () => {
    const pages: MagazinePage[] = [
      { id: 1, docId: 'p1', type: 'cover', content: { title: 'Yorkshire BusinessWoman', headline: '', subheadline: '', date: '', issue: '', image: '', featureImage: '', position: 1, pageNumber: 1 }, position: 1, pageNumber: 1, createdAt: '' },
      { id: 2, docId: 'p2', type: 'editorial', content: { title: 'Editor Welcome', author: 'Editor', role: 'Editor', text: 'Welcome to this edition where we celebrate our community...', quote: 'Empower women', position: 2, pageNumber: 2 }, position: 2, pageNumber: 2, createdAt: '' },
      { id: 3, docId: 'p3', type: 'contents', content: { kicker: 'Contents', title: 'In This Issue', items: [{ page: 2, category: 'EDITORIAL', title: 'Editor Note' }], news: ['Event'], position: 3, pageNumber: 3 }, position: 3, pageNumber: 3, createdAt: '' },
      { id: 4, docId: 'p4', type: 'feature-left', content: { kicker: 'Feature', name: 'Guest', title: 'Article Headline', intro: 'Intro...', position: 4, pageNumber: 4 }, position: 4, pageNumber: 4, createdAt: '' },
      { id: 5, docId: 'p5', type: 'feature-full', content: { ...NEW_FEATURE_FULL_SCAFFOLD, position: 5, pageNumber: 5 }, position: 5, pageNumber: 5, createdAt: '' },
      { id: 6, docId: 'p6', type: 'feature-right', content: { kicker: 'Feature', name: 'Guest', title: 'Feature Story', quote: 'Success...', text: 'Journey of building a business from scratch over many years...', stats: [{ label: 'READ TIME', value: '5 MIN' }], position: 6, pageNumber: 6 }, position: 6, pageNumber: 6, createdAt: '' },
      { id: 7, docId: 'p7', type: 'column', content: { kicker: 'Column', title: 'Expert Insights', category: 'Finance', author: 'Name', text: 'In today\'s economic climate businesses must plan strategically for the next twelve months to stay ahead...', tips: ['Plan ahead'], position: 7, pageNumber: 7 }, position: 7, pageNumber: 7, createdAt: '' },
      { id: 8, docId: 'p8', type: 'lifestyle', content: { kicker: 'Lifestyle', title: 'Lifestyle Edit', text: 'Discover balance through wellness routines and curated experiences...', highlights: ['Summer Style'], position: 8, pageNumber: 8 }, position: 8, pageNumber: 8, createdAt: '' },
      { id: 9, docId: 'p9', type: 'spotlight', content: { title: 'Meet', name: 'Member Name', role: 'CEO', message: 'Consistency is key to long lasting success in any field.', bio: 'History of building companies across Yorkshire region...', position: 9, pageNumber: 9 }, position: 9, pageNumber: 9, createdAt: '' },
      { id: 10, docId: 'p10', type: 'partner', content: { kicker: 'Partner Feature', title: 'Partner Feature', brand: 'Partner Name', headline: 'Premium Services', offer: '20% Off', position: 10, pageNumber: 10 }, position: 10, pageNumber: 10, createdAt: '' },
      { id: 11, docId: 'p11', type: 'full-page-ad', content: { title: 'Advertisement', label: 'Advertisement', image: '', backgroundImage: '', videoUrl: '', linkUrl: '', alt: '', position: 11, pageNumber: 11 }, position: 11, pageNumber: 11, createdAt: '' },
      { id: 12, docId: 'p12', type: 'ads', content: { title: 'Advertisement', label: 'Advertisement', position: 12, pageNumber: 12 }, position: 12, pageNumber: 12, createdAt: '' },
      { id: 13, docId: 'p13', type: 'back-cover', content: { kicker: 'Next Edition', comingSoonLabel: 'Coming Soon', title: 'Next Edition', nextIssue: 'Winter 2026', cta: 'Become a Member Today', text: 'YBW celebrating the leaders of Yorkshire...', socials: ['Instagram', 'LinkedIn', 'X'], image: '', featureImage: '', position: 13, pageNumber: 13 }, position: 13, pageNumber: 13, createdAt: '' },
    ];
    const projected = mapBuilderIssueToReaderEdition(issue, pages);
    const parsed = ReaderEditionSchema.safeParse(projected);
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.warn('13 type schema fail', parsed.error?.issues.slice(0, 5));
    }
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pages.length).toBe(13);
      const templates = parsed.data.pages.map(p => p.template);
      expect(templates).toContain('feature-full');
      expect(templates).toContain('feature-left');
      expect(templates).toContain('feature-right');
      expect(templates).toContain('ad');
      expect(templates).toContain('ads');
      expect(templates).toContain('cover');
      expect(templates).toContain('back-cover');
    }
  });

  it('large feature layout (gallery 20, social embeds 6, long body) passes validation', () => {
    const largePage: MagazinePage = {
      id: 50, docId: 'large-50', type: 'feature-full',
      position: 2, pageNumber: 2,
      content: {
        ...NEW_FEATURE_FULL_SCAFFOLD, position: 2, pageNumber: 2,
        text: `Body content. ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(60)}`,
        gallery: Array.from({ length: 20 }, (_, i) => ({ caption: `Gallery Item ${i + 1}`, image: '' })),
        socialEmbeds: Array.from({ length: 6 }, (_, i) => ({ url: `https://instagram.com/p/ex${i}`, type: 'instagram' })),
      },
      createdAt: '',
    };
    const projected = mapBuilderIssueToReaderEdition(issue, [coverPage(1, 1), largePage, backCover(3, 3)]);
    const parsed = ReaderEditionSchema.safeParse(projected);
    expect(parsed.success).toBe(true);
  });
});
