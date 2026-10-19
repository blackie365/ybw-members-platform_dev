import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  addBeehiivSubscriber: vi.fn(),
  isBeehiivConfigured: vi.fn(),
  addGhostMember: vi.fn(),
  getMemberStore: vi.fn(),
  sendEmail: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  store: {
    getMemberByEmail: vi.fn(),
    upsert: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('@/lib/beehiiv', () => ({
  addBeehiivSubscriber: mocks.addBeehiivSubscriber,
  isBeehiivConfigured: mocks.isBeehiivConfigured,
}));
vi.mock('@/lib/ghost-admin', () => ({ addGhostMember: mocks.addGhostMember }));
vi.mock('@/features/members/server', () => ({ getMemberStore: mocks.getMemberStore }));
vi.mock('@/lib/email', () => ({
  sendEmail: mocks.sendEmail,
  bareEmail: (value: string) => (value.match(/<([^>]+)>/)?.[1] ?? value).trim().toLowerCase(),
}));
vi.mock('@/lib/email-templates', () => ({
  getNewsletterWelcomeEmailTemplate: async () => '<html />',
  getNewsletterSignupAlertTemplate: async () => '<html />',
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
}));
vi.mock('@/lib/config', () => ({
  config: {
    newsletterAlertRecipients: [],
    emailFrom: 'editor@yorkshirebusinesswoman.co.uk',
  },
}));

import { POST } from '../route';

function request(body: Record<string, unknown> = {}) {
  return new Request('https://yorkshirebusinesswoman.co.uk/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'reader@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      source: 'Home Page Pop-up',
      website: '',
      elapsedMs: 5000,
      ...body,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClientIp.mockReturnValue('203.0.113.7');
  mocks.checkRateLimit.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 });
  mocks.isBeehiivConfigured.mockReturnValue(true);
  mocks.addGhostMember.mockResolvedValue({ id: 'ghost-1' });
  mocks.getMemberStore.mockReturnValue(mocks.store);
  mocks.store.getMemberByEmail.mockResolvedValue(null);
  mocks.store.upsert.mockResolvedValue(undefined);
  mocks.store.patch.mockResolvedValue(undefined);
  mocks.sendEmail.mockResolvedValue({ mock: true });
});

describe('POST /api/newsletter — primary engine failure', () => {
  it('returns a non-ok status when Beehiiv is configured but the add fails', async () => {
    mocks.addBeehiivSubscriber.mockResolvedValue({
      success: false,
      error: 'upstream exploded',
      httpStatus: 500,
    });

    const res = await POST(request());
    const body = await res.json();

    // The visitor must not be told they subscribed, and the caller must not set
    // its 30-day dismissal flag on the back of a subscription that never landed.
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.message).toBeUndefined();
  });

  it('still stores the local member record when the primary engine fails', async () => {
    mocks.addBeehiivSubscriber.mockResolvedValue({ success: false, error: 'upstream exploded' });

    await POST(request());

    expect(mocks.store.upsert).toHaveBeenCalledTimes(1);
  });

  it('succeeds when Beehiiv merely is not configured', async () => {
    mocks.addBeehiivSubscriber.mockResolvedValue({
      success: false,
      disabled: true,
      error: 'Beehiiv API Key or Publication ID is missing',
    });

    const res = await POST(request());
    const body = await res.json();

    expect(res.ok).toBe(true);
    expect(body.success).toBe(true);
  });

  it('succeeds and dismisses normally when the subscriber is added', async () => {
    mocks.addBeehiivSubscriber.mockResolvedValue({ success: true });

    const res = await POST(request());
    const body = await res.json();

    expect(res.ok).toBe(true);
    expect(body.message).toBe('Successfully subscribed');
  });

  it('treats an existing subscriber as success rather than failure', async () => {
    mocks.addBeehiivSubscriber.mockResolvedValue({ success: true, alreadyExists: true });

    const res = await POST(request());
    const body = await res.json();

    expect(res.ok).toBe(true);
    expect(body.message).toContain('already subscribed');
  });
});
