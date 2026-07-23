import { describe, it, expect } from 'vitest';
import { config } from '../config';

describe('config', () => {
  it('has adminEmail defined', () => {
    expect(config.adminEmail).toBeTruthy();
    expect(config.adminEmail).toContain('@');
  });

  it('has contactRecipients as non-empty array', () => {
    expect(Array.isArray(config.contactRecipients)).toBe(true);
    expect(config.contactRecipients.length).toBeGreaterThan(0);
    config.contactRecipients.forEach(email => {
      expect(email).toContain('@');
    });
  });

  it('has emailFrom with proper format', () => {
    expect(config.emailFrom).toBeTruthy();
    expect(config.emailFrom).toContain('@');
  });

  it('has siteUrl as valid URL', () => {
    expect(config.siteUrl).toBeTruthy();
    expect(config.siteUrl).toMatch(/^https?:\/\//);
  });
});
