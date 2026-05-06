import { describe, it, expect } from 'vitest';
import { getFriendlyAuthErrorMessage } from '../authErrors';

describe('getFriendlyAuthErrorMessage()', () => {
  // Registration errors
  it('handles email-already-in-use', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/email-already-in-use' }))
      .toBe('This email address is already registered. Please sign in instead.');
  });

  it('handles invalid-email', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/invalid-email' }))
      .toBe('Please enter a valid email address.');
  });

  it('handles weak-password', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/weak-password' }))
      .toBe('Your password must be at least 6 characters long.');
  });

  // Login errors
  it('handles user-not-found', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/user-not-found' }))
      .toBe('Invalid email or password. Please check your credentials and try again.');
  });

  it('handles wrong-password', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/wrong-password' }))
      .toBe('Invalid email or password. Please check your credentials and try again.');
  });

  it('handles invalid-credential', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/invalid-credential' }))
      .toBe('Invalid email or password. Please check your credentials and try again.');
  });

  it('handles user-disabled', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/user-disabled' }))
      .toBe('This account has been disabled. Please contact support.');
  });

  // Generic errors
  it('handles too-many-requests', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/too-many-requests' }))
      .toBe('Too many failed login attempts. Please try again later.');
  });

  it('handles popup-closed-by-user', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/popup-closed-by-user' }))
      .toBe('Sign-in was cancelled. Please try again.');
  });

  it('handles network-request-failed', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/network-request-failed' }))
      .toBe('A network error occurred. Please check your internet connection.');
  });

  it('handles operation-not-allowed', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/operation-not-allowed' }))
      .toBe('This sign-in method is not enabled. Please contact support.');
  });

  // Default / fallback
  it('strips Firebase prefix from unknown error message', () => {
    const result = getFriendlyAuthErrorMessage({
      code: 'auth/unknown',
      message: 'Firebase: Something went wrong (auth/unknown).',
    });
    expect(result).toBe('Something went wrong');
  });

  it('returns generic message when no code or message', () => {
    expect(getFriendlyAuthErrorMessage({}))
      .toBe('An unexpected error occurred. Please try again.');
  });

  it('returns generic message for null error', () => {
    expect(getFriendlyAuthErrorMessage(null))
      .toBe('An unexpected error occurred. Please try again.');
  });
});
