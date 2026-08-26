import { describe, it, expect } from 'vitest';
import { detectAdPage, isEditorsPage, detectArticles, mapIdmlToReaderPages, buildEditionMetadata } from '../idml-template-mapper';
import type { ParsedIdmlPage, ParsedIdmlStory } from '../idml-parser';

function makePage(overrides: Partial<ParsedIdmlPage> & { pageNumber: number }): ParsedIdmlPage {
  return {
    frames: [],
    stories: [],
    imageFileNames: [],
    labels: [],
    totalWordCount: 0,
    textPreview: '',
    logoImageFileNames: [],
    namespaceBuckets: {},
    adFrameCount: 0,
    chromeFrameCount: 0,
    explicitRoleImages: { hero: [], gallery: [], logo: [], pdf: [] },
    spreadIndex: 0,
    ...overrides,
  };
}

function makeStory(overrides: Partial<ParsedIdmlStory> & { id: string }): ParsedIdmlStory {
  return {
    path: '',
    title: '',
    text: '',
    imageHints: [],
    paragraphStyles: [],
    ...overrides,
  };
}

function makeFrame(overrides: Record<string, any> = {}) {
  return {
    frameSelf: `frame-${Math.random().toString(36).slice(2, 8)}`,
    storyId: '',
    isTitle: false,
    label: '',
    position: 'right' as const,
    order: 0,
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    rawName: '',
    namespace: '' as const,
    tags: null,
    imageFileName: null,
    ...overrides,
  };
}

describe('detectAdPage', () => {
  it('returns true for empty pages', () => {
    const page = makePage({ pageNumber: 10, frames: [], stories: [] });
    expect(detectAdPage(page)).toBe(true);
  });

  it('returns true when page has explicit AdFrame label', () => {
    const page = makePage({
      pageNumber: 10,
      labels: ['AdFrame'],
      imageFileNames: ['ad.png'],
    });
    expect(detectAdPage(page)).toBe(true);
  });

  it('returns true when page has "advert" label', () => {
    const page = makePage({
      pageNumber: 10,
      labels: ['advert'],
      imageFileNames: ['ad.png'],
    });
    expect(detectAdPage(page)).toBe(true);
  });

  it('returns false for pages with EditorsFrame label', () => {
    const story = makeStory({ id: 'e1', text: 'A short editor note.' });
    const frame = makeFrame({ storyId: 'e1' });
    const page = makePage({
      pageNumber: 5,
      labels: ['EditorsFrame'],
      frames: [frame],
      stories: [story],
      totalWordCount: 200,
    });
    expect(detectAdPage(page)).toBe(false);
  });

  it('returns false for pages with ContentsFrame label', () => {
    const story = makeStory({ id: 'c1', text: 'Contents page text.' });
    const frame = makeFrame({ storyId: 'c1' });
    const page = makePage({
      pageNumber: 3,
      labels: ['ContentsFrame'],
      frames: [frame],
      stories: [story],
      totalWordCount: 50,
    });
    expect(detectAdPage(page)).toBe(false);
  });

  it('returns false when totalWordCount >= 120', () => {
    const story = makeStory({ id: 'w1', text: 'Long article body.' });
    const frame = makeFrame({ storyId: 'w1' });
    const page = makePage({
      pageNumber: 10,
      totalWordCount: 120,
      frames: [frame],
      stories: [story],
      imageFileNames: ['photo.jpg'],
    });
    expect(detectAdPage(page)).toBe(false);
  });

  it('returns false when a story has >= 30 words', () => {
    const longStory = makeStory({
      id: 's1',
      text: 'This is a substantial article with many words that clearly identifies it as editorial content rather than advertising material of any kind whatsoever today in this magazine publication for readers.',
    });
    const frame = makeFrame({ storyId: 's1' });
    const page = makePage({
      pageNumber: 10,
      frames: [frame],
      stories: [longStory],
      imageFileNames: ['photo.jpg'],
    });
    expect(detectAdPage(page)).toBe(false);
  });

  it('returns true for heuristic ad: graphic frame, no article content, no body frame', () => {
    const shortStory = makeStory({
      id: 's1',
      text: 'Advertisement',
    });
    const page = makePage({
      pageNumber: 10,
      stories: [shortStory],
      imageFileNames: ['ad.jpg'],
    });
    expect(detectAdPage(page)).toBe(true);
  });

  it('returns false when page has BodyFrame label', () => {
    const story = makeStory({ id: 'bf1', text: 'Body frame text content.' });
    const frame = makeFrame({ storyId: 'bf1', label: 'BodyFrame' });
    const page = makePage({
      pageNumber: 10,
      labels: ['BodyFrame'],
      frames: [frame],
      stories: [story],
      imageFileNames: ['photo.jpg'],
      totalWordCount: 10,
    });
    expect(detectAdPage(page)).toBe(false);
  });

  it('returns true for ad namespace without article namespace', () => {
    const page = makePage({
      pageNumber: 10,
      adFrameCount: 1,
      namespaceBuckets: {},
      imageFileNames: ['ad.jpg'],
    });
    expect(detectAdPage(page)).toBe(true);
  });

  it('returns false for article namespace without ad namespace', () => {
    const story = makeStory({ id: 's1', text: 'Some body text for the article.' });
    const frame = makeFrame({ storyId: 's1', namespace: 'article', tags: { slug: 'my-story', role: 'body', index: 0 } });
    const page = makePage({
      pageNumber: 10,
      frames: [frame],
      stories: [story],
      namespaceBuckets: { 'article:my-story': { frames: [], titleStoryIds: new Set(), bodyStoryIds: new Set(), roleImages: { hero: [], gallery: [], logo: [], pdf: [] } } },
    });
    expect(detectAdPage(page)).toBe(false);
  });
});

describe('isEditorsPage', () => {
  it('returns true for EditorsFrame label', () => {
    const page = makePage({ pageNumber: 5, labels: ['EditorsFrame'] });
    expect(isEditorsPage(page)).toBe(true);
  });

  it('returns true for EditorsTitleFrame label', () => {
    const page = makePage({ pageNumber: 5, labels: ['EditorsTitleFrame'] });
    expect(isEditorsPage(page)).toBe(true);
  });

  it('returns true for Editor frame label on frame objects', () => {
    const frame = makeFrame({ label: 'EditorsBodyFrame' });
    const page = makePage({ pageNumber: 5, frames: [frame] });
    expect(isEditorsPage(page)).toBe(true);
  });

  it('returns false for regular pages', () => {
    const page = makePage({ pageNumber: 10, labels: ['TitleFrame'] });
    expect(isEditorsPage(page)).toBe(false);
  });
});

describe('detectArticles', () => {
  it('returns empty array for all-ad pages', () => {
    const pages = [
      makePage({ pageNumber: 1, labels: ['AdFrame'], imageFileNames: ['ad1.jpg'] }),
      makePage({ pageNumber: 2, labels: ['AdFrame'], imageFileNames: ['ad2.jpg'] }),
    ];
    expect(detectArticles(pages)).toEqual([]);
  });

  it('detects a single article with title frame', () => {
    const titleStory = makeStory({ id: 't1', text: 'My Great Article Title' });
    const bodyStory = makeStory({ id: 'b1', text: 'This is the body of a great article with enough words to be recognized as editorial content and not advertising.' });
    const titleFrame = makeFrame({ storyId: 't1', isTitle: true, label: 'TitleFrame', position: 'left' });
    const bodyFrame = makeFrame({ storyId: 'b1', label: 'BodyFrame', position: 'right' });
    const page = makePage({
      pageNumber: 3,
      frames: [titleFrame, bodyFrame],
      stories: [titleStory, bodyStory],
      labels: ['TitleFrame', 'BodyFrame'],
      totalWordCount: 20,
    });
    const articles = detectArticles([page]);
    expect(articles.length).toBe(1);
    expect(articles[0].title).toContain('My Great Article');
    expect(articles[0].startPage).toBe(3);
  });

  it('detects multi-page articles', () => {
    const titleStory = makeStory({ id: 't1', text: 'Multi Page Feature' });
    const bodyStory1 = makeStory({ id: 'b1', text: 'Introduction text for the feature article with enough words to pass the threshold.' });
    const bodyStory2 = makeStory({ id: 'b2', text: 'Continuation of the feature article with more editorial content and substantial body text to fill the page.' });

    const titleFrame = makeFrame({ storyId: 't1', isTitle: true, label: 'TitleFrame', position: 'left' });
    const bodyFrame = makeFrame({ storyId: 'b1', label: 'BodyFrame', position: 'right' });
    const page1 = makePage({
      pageNumber: 3,
      frames: [titleFrame, bodyFrame],
      stories: [titleStory, bodyStory1],
      labels: ['TitleFrame', 'BodyFrame'],
      totalWordCount: 20,
    });

    const contFrame = makeFrame({ storyId: 'b2', label: 'BodyFrame', position: 'right' });
    const page2 = makePage({
      pageNumber: 4,
      frames: [contFrame],
      stories: [bodyStory2],
      labels: ['BodyFrame'],
      totalWordCount: 20,
    });

    const articles = detectArticles([page1, page2]);
    expect(articles.length).toBe(1);
    expect(articles[0].startPage).toBe(3);
    expect(articles[0].endPage).toBe(4);
  });

  it('skips pages already covered by namespace-bucketed articles', () => {
    const titleStory = makeStory({ id: 't1', text: 'Tagged Article' });
    const bodyStory = makeStory({ id: 'b1', text: 'Body text for the tagged article with enough words to be meaningful content.' });
    const titleFrame = makeFrame({ storyId: 't1', isTitle: true, namespace: 'article', tags: { slug: 'tagged', role: 'title', index: 0 }, position: 'left' });
    const bodyFrame = makeFrame({ storyId: 'b1', namespace: 'article', tags: { slug: 'tagged', role: 'body', index: 0 }, position: 'right' });
    const page = makePage({
      pageNumber: 5,
      frames: [titleFrame, bodyFrame],
      stories: [titleStory, bodyStory],
      namespaceBuckets: {
        'article:tagged': {
          frames: [],
          titleStoryIds: new Set(['t1']),
          bodyStoryIds: new Set(['b1']),
          roleImages: { hero: [], gallery: [], logo: [], pdf: [] },
        },
      },
      totalWordCount: 20,
    });

    const articles = detectArticles([page]);
    expect(articles.length).toBe(1);
    expect(articles[0].slug).toBe('tagged');
  });
});

describe('mapIdmlToReaderPages', () => {
  it('creates a cover page from the first page', () => {
    const story = makeStory({ id: 's1', text: 'YBW Issue Title' });
    const frame = makeFrame({ storyId: 's1', position: 'full' });
    const coverPage = makePage({
      pageNumber: 1,
      frames: [frame],
      stories: [story],
      totalWordCount: 3,
    });
    const result = mapIdmlToReaderPages([coverPage]);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].template).toBe('cover');
  });

  it('creates a contents page when articles exist', () => {
    const titleStory = makeStory({ id: 't1', text: 'Feature Article' });
    const bodyStory = makeStory({ id: 'b1', text: 'Body text for the feature article with enough words to be recognized as editorial content.' });
    const titleFrame = makeFrame({ storyId: 't1', isTitle: true, label: 'TitleFrame', position: 'left' });
    const bodyFrame = makeFrame({ storyId: 'b1', label: 'BodyFrame', position: 'right' });
    const coverPage = makePage({ pageNumber: 1, stories: [makeStory({ id: 'x', text: 'YBW Magazine' })], totalWordCount: 2 });
    const articlePage = makePage({
      pageNumber: 3,
      frames: [titleFrame, bodyFrame],
      stories: [titleStory, bodyStory],
      labels: ['TitleFrame', 'BodyFrame'],
      totalWordCount: 20,
    });
    const result = mapIdmlToReaderPages([coverPage, articlePage]);
    const contentsPage = result.find((p) => p.template === 'contents');
    expect(contentsPage).toBeDefined();
  });

  it('skips ad pages (they are reserved and not rendered)', () => {
    const coverPage = makePage({ pageNumber: 1, stories: [makeStory({ id: 'x', text: 'YBW' })], totalWordCount: 2 });
    const adPage = makePage({
      pageNumber: 10,
      labels: ['AdFrame'],
      imageFileNames: ['ad.jpg'],
    });
    const result = mapIdmlToReaderPages([coverPage, adPage]);
    const adPages = result.filter((p) => p.template === 'ad');
    expect(adPages.length).toBe(0);
  });

  it('creates back-cover page from last meaningful page', () => {
    const coverPage = makePage({ pageNumber: 1, stories: [makeStory({ id: 'x', text: 'YBW' })], totalWordCount: 2 });
    const backStory = makeStory({
      id: 'b',
      text: 'Thank you for reading Yorkshire BusinessWoman in our digital reader. Browse the archive for more editions and return soon for the next exciting issue of the magazine today and enjoy all the features.',
    });
    const backFrame = makeFrame({ storyId: 'b' });
    const backPage = makePage({
      pageNumber: 20,
      frames: [backFrame],
      imageFileNames: ['back.jpg'],
      stories: [backStory],
      totalWordCount: 35,
    });
    const result = mapIdmlToReaderPages([coverPage, backPage]);
    const backCover = result.find((p) => p.template === 'back-cover');
    expect(backCover).toBeDefined();
  });

  it('never drops non-ad pages (regression: "only 5 pages created" bug)', () => {
    const coverPage = makePage({ pageNumber: 1, stories: [makeStory({ id: 'x', text: 'YBW' })], totalWordCount: 2 });
    const articlePage = makePage({
      pageNumber: 3,
      frames: [
        makeFrame({ storyId: 't1', isTitle: true, label: 'TitleFrame', position: 'left' }),
        makeFrame({ storyId: 'b1', label: 'BodyFrame', position: 'right' }),
      ],
      stories: [
        makeStory({ id: 't1', text: 'Feature Article Title' }),
        makeStory({ id: 'b1', text: 'This is the body of the feature article with enough words to be recognized as editorial content and not advertising material.' }),
      ],
      labels: ['TitleFrame', 'BodyFrame'],
      totalWordCount: 20,
    });
    const result = mapIdmlToReaderPages([coverPage, articlePage]);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

describe('buildEditionMetadata', () => {
  it('extracts title from cover page', () => {
    const pages = [
      { id: 'p1', position: 1, template: 'cover' as const, content: { title: 'Summer 2025 Issue', body: '' } },
      { id: 'p2', position: 2, template: 'feature-left' as const, content: { title: 'Feature', body: '' } },
    ];
    const meta = buildEditionMetadata(pages, 'summer-2025.idml');
    expect(meta.title).toBe('Summer 2025 Issue');
  });

  it('falls back to filename when no cover page', () => {
    const pages = [
      { id: 'p1', position: 1, template: 'feature-left' as const, content: { title: 'Feature', body: '' } },
    ];
    const meta = buildEditionMetadata(pages, 'my-edition.idml');
    expect(meta.title).toBe('my-edition');
  });

  it('falls back to "Untitled Edition" for empty filename', () => {
    const meta = buildEditionMetadata([], '');
    expect(meta.title).toBe('Untitled Edition');
  });
});
