import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgMemberStore } from '../member-store';

vi.mock('@/features/magazine/server/read-store/pg-client', () => ({ getMagazinePgPool: vi.fn() }));
vi.mock('../member-schema', () => ({ initMemberPgSchema: vi.fn().mockResolvedValue(undefined) }));

import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';

const fakePool = {
  query: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (getMagazinePgPool as any).mockReturnValue(fakePool);
});

const store = () => new PgMemberStore();

describe('PgMemberStore — lookups', () => {
  it('getMemberByClerkId maps row to MemberProfile with clerkId injected', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ clerk_id: 'u1', data: { displayName: 'Ada', email: 'a@x.com' } }] });
    const out = await store().getMemberByClerkId('u1');
    expect(fakePool.query).toHaveBeenCalledWith(
      'SELECT clerk_id, data FROM member_profiles WHERE clerk_id = $1',
      ['u1'],
    );
    expect(out).toEqual({ displayName: 'Ada', email: 'a@x.com', clerkId: 'u1' });
  });

  it('lookups return null when no row matches', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    expect(await store().getMemberByClerkId('missing')).toBeNull();
  });

  it('getMemberByEmail normalises to lowercase and matches email_lower / emailLower / email', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ clerk_id: 'u2', data: { email: 'a@x.com' } }] });
    const out = await store().getMemberByEmail('  A@X.COM ');
    expect(fakePool.query).toHaveBeenCalledWith(
      `SELECT clerk_id, data FROM member_profiles
         WHERE email_lower = $1 OR data->>'emailLower' = $1 OR data->>'email' = $1
         ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
         LIMIT 1`,
      ['a@x.com'],
    );
    expect(out).toEqual({ email: 'a@x.com', clerkId: 'u2' });
  });

  it('getMemberBySlug matches member_slug / memberSlug / slug / id', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ clerk_id: 'u3', data: { memberSlug: 'ada' } }] });
    expect(await store().getMemberBySlug('ada')).toEqual({ memberSlug: 'ada', clerkId: 'u3' });
    expect(fakePool.query).toHaveBeenCalledWith(
      `SELECT clerk_id, data FROM member_profiles
         WHERE member_slug = $1 OR data->>'memberSlug' = $1 OR data->>'slug' = $1 OR data->>'id' = $1
         LIMIT 1`,
      ['ada'],
    );
  });

  it('queryOne sanitises the field name and compares data->>field', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ clerk_id: 'u4', data: { industry: 'Tech' } }] });
    expect(await store().queryOne({ field: 'industry', value: 'Tech' })).toEqual({ industry: 'Tech', clerkId: 'u4' });
    expect(fakePool.query).toHaveBeenCalledWith(
      "SELECT clerk_id, data FROM member_profiles\n         WHERE data->>'industry' = $1\n         LIMIT 1",
      ['Tech'],
    );
  });
});

describe('PgMemberStore — collections & counts', () => {
  it('getAllActive filters is_active and orders by created_at desc, injecting clerkId', async () => {
    fakePool.query.mockResolvedValue({
      rows: [
        { clerk_id: 'u1', data: { displayName: 'A' } },
        { clerk_id: 'u2', data: { displayName: 'B' } },
      ],
    });
    expect(await store().getAllActive()).toEqual([
      { displayName: 'A', clerkId: 'u1' },
      { displayName: 'B', clerkId: 'u2' },
    ]);
  });

  it('getAll returns all rows mapped to MemberProfile', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ clerk_id: 'u1', data: { email: 'a@x.com' } }] });
    expect(await store().getAll()).toEqual([{ email: 'a@x.com', clerkId: 'u1' }]);
  });

  it('getFeatured passes limit and filters is_featured', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ clerk_id: 'u1', data: {} }] });
    expect(await store().getFeatured(3)).toEqual([{ clerkId: 'u1' }]);
    expect(fakePool.query).toHaveBeenCalledWith(
      `SELECT clerk_id, data FROM member_profiles
         WHERE is_featured = true
         ORDER BY COALESCE(created_at, updated_at) DESC NULLS LAST
         LIMIT $1`,
      [3],
    );
  });

  it('getRecent passes limit and filters is_active', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    expect(await store().getRecent(10)).toEqual([]);
  });

  it('countActive returns the integer count', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ n: 42 }] });
    expect(await store().countActive()).toBe(42);
  });
});

describe('PgMemberStore — writes', () => {
  it('upsert inserts a row with derived helper columns; defaults is_active true', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    await store().upsert({
      clerkId: 'u1',
      profile: {
        email: 'Ada@x.com',
        emailLower: 'ada@x.com',
        memberSlug: 'ada',
        isFeatured: true,
        role: 'member',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    });
    expect(fakePool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO member_profiles'),
      [
        'u1',
        JSON.stringify({
          email: 'Ada@x.com',
          emailLower: 'ada@x.com',
          memberSlug: 'ada',
          isFeatured: true,
          role: 'member',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
        'Ada@x.com',
        'ada@x.com',
        'ada',
        true,
        true,
        'member',
        '2024-01-01T00:00:00.000Z',
        '2024-01-02T00:00:00.000Z',
      ],
    );
  });

  it('upsert infers email_lower when not provided and treats userInactive=true as inactive', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    await store().upsert({ clerkId: 'u2', profile: { email: 'B@x.com', userInactive: true } });
    const params = fakePool.query.mock.calls[0][1];
    expect(params[3]).toBe('b@x.com');
    expect(params[6]).toBe(false);
  });

  it('patch merges existing data with the patch and injects clerkId', async () => {
    fakePool.query
      .mockResolvedValueOnce({ rows: [{ data: { displayName: 'Ada', email: 'a@x.com' } }] })
      .mockResolvedValueOnce({ rows: [] });
    await store().patch('u1', { status: 'active', updatedAt: '2024-02-02T00:00:00.000Z' });
    expect(fakePool.query.mock.calls[1][1][1]).toBe(
      JSON.stringify({ displayName: 'Ada', email: 'a@x.com', status: 'active', updatedAt: '2024-02-02T00:00:00.000Z', clerkId: 'u1' }),
    );
  });

  it('setFeatured updates the featured flag', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    await store().setFeatured('u1', true);
    expect(fakePool.query).toHaveBeenCalledWith(
      'UPDATE member_profiles SET is_featured = $2, updated_at = NOW() WHERE clerk_id = $1',
      ['u1', true],
    );
  });

  it('remove deletes by clerk_id', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    await store().remove('u1');
    expect(fakePool.query).toHaveBeenCalledWith('DELETE FROM member_profiles WHERE clerk_id = $1', ['u1']);
  });
});

describe('PgMemberStore — resilience', () => {
  it('returns null/[]/0 and swallows errors when Postgres is not configured', async () => {
    (getMagazinePgPool as any).mockReturnValue(null);
    expect(await store().getMemberByClerkId('u1')).toBeNull();
    expect(await store().getAll()).toEqual([]);
    expect(await store().countActive()).toBe(0);
    expect(await store().health()).toBe(false);
  });

  it('catches query errors and returns a safe default instead of throwing', async () => {
    fakePool.query.mockRejectedValue(new Error('boom'));
    expect(await store().getMemberByClerkId('u1')).toBeNull();
  });
});
