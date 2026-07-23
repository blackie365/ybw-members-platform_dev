import { describe, it, expect } from 'vitest';
import { checkRateLimit, getClientIp } from '../rate-limit';

let _counter = 0;
function uniqueKey(prefix: string) {
  return `${prefix}-${++_counter}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const key = uniqueKey('allow');
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests over the limit', () => {
    const key = uniqueKey('block');
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks remaining correctly', () => {
    const key = uniqueKey('remaining');
    const r1 = checkRateLimit(key, 3, 60_000);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, 3, 60_000);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, 3, 60_000);
    expect(r3.remaining).toBe(0);

    const r4 = checkRateLimit(key, 3, 60_000);
    expect(r4.allowed).toBe(false);
  });

  it('different keys are independent', () => {
    const keyA = 'unique-indep-a-' + Math.random();
    const keyB = 'unique-indep-b-' + Math.random();
    
    // key-a: first call should be allowed
    const r1 = checkRateLimit(keyA, 2, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);

    // key-a: second call should be allowed (limit is 2)
    const r2 = checkRateLimit(keyA, 2, 60_000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    // key-a: third call should be blocked
    const r3 = checkRateLimit(keyA, 2, 60_000);
    expect(r3.allowed).toBe(false);

    // key-b: should still have full allowance (independent of key-a)
    const r4 = checkRateLimit(keyB, 2, 60_000);
    expect(r4.allowed).toBe(true);
    expect(r4.remaining).toBe(1);
  });
});

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
    });
    expect(getClientIp(request)).toBe('192.168.1.1');
  });

  it('extracts IP from x-real-ip header', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.2' }
    });
    expect(getClientIp(request)).toBe('10.0.0.2');
  });

  it('returns unknown when no IP headers present', () => {
    const request = new Request('http://localhost');
    expect(getClientIp(request)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '5.6.7.8',
      }
    });
    expect(getClientIp(request)).toBe('1.2.3.4');
  });
});
