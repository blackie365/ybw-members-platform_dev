import { describe, it, expect } from 'vitest';
import {
  buildClassifiedEntries,
  groupClassifiedEntries,
  initialsFor,
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
        image: '',
        bio: '',
        tags: [],
        links: { linkedin: '', instagram: '', twitter: '' },
        featured: false,
      },
    ]);
  });

  it('falls back to the headline when no role or jobTitle is set', () => {
    const entries = buildClassifiedEntries([
      member({ clerkId: 'u1', role: '', jobTitle: '', headline: 'Director of Coppergate Clinic in York' }),
      member({ clerkId: 'u2', jobTitle: 'Managing Director', headline: 'Ignored headline' }),
    ]);
    expect(entries.map((e) => e.role)).toEqual([
      'Director of Coppergate Clinic in York',
      'Managing Director',
    ]);
  });

  it('carries a collapsed, capped bio preview', () => {
    const long = `${'word '.repeat(60)}end`;
    const entries = buildClassifiedEntries([
      member({ clerkId: 'u1', bio: 'Line one.\n\nLine two.   ' }),
      member({ clerkId: 'u2', bio: long }),
    ]);
    expect(entries[0].bio).toBe('Line one. Line two.');
    expect(entries[1].bio.length).toBeLessThanOrEqual(221);
    expect(entries[1].bio.endsWith('…')).toBe(true);
  });

  it('derives expertise tags from services, industry sector and tags, deduped and capped', () => {
    const entries = buildClassifiedEntries([
      member({
        clerkId: 'u1',
        services: ['Marketing', 'PR'],
        industrySector: 'PR',
        tags: ['Marketing', 'Leadership', 'Coaching'],
      }),
      member({ clerkId: 'u2', industrySector: 'Finance' }),
    ]);
    expect(entries[0].tags).toEqual(['Marketing', 'PR', 'Leadership']);
    expect(entries[1].tags).toEqual(['Finance']);
  });

  it('carries social links only when they are absolute http(s) URLs', () => {
    const entries = buildClassifiedEntries([
      member({
        clerkId: 'u1',
        linkedinUrl: 'https://www.linkedin.com/in/jane',
        instagram: 'https://instagram.com/jane',
        twitterUrl: 'not-a-url',
        linkedin: 'https://linkedin.example/dup',
      }),
      member({ clerkId: 'u2' }),
    ]);
    expect(entries[0].links).toEqual({
      linkedin: 'https://www.linkedin.com/in/jane',
      instagram: 'https://instagram.com/jane',
      twitter: '',
    });
    expect(entries[1].links).toEqual({ linkedin: '', instagram: '', twitter: '' });
  });

  it('omits the website unless it is an absolute http(s) URL', () => {
    const entries = buildClassifiedEntries([
      member({ clerkId: 'u1', websiteUrl: 'acme.example' }),
      member({ clerkId: 'u2', websiteUrl: 'https://ok.example' }),
      member({ clerkId: 'u3', websiteUrl: 'mailto:jane@example.com' }),
    ]);
    expect(entries.map((e) => e.website)).toEqual(['', 'https://ok.example', '']);
  });

  it('resolves the member image, preferring real uploads over blank gravatars', () => {
    const entries = buildClassifiedEntries([
      member({ clerkId: 'u1', image: 'https://storage.googleapis.com/x/u1.jpg' }),
      member({
        clerkId: 'u2',
        profileImage: '',
        avatarUrl: 'https://gravatar.com/avatar/abc?d=blank',
      }),
      member({ clerkId: 'u3', profileImage: 'https://a.example/p3.png' }),
      member({ clerkId: 'u4' }),
    ]);
    expect(entries.map((e) => e.image)).toEqual([
      'https://storage.googleapis.com/x/u1.jpg',
      '',
      'https://a.example/p3.png',
      '',
    ]);
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

describe('initialsFor', () => {
  it('takes the first letter of the first and last words', () => {
    expect(initialsFor('Jane D Smith')).toBe('JS');
  });

  it('uppercases and strips punctuation', () => {
    expect(initialsFor("O'Connor Mack")).toBe('OM');
  });

  it('pads single-word names to two letters', () => {
    expect(initialsFor('Jetplus')).toBe('JE');
  });

  it('returns an empty string when there is nothing to derive', () => {
    expect(initialsFor('')).toBe('');
    expect(initialsFor('!!!')).toBe('');
  });
});