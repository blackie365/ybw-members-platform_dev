import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isoWeekKey, wasNewsletterSentThisWeek, sendWeeklyNewsletter } from '@/lib/newsletter-send';

const {
  getMagazinePgPool,
  getMemberStore,
  getPosts,
  getDailyNewsletterTemplate,
  sendEmail,
} = vi.hoisted(() => ({
  getMagazinePgPool: vi.fn(),
  getMemberStore: vi.fn(),
  getPosts: vi.fn(),
  getDailyNewsletterTemplate: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/features/magazine/server/read-store/pg-client', () => ({
  getMagazinePgPool,
}));
vi.mock('@/features/members/server', () => ({ getMemberStore }));
vi.mock('@/lib/ghost', () => ({ getPosts }));
vi.mock('@/lib/email-templates', () => ({ getDailyNewsletterTemplate }));
vi.mock('@/lib/email', () => ({ sendEmail }));

const fakePool = {
  query: vi.fn(),
};

const fakeStore = {
  getAll: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).__newsletterSendLogReady = undefined;
  getMagazinePgPool.mockReturnValue(fakePool);
  getMemberStore.mockReturnValue(fakeStore);
  getPosts.mockResolvedValue([{ id: '1', title: 'Post 1' }]);
  getDailyNewsletterTemplate.mockResolvedValue('<h1>newsletter</h1>');
  sendEmail.mockResolvedValue({ success: true });
  fakeStore.getAll.mockResolvedValue([
    { email: 'alice@example.com', isNewsletterRecipient: true },
    { email: 'bob@example.com', userInactive: false },
  ]);
});

describe('isoWeekKey', () => {
  it('returns a YYYY-Wxx string', () => {
    const key = isoWeekKey(new Date('2026-09-16T12:00:00Z'));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('is consistent across the same week', () => {
    const mon = isoWeekKey(new Date('2026-09-14T00:00:00Z'));
    const fri = isoWeekKey(new Date('2026-09-18T23:59:59Z'));
    expect(mon).toBe(fri);
  });
});

describe('wasNewsletterSentThisWeek', () => {
  it('returns false when table has no row for this week', async () => {
    fakePool.query.mockResolvedValue({ rows: [] });
    expect(await wasNewsletterSentThisWeek('2026-W38')).toBe(false);
  });

  it('returns true when table has a row for this week', async () => {
    fakePool.query.mockResolvedValue({ rows: [{ week_key: '2026-W38' }] });
    expect(await wasNewsletterSentThisWeek('2026-W38')).toBe(true);
  });

  it('returns false when pool is null (no Postgres configured)', async () => {
    getMagazinePgPool.mockReturnValue(null);
    expect(await wasNewsletterSentThisWeek('2026-W38')).toBe(false);
  });
});

describe('sendWeeklyNewsletter deduplication', () => {
  it('skips send when already logged for this week', async () => {
    // ensureSendLogTable: CREATE TABLE succeeds
    fakePool.query.mockResolvedValueOnce({ rows: [] });
    // wasNewsletterSentThisWeek: row exists
    fakePool.query.mockResolvedValueOnce({ rows: [{ week_key: '2026-W38' }] });

    const result = await sendWeeklyNewsletter();

    expect(result.success).toBe(true);
    expect(result.deduped).toBe(true);
    expect(result.count).toBe(0);
    // sendEmail must NOT have been called
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends and logs when no prior send exists', async () => {
    // ensureSendLogTable: CREATE TABLE succeeds
    fakePool.query.mockResolvedValueOnce({ rows: [] });
    // wasNewsletterSentThisWeek: no row
    fakePool.query.mockResolvedValueOnce({ rows: [] });
    // logNewsletterSend INSERT succeeds
    fakePool.query.mockResolvedValueOnce({ rows: [] });

    const result = await sendWeeklyNewsletter();

    expect(result.success).toBe(true);
    expect(result.deduped).toBeUndefined();
    expect(result.count).toBe(2);
    expect(sendEmail).toHaveBeenCalled();
  });

  it('sends without dedup when Postgres is unavailable', async () => {
    getMagazinePgPool.mockReturnValue(null);

    const result = await sendWeeklyNewsletter();

    expect(result.success).toBe(true);
    expect(result.deduped).toBeUndefined();
    expect(result.count).toBe(2);
    expect(sendEmail).toHaveBeenCalled();
  });
});
