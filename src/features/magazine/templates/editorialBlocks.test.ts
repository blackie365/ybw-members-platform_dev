import { describe, it, expect } from 'vitest';
import { getHtmlBlocks } from './editorialBlocks';

describe('getHtmlBlocks()', () => {
  it('keeps a standalone <h2> as its own heading block', () => {
    expect(getHtmlBlocks('<h2>Heading</h2><p>Body text.</p>')).toEqual([
      '<h2>Heading</h2>',
      '<p>Body text.</p>',
    ]);
  });

  it('keeps <h3> attributes intact', () => {
    expect(getHtmlBlocks('<h3 class="x">Sub</h3>')).toEqual([
      '<h3 class="x">Sub</h3>',
    ]);
  });

  it('keeps a <ul> as a single block, never wrapped in <p>', () => {
    expect(getHtmlBlocks('<ul><li>one</li><li>two</li></ul>')).toEqual([
      '<ul><li>one</li><li>two</li></ul>',
    ]);
  });

  it('keeps <ol> as a single block', () => {
    expect(getHtmlBlocks('<ol><li>1</li></ol>')).toEqual([
      '<ol><li>1</li></ol>',
    ]);
  });

  it('keeps a <blockquote> (and its nested <p>) intact', () => {
    expect(
      getHtmlBlocks('<blockquote><p>Quote here</p></blockquote>'),
    ).toEqual(['<blockquote><p>Quote here</p></blockquote>']);
  });

  it('wraps a bare inline tag run (bold) in a paragraph', () => {
    expect(getHtmlBlocks('<strong>bold world</strong>')).toEqual([
      '<p><strong>bold world</strong></p>',
    ]);
  });

  it('wraps a bare italic run in a paragraph', () => {
    expect(getHtmlBlocks('<em>italicised</em>')).toEqual([
      '<p><em>italicised</em></p>',
    ]);
  });

  it('preserves an inline colour span inside a paragraph', () => {
    expect(
      getHtmlBlocks('<p><span style="color: #a3413a;">red text</span></p>'),
    ).toEqual(['<p><span style="color: #a3413a;">red text</span></p>']);
  });

  it('splits separate <p> paragraphs into separate blocks', () => {
    expect(getHtmlBlocks('<p>A</p><p>B</p>')).toEqual([
      '<p>A</p>',
      '<p>B</p>',
    ]);
  });

  it('turns a <br> inside a paragraph into a paragraph boundary', () => {
    expect(getHtmlBlocks('<p>a<br>b</p>')).toEqual(['<p>a</p>', '<p>b</p>']);
  });

  it('honours hard newlines in otherwise plain text', () => {
    expect(getHtmlBlocks('Line one\nLine two')).toEqual([
      '<p>Line one</p>',
      '<p>Line two</p>',
    ]);
  });

  it('treats trailing floating text after a paragraph as its own block', () => {
    expect(getHtmlBlocks('<p>A</p>\n\nB')).toEqual(['<p>A</p>', '<p>B</p>']);
  });
});