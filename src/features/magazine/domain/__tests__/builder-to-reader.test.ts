import { describe, it, expect } from 'vitest';
import type { ReaderPage } from '../types';
import { mapBuilderIssueToReaderEdition, mergeClassifiedsIntoPages } from '../builder-to-reader';

function builderIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 'issue_1',
    title: 'Test Edition',
    description: 'A test edition',
    publishDate: '2026-08-16T00:00:00.000Z',
    heroImage: '',
    coverImage: '',
    pdfUrl: '',
    isLatest: false,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function builderPage(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    docId: 'page_doc_1',
    type: 'feature',
    title: 'Feature Story',
    position: 1,
    content: {
      title: 'Feature Story',
      body: 'Body text.',
      videoUrl: '',
      heroImage: '',
      imageUrl: '',
    },
    ...overrides,
  };
}

describe('mapBuilderIssueToReaderEdition', () => {
  it('carries videoUrl through into the reader page content', () => {
    const edition = mapBuilderIssueToReaderEdition(builderIssue(), [
      builderPage({
        type: 'feature',
        content: {
          title: 'Feature Story',
          body: 'Body text.',
          videoUrl: 'https://admin.yorkshirebusinesswoman.co.uk/content/media/2026/09/Reel-5.mp4',
        },
      }),
    ]);

    expect(edition.pages).toHaveLength(1);
    expect(edition.pages[0].content.videoUrl).toBe(
      'https://admin.yorkshirebusinesswoman.co.uk/content/media/2026/09/Reel-5.mp4',
    );
  });

  it('leaves videoUrl undefined when the builder page has none', () => {
    const edition = mapBuilderIssueToReaderEdition(builderIssue(), [
      builderPage({ content: { title: 'Cover', heroImage: 'https://example.com/c.jpg' } }),
    ]);

    expect(edition.pages[0].content.videoUrl).toBeUndefined();
  });
});

function readerPage(overrides: Record<string, unknown> = {}): ReaderPage {
  return {
    id: 'page-1',
    position: 1,
    template: 'feature-full',
    content: { title: 'A Story', body: 'Body.' },
    ...overrides,
  } as ReaderPage;
}

function classyEntries() {
  return [
    { company: 'Acme Ltd', category: 'Business' },
    { company: 'Beacon Co', category: 'Legal' },
  ];
}

describe('mergeClassifiedsIntoPages', () => {
  const frozen: ReaderPage = {
    id: 'classifieds',
    position: 0,
    template: 'classifieds',
    content: {
      title: 'Classifieds',
      body: '',
      kicker: 'Business Directory',
      entries: classyEntries(),
    },
  };

  it('replaces a builder "Classifieds" placeholder page instead of duplicating it', () => {
    const pages = [
      readerPage({ id: '1', position: 1, template: 'feature-full', content: { title: 'Story One' } }),
      readerPage({
        id: '29',
        position: 2,
        template: 'feature-full',
        content: { title: 'Classifieds', body: '' },
      }),
      readerPage({ id: '30', position: 3, template: 'back-cover', content: { title: 'Next Edition' } }),
    ];

    const merged = mergeClassifiedsIntoPages(pages, frozen as any);

    expect(merged).toHaveLength(3);
    expect(merged.map((p) => p.content.title)).toEqual(['Story One', 'Classifieds', 'Next Edition']);
    const classifieds = merged[1];
    expect(classifieds.template).toBe('classifieds');
    expect((classifieds.content as any).entries).toEqual(classyEntries());
    expect(merged.map((p) => p.position)).toEqual([1, 2, 3]);
  });

  it('is idempotent: a second merge keeps a single classifieds page', () => {
    const pages = [
      readerPage({ id: '1', position: 1, content: { title: 'Story One' } }),
      { ...frozen, position: 2 },
      readerPage({ id: '30', position: 3, template: 'back-cover', content: { title: 'Next Edition' } }),
    ];
    const once = mergeClassifiedsIntoPages(pages, frozen as any);
    const twice = mergeClassifiedsIntoPages(once, frozen as any);
    expect(twice.filter((p) => p.template === 'classifieds')).toHaveLength(1);
    expect(twice.map((p) => p.position)).toEqual([1, 2, 3]);
  });

  it('splices ahead of the back cover when no placeholder exists', () => {
    const pages = [
      readerPage({ id: '1', position: 1, content: { title: 'Story One' } }),
      readerPage({ id: '30', position: 2, template: 'back-cover', content: { title: 'Next Edition' } }),
    ];
    const merged = mergeClassifiedsIntoPages(pages, frozen as any);
    expect(merged).toHaveLength(3);
    expect(merged[1].template).toBe('classifieds');
    expect(merged[2].template).toBe('back-cover');
    expect(merged.map((p) => p.position)).toEqual([1, 2, 3]);
  });
});