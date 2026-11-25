import { describe, expect, it } from 'vitest';

import { markdownToHtml } from '../markdown-to-html';

describe('markdownToHtml', () => {
  it('renders headings, paragraphs, and emphasis', () => {
    const html = markdownToHtml('# Title\n\nA **bold** move.');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>A <strong>bold</strong> move.</p>');
  });

  it('renders lists and links safely', () => {
    const html = markdownToHtml('- One\n- Two\n\n[Site](https://example.com)');

    expect(html).toContain('<ul><li>One</li><li>Two</li></ul>');
    expect(html).toContain('<a href="https://example.com">Site</a>');
  });

  it('escapes raw html instead of trusting it', () => {
    const html = markdownToHtml('Hello <script>alert(1)</script>');

    expect(html).toContain('<p>Hello alert(1)</p>');
    expect(html).not.toContain('<script>');
  });

  it('renders fenced code blocks', () => {
    const html = markdownToHtml('```ts\nconst x = 1;\n```');

    expect(html).toContain('<pre><code class="language-ts">const x = 1;</code></pre>');
  });
});
