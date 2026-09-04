import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isPaidSignal,
  sendPremiumWelcomeOnce,
  sendFreeWelcomeOnce,
  ensureWelcomeEmailForMember,
} from '@/lib/member-notifications';

const {
  sendEmail,
  getMemberStore,
  getWelcomeEmailTemplate,
  getFreeWelcomeEmailTemplate,
} = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  getMemberStore: vi.fn(),
  getWelcomeEmailTemplate: vi.fn(),
  getFreeWelcomeEmailTemplate: vi.fn(),
}));

const fakeStore = {
  getMemberByClerkId: vi.fn(),
  claimOnce: vi.fn(),
  clearClaim: vi.fn(),
  setFlags: vi.fn(),
};

vi.mock('@/lib/email', () => ({ sendEmail }));
vi.mock('@/lib/email-templates', () => ({ getWelcomeEmailTemplate, getFreeWelcomeEmailTemplate }));
vi.mock('@/features/members/server', () => ({ getMemberStore }));

beforeEach(() => {
  vi.clearAllMocks();
  getMemberStore.mockReturnValue(fakeStore);
  getWelcomeEmailTemplate.mockResolvedValue('<h1>premium</h1>');
  getFreeWelcomeEmailTemplate.mockResolvedValue('<h1>free</h1>');
  sendEmail.mockResolvedValue({ success: true });
});

describe('isPaidSignal', () => {
  it('returns false for null/undefined', () => {
    expect(isPaidSignal(null)).toBe(false);
    expect(isPaidSignal(undefined)).toBe(false);
  });

  it('returns false for a free member with no Stripe identity', () => {
    expect(isPaidSignal({ membershipTier: 'free' })).toBe(false);
    expect(isPaidSignal({})).toBe(false);
  });

  it('returns true for any non-free tier', () => {
    expect(isPaidSignal({ membershipTier: 'paid_annual' })).toBe(true);
    expect(isPaidSignal({ membershipTier: 'supporter' })).toBe(true);
  });

  it('returns true when any Stripe identity is present', () => {
    expect(isPaidSignal({ stripeCustomerId: 'cus_123' })).toBe(true);
    expect(isPaidSignal({ subscriptionId: 'sub_123' })).toBe(true);
    expect(isPaidSignal({ stripeSubscriptionId: 'sub_456' })).toBe(true);
  });
});

describe('sendPremiumWelcomeOnce', () => {
  it("skips when the member already has premiumWelcomeEmailSentAt", async () => {
    fakeStore.getMemberByClerkId.mockResolvedValue({
      clerkId: 'u1',
      premiumWelcomeEmailSentAt: '2024-01-01T00:00:00.000Z',
    });
    await sendPremiumWelcomeOnce('u1', 'a@b.com', 'Ada');
    expect(fakeStore.claimOnce).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("claims, sends, then records the sent flag", async () => {
    fakeStore.getMemberByClerkId.mockResolvedValue({ clerkId: 'u1', email: 'a@b.com' });
    fakeStore.claimOnce.mockResolvedValue(true);
    await sendPremiumWelcomeOnce('u1', 'a@b.com', 'Ada');
    expect(fakeStore.claimOnce).toHaveBeenCalledWith('u1', 'premiumWelcomeEmailAttemptedAt');
    expect(getWelcomeEmailTemplate).toHaveBeenCalledWith('Ada', expect.any(String));
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'a@b.com',
      subject: 'Welcome to Yorkshire Businesswoman!',
      html: '<h1>premium</h1>',
    });
    expect(fakeStore.setFlags).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ premiumWelcomeEmailSentAt: expect.any(String) }),
    );
  });

  it('does nothing when the claim is lost to a concurrent sender', async () => {
    fakeStore.getMemberByClerkId.mockResolvedValue({ clerkId: 'u1' });
    fakeStore.claimOnce.mockResolvedValue(false);
    await sendPremiumWelcomeOnce('u1', 'a@b.com', 'Ada');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(fakeStore.setFlags).not.toHaveBeenCalled();
  });

  it('clears the claim and does not set the flag when the send fails', async () => {
    fakeStore.getMemberByClerkId.mockResolvedValue({ clerkId: 'u1' });
    fakeStore.claimOnce.mockResolvedValue(true);
    sendEmail.mockRejectedValueOnce(new Error('resend down'));
    await sendPremiumWelcomeOnce('u1', 'a@b.com', 'Ada');
    expect(fakeStore.clearClaim).toHaveBeenCalledWith('u1', 'premiumWelcomeEmailAttemptedAt');
    expect(fakeStore.setFlags).not.toHaveBeenCalled();
  });
});

describe('sendFreeWelcomeOnce', () => {
  it('respects the legacy welcomeEmailSentAt flag', async () => {
    fakeStore.getMemberByClerkId.mockResolvedValue({
      clerkId: 'u1',
      welcomeEmailSentAt: '2023-06-01T00:00:00.000Z',
    });
    await sendFreeWelcomeOnce('u1', 'a@b.com', 'Ada');
    expect(fakeStore.claimOnce).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends the free template and records both new and legacy flags', async () => {
    fakeStore.getMemberByClerkId.mockResolvedValue({ clerkId: 'u1' });
    fakeStore.claimOnce.mockResolvedValue(true);
    await sendFreeWelcomeOnce('u1', 'a@b.com', 'Ada');
    expect(getFreeWelcomeEmailTemplate).toHaveBeenCalledWith('Ada', expect.any(String));
    expect(fakeStore.setFlags).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        freeWelcomeEmailSentAt: expect.any(String),
        welcomeEmailSentAt: expect.any(String),
      }),
    );
  });
});

describe('ensureWelcomeEmailForMember', () => {
  it('sends the premium welcome for a paid member', async () => {
    fakeStore.claimOnce.mockResolvedValue(true);
    await ensureWelcomeEmailForMember({
      clerkId: 'u1',
      email: 'a@b.com',
      firstName: 'Ada',
      membershipTier: 'paid_annual',
    });
    expect(fakeStore.claimOnce).toHaveBeenCalledWith('u1', 'premiumWelcomeEmailAttemptedAt');
  });

  it('sends the free welcome for a free member', async () => {
    fakeStore.getMemberByClerkId.mockResolvedValue({ clerkId: 'u1' });
    fakeStore.claimOnce.mockResolvedValue(true);
    await ensureWelcomeEmailForMember({ clerkId: 'u1', email: 'a@b.com', firstName: 'Ada' });
    expect(fakeStore.claimOnce).toHaveBeenCalledWith('u1', 'freeWelcomeEmailAttemptedAt');
  });

  it('does nothing without a clerkId', async () => {
    await ensureWelcomeEmailForMember({} as any);
    expect(fakeStore.claimOnce).not.toHaveBeenCalled();
  });
});