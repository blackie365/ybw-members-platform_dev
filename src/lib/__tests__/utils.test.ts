import { describe, it, expect } from 'vitest';
import { cn, sanitizeHtml } from '../utils';

describe('cn()', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo'))?.toBe('foo');
  });

  it('joins multiple classes', () => {
    expect(cn('foo', 'bar', 'baz'))?.toBe('foo bar baz');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', undefined, null, false, 'bar'))?.toBe('foo bar');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('p-4', 'p-8'))?.toBe('p-8');
    expect(cn('text-red-500', 'text-blue-500'))?.toBe('text-blue-500');
  });

  it('handles conditional classes via object syntax', () => {
    expect(cn('base', { active: true, disabled: false }))?.toBe('base active');
  });

  it('handles array of classes', () => {
    expect(cn(['foo', 'bar'], 'baz'))?.toBe('foo bar baz');
  });

  it('returns empty string for no arguments', () => {
    expect(cn())?.toBe('');
  });
});

describe('sanitizeHtml()', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('strips script/style/iframe content', () => {
    const input =
      '<div><script>alert(1)</script><style>.x{color:red}</style><iframe src="https://evil.test"></iframe><p>ok</p></div>';
    const out = sanitizeHtml(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<style');
    expect(out).not.toContain('<iframe');
    expect(out).toContain('<p>ok</p>');
  });

  it('strips event handlers like onclick', () => {
    expect(sanitizeHtml('<p onclick="x()">hi</p>')).toBe('<p>hi</p>');
  });

  it('strips style attributes by default', () => {
    expect(sanitizeHtml('<span style="color: #ff0000;">x</span>')).toBe(
      '<span>x</span>',
    );
  });

  it('keeps safe inline styles when allowStyles is enabled', () => {
    const out = sanitizeHtml(
      '<span style="color: #a3413a; font-size: 1.6rem; text-align: center;">x</span>',
      { allowStyles: true },
    );
    expect(out).toContain('color: #a3413a');
    expect(out).toContain('font-size: 1.6rem');
    expect(out).toContain('text-align: center');
  });

  it('drops unsafe or non-whitelisted style declarations', () => {
    const out = sanitizeHtml(
      '<span style="position: fixed; z-index: 9999; color: red; background: url(https://evil.test/x.png); font-family: Pwn; width: 100%;">x</span>',
      { allowStyles: true },
    );
    expect(out).not.toContain('position');
    expect(out).not.toContain('z-index');
    expect(out).not.toContain('font-family');
    expect(out).not.toContain('width');
    expect(out).not.toContain('url(');
    expect(out).toContain('color: red');
  });

  it('strips unsafe href/src schemes', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });
});
