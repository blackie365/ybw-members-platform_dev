import { describe, it, expect } from 'vitest';
import {
  buildClassifiedEntries,
  groupClassifiedEntries,
  isPaidOrFeaturedMember,
  PAID_TIERS,
} from '../classifieds';

function member(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: 'usr_1',
    firstName: 'Jane',
    lastName: 'Smith',
    displayName: '',
    jobTitle: 'Managing Director',
    companyName: 'Acme Ltd',
    location: 'Leeds',
    websiteUrl: 'https://acme.example',
    isActive: true,
    membershipTier: 'paid',
    ...overrides,
  };
}

describe('isPaidOrFeaturedMember', () => {
  it.each(PAID_TIERS as unknown as string[])('accepts the %s tier', (tier) => {
    expect(isPaidOrFeaturedMember(member({ membershipTier: tier }))).toBe(true);
  });

  it('accepts a member with no tier but the featured flag', () => {
    expect(isPaidOrFeaturedMember(member({ isFeatured: true }))).toBe(true);
  });

  it('rejects active free members', () => {
    expect(isPaidOrFeaturedMember(member({ membershipTier: 'free' }))).toBe(false);
  });

  it('rejects members with no tier and no featured flag', () => {
    expect(
      isPaidOrFeaturedMember({
        clerkId: 'usr_1',
        firstName: 'Jane',
        lastName: 'Smith',
        isActive: true,
      }),
    ).toBe(false);
  });
});

describe('buildClassifiedEntries', () => {
  it('keeps only active paid/featured members with a name', () => {
    const entries = buildClassifiedEntries([
      member({ clerkId: 'u1' }),
      member({ clerkId: 'u2', membershipTier: 'paid_annual' }),
      member({ clerkId: 'u3', isFeatured: true }),
      member({ clerkId: 'u4', membershipTier: 'free' }),
      member({ clerkId: 'u5', userInactive: true, membershipTier: 'paid' }),
      member({ clerkId: 'u6', displayName: '', firstName: '', lastName: '', isFeatured: true }),
    ]);

    expect(entries.map((e) => e.key)).toEqual(['u1', 'u2', 'u3']);
  });

  it('never ships history/tier/status fields — only public listing fields', () => {
    const entries = buildClassifiedEntries([
      member({
        clerkId: 'u1',
        membershipTier: 'founder',
        userInactive: false,
        somePrivateField: 'secret',
      }),
    ]);
    expect(entries).toEqual([
      {
        key: 'u1',
        name: 'Jane Smith',
        role: 'Managing Director',
        company: 'Acme Ltd',
        location: 'Leeds',
        website: 'https://acme.example',
        featured: false,
      },
    ]);
  });

  it('omits the website unless it is an absolute http(s) URL', () => {
    const entries = buildClassifiedEntries([
      member({ clerkId: 'u1', websiteUrl: 'acme.example' }),
      member({ clerkId: 'u2', websiteUrl: 'https://ok.example' }),
      member({ clerkId: 'u3', websiteUrl: 'mailto:jane@example.com' }),
    ]);
    expect(entries.map((e) => e.website)).toEqual(['', 'https://ok.example', '']);
  });

  it('sorts alphabetically by surname then given name', () => {
    const entries = buildClassifiedEntries([
      member({ clerkId: 'u1', lastName: 'Abbott', firstName: 'Zoe' }),
      member({ clerkId: 'u2', lastName: 'Smith', firstName: 'Jane' }),
      member({ clerkId: 'u3', lastName: 'Smith', firstName: 'Aaron' }),
    ]);
    expect(entries.map((e) => e.name)).toEqual(['Zoe Abbott', 'Aaron Smith', 'Jane Smith']);
  });

  it('returns [] for empty input', () => {
    expect(buildClassifiedEntries([])).toEqual([]);
  });
});

describe('groupClassifiedEntries', () => {
  it('groups into alphabetical buckets and skips empty letters', () => {
    const entries = buildClassifiedEntries([
      member({ clerkId: 'u1', lastName: 'Abbott', firstName: 'Zoe' }),
      member({ clerkId: 'u2', lastName: 'Clark', firstName: 'Anna' }),
      member({ clerkId: 'u3', lastName: 'Smith', firstName: 'Jane' }),
    ]);
    const groups = groupClassifiedEntries(entries);
    expect(groups.map((g) => g.initial)).toEqual(['A', 'C', 'S']);
    expect(groups[2].entries[0].name).toBe('Jane Smith');
  });

  it('returns [] for empty input', () => {
    expect(groupClassifiedEntries([])).toEqual([]);
  });
});