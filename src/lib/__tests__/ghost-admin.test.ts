import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { browseMock } = vi.hoisted(() => ({ browseMock: vi.fn() }));

vi.mock('@tryghost/admin-api', () => {
  function FakeAdminAPI(this: any) {
    this.members = { browse: browseMock };
  }
  return { default: FakeAdminAPI };
});

import { getGhostMemberByEmail, isPaidGhostMember } from '../ghost-admin';

describe('isPaidGhostMember', () => {
  it('returns true for paid status', () => {
    expect(isPaidGhostMember({ status: 'paid' })).toBe(true);
  });

  it('returns true for comped status', () => {
    expect(isPaidGhostMember({ status: 'comped' })).toBe(true);
  });

  it('returns false for free status', () => {
    expect(isPaidGhostMember({ status: 'free' })).toBe(false);
  });

  it('returns false for null / undefined member', () => {
    expect(isPaidGhostMember(null)).toBe(false);
    expect(isPaidGhostMember(undefined)).toBe(false);
  });

  it('is case-insensitive on the status field', () => {
    expect(isPaidGhostMember({ status: 'PAID' })).toBe(true);
  });
});

describe('getGhostMemberByEmail', () => {
  beforeEach(() => {
    process.env.GHOST_ADMIN_API_KEY = 'test-key';
    browseMock.mockReset();
  });

  afterEach(() => {
    delete process.env.GHOST_ADMIN_API_KEY;
  });

  it('returns the first member matching the email filter', async () => {
    browseMock.mockResolvedValue([{ id: 'm1', status: 'paid' }]);
    const member = await getGhostMemberByEmail('a@x.com');
    expect(browseMock).toHaveBeenCalledWith({ filter: "email:'a@x.com'" });
    expect(member).toEqual({ id: 'm1', status: 'paid' });
  });

  it('returns null when Ghost returns no members', async () => {
    browseMock.mockResolvedValue([]);
    expect(await getGhostMemberByEmail('a@x.com')).toBeNull();
  });

  it('returns null when no email is provided', async () => {
    expect(await getGhostMemberByEmail('')).toBeNull();
    expect(browseMock).not.toHaveBeenCalled();
  });

  it('returns null and does not throw when an empty email / API key missing', async () => {
    delete process.env.GHOST_ADMIN_API_KEY;
    expect(await getGhostMemberByEmail('a@x.com')).toBeNull();
  });

  it('returns null when the Ghost API throws', async () => {
    browseMock.mockRejectedValue(new Error('rate limited'));
    expect(await getGhostMemberByEmail('a@x.com')).toBeNull();
  });
});
