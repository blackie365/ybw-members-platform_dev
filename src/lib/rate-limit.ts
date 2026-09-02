/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window counter per IP address.
 * 
 * In production on Vercel, each function instance has its own memory,
 * so this is a best-effort limiter. For strict rate limiting, use
 * an external service like Upstash Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/** Clear all rate limit state. Exported for testing only. */
export function _resetRateLimitStore(): void {
  store.clear();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (typically IP address).
 * @param key - Unique identifier (e.g., IP address or IP + route)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client IP from request headers.
 *
 * The app sits behind a single trusted nginx proxy that sets:
 *   - `x-real-ip` = `$remote_addr` (the true TCP peer = the end client), and
 *   - `x-forwarded-for` = `$proxy_add_x_forwarded_for`, which APPENDS the
 *     peer's address to whatever the client supplied.
 *
 * A client can therefore spoof the FIRST entry of `x-forwarded-for`; reading
 * the first value would let a caller collide with / impersonate another key
 * (and, in a shared/VPN/NAT setup, would fold many users onto one key, blasting
 * past the page limit and producing 429s). So prefer the trusted `x-real-ip`,
 * and for `x-forwarded-for` take the RIGHTMOST address (the one nginx appended),
 * which is the real peer.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    const last = parts[parts.length - 1];
    return (last || '').trim();
  }
  return 'unknown';
}
