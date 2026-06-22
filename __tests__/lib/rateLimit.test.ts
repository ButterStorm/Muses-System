import { createPersistentRateLimiter, createRateLimiter } from '@/lib/rateLimit';

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

describe('createPersistentRateLimiter', () => {
  it('maps the Supabase RPC response to milliseconds', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ allowed: false, remaining: 0, retry_after_seconds: 12 }],
      error: null,
    });
    const limiter = createPersistentRateLimiter({
      limit: 10,
      windowMs: 60_000,
      prefix: 'test',
      client: { rpc },
    });

    await expect(limiter.check('user-1')).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterMs: 12_000,
    });
    expect(rpc).toHaveBeenCalledWith('check_api_rate_limit', {
      p_key: 'test:user-1',
      p_limit: 10,
      p_window_seconds: 60,
    });
  });

  it('fails closed when the persistent store errors', async () => {
    const limiter = createPersistentRateLimiter({
      limit: 1,
      windowMs: 1000,
      prefix: 'test',
      client: {
        rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'database unavailable' } }),
      },
    });

    await expect(limiter.check('user-1')).rejects.toThrow('database unavailable');
  });
});
