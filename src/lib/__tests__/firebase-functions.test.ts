import { describe, it, expect } from 'vitest';
import { ENDPOINTS } from '../firebase-functions';

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

describe('ENDPOINTS', () => {
  it('all endpoint values are valid URLs', () => {
    for (const [key, value] of Object.entries(ENDPOINTS)) {
      expect(isValidUrl(value), `${key} should be a valid URL, got: ${value}`).toBe(true);
    }
  });

  it('getMembers endpoint is defined', () => {
    expect(ENDPOINTS.getMembers).toBeTruthy();
  });

  it('getByEmail endpoint is defined', () => {
    expect(ENDPOINTS.getByEmail).toBeTruthy();
  });

  it('updateProfile endpoint is defined', () => {
    expect(ENDPOINTS.updateProfile).toBeTruthy();
  });

  it('uploadImage endpoint is defined', () => {
    expect(ENDPOINTS.uploadImage).toBeTruthy();
  });

  it('getLocations endpoint is defined', () => {
    expect(ENDPOINTS.getLocations).toBeTruthy();
  });

  it('community endpoints are defined', () => {
    expect(ENDPOINTS.getPosts).toBeTruthy();
    expect(ENDPOINTS.createPost).toBeTruthy();
    expect(ENDPOINTS.updatePost).toBeTruthy();
    expect(ENDPOINTS.deletePost).toBeTruthy();
  });

  it('auth endpoints are defined', () => {
    expect(ENDPOINTS.createGhostSession).toBeTruthy();
    expect(ENDPOINTS.sendPin).toBeTruthy();
    expect(ENDPOINTS.verifyPin).toBeTruthy();
  });
});
