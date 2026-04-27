interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function createRateLimiter({ limit, windowMs }: RateLimiterOptions) {
  const attempts = new Map<string, RateLimitEntry>();

  const prune = (now: number) => {
    for (const [key, entry] of attempts.entries()) {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    }
  };

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      prune(now);

      const existing = attempts.get(key);
      const entry = existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + windowMs };

      if (entry.count >= limit) {
        attempts.set(key, entry);
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(entry.resetAt - now, 0),
        };
      }

      entry.count += 1;
      attempts.set(key, entry);

      return {
        allowed: true,
        remaining: Math.max(limit - entry.count, 0),
        retryAfterMs: Math.max(entry.resetAt - now, 0),
      };
    },
    reset(key?: string) {
      if (key) {
        attempts.delete(key);
        return;
      }
      attempts.clear();
    },
  };
}
