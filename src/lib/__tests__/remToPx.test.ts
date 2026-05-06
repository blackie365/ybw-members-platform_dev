import { describe, it, expect } from 'vitest';
import { remToPx } from '../remToPx';

describe('remToPx()', () => {
  // In a Node/non-browser environment, window is undefined so root font size defaults to 16px

  it('converts 1rem to 16px (default root font size)', () => {
    expect(remToPx(1)).toBe(16);
  });

  it('converts 0.5rem to 8px', () => {
    expect(remToPx(0.5)).toBe(8);
  });

  it('converts 2rem to 32px', () => {
    expect(remToPx(2)).toBe(32);
  });

  it('converts 0rem to 0px', () => {
    expect(remToPx(0)).toBe(0);
  });

  it('converts fractional rem correctly', () => {
    expect(remToPx(1.5)).toBe(24);
  });
});
