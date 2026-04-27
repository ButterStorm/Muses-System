import { createRateLimiter } from '@/lib/rateLimit';

describe('createRateLimiter', () => {
  it('blocks a key after the configured number of attempts', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });

    expect(limiter.check('user-1')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check('user-1')).toMatchObject({ allowed: true, remaining: 0 });

    const blocked = limiter.check('user-1');

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check('user-1').allowed).toBe(true);
    expect(limiter.check('user-1').allowed).toBe(false);
    expect(limiter.check('user-2').allowed).toBe(true);
  });
});
