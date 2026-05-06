import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn()', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles conditional classes via object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('handles array of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });
});
