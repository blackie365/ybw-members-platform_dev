import { describe, it, expect } from 'vitest';
import { mapBuilderIssueToReaderEdition } from '../builder-to-reader';

function builderIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 'issue_1',
    title: 'Test Edition',
    description: 'A test edition',
    publishDate: '2026-08-16T00:00:00.000Z',
    heroImage: '',
    coverImage: '',
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