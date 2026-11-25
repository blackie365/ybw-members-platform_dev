import { remark } from 'remark';

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function isSafeUrl(value: string | null | undefined): boolean {
  const url = String(value || '').trim();
  if (!url) return false;
  return !/^(javascript:|vbscript:|data:text\/html)/i.test(url);
}

function renderInline(node: any): string {
  if (!node) return '';

  switch (node.type) {
    case 'text':
      return escapeHtml(node.value || '');

    case 'strong':
      return `<strong>${renderInlineChildren(node.children)}</strong>`;

    case 'emphasis':
      return `<em>${renderInlineChildren(node.children)}</em>`;

    case 'delete':
      return `<del>${renderInlineChildren(node.children)}</del>`;

    case 'inlineCode':
      return `<code>${escapeHtml(node.value || '')}</code>`;

    case 'break':
      return '<br />';

    case 'link': {
      const href = String(node.url || '').trim();
      const content = renderInlineChildren(node.children) || escapeHtml(href);
      if (!isSafeUrl(href)) return content;
      return `<a href="${escapeAttribute(href)}">${content}</a>`;
    }

    case 'image': {
      const src = String(node.url || '').trim();
      if (!isSafeUrl(src)) return '';
      const alt = renderInlineChildren(node.alt ? [{ type: 'text', value: node.alt }] : []);
      return `<img src="${escapeAttribute(src)}" alt="${alt}" />`;
    }

    default:
      return renderInlineChildren(node.children);
  }
}

function renderInlineChildren(children: any[] | null | undefined): string {
  return Array.isArray(children) ? children.map((child) => renderInline(child)).join('') : '';
}

function renderListItem(node: any): string {
  const children = Array.isArray(node.children) ? node.children : [];
  const rendered = children
    .map((child: any) => renderBlock(child))
    .filter(Boolean)
    .join('');

  if (!rendered) return '';

  return `<li>${rendered.replace(/^<p>([\s\S]*)<\/p>$/i, '$1')}</li>`;
}

function renderBlock(node: any): string {
  if (!node) return '';

  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInlineChildren(node.children)}</p>`;

    case 'heading': {
      const depth = Math.min(6, Math.max(1, Number(node.depth) || 2));
      return `<h${depth}>${renderInlineChildren(node.children)}</h${depth}>`;
    }

    case 'blockquote': {
      const inner = Array.isArray(node.children)
        ? node.children.map((child: any) => renderBlock(child)).join('')
        : '';
      return inner ? `<blockquote>${inner}</blockquote>` : '';
    }

    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      const start =
        node.ordered && Number.isFinite(node.start) && Number(node.start) > 1
          ? ` start="${Number(node.start)}"`
          : '';
      const items = Array.isArray(node.children)
        ? node.children.map((child: any) => renderListItem(child)).filter(Boolean).join('')
        : '';
      return items ? `<${tag}${start}>${items}</${tag}>` : '';
    }

    case 'code': {
      const language = String(node.lang || '').trim();
      const className = language ? ` class="language-${escapeAttribute(language)}"` : '';
      return `<pre><code${className}>${escapeHtml(node.value || '')}</code></pre>`;
    }

    case 'thematicBreak':
      return '<hr />';

    case 'html':
      return escapeHtml(node.value || '');

    default:
      return renderInline(node);
  }
}

export function markdownToHtml(markdown: string | null | undefined): string {
  const source = String(markdown || '').trim();
  if (!source) return '';

  const tree = remark().parse(source) as any;
  const children = Array.isArray(tree?.children) ? tree.children : [];
  return children.map((node: any) => renderBlock(node)).filter(Boolean).join('\n');
}
