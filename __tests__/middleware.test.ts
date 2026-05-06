/** @jest-environment node */

import { NextRequest } from 'next/server';
import {
  __getRateLimitSizeForTests,
  __resetRateLimitForTests,
  __setRateLimitCleanupIntervalForTests,
  middleware,
} from '@/middleware';

function createApiRequest(ip: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/demo', {
    headers: {
      'x-forwarded-for': ip,
    },
  });
}

describe('middleware rate limiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetRateLimitForTests();
    __setRateLimitCleanupIntervalForTests(60_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cleans expired rate-limit records on a deterministic interval', () => {
    middleware(createApiRequest('198.51.100.1'));
    expect(__getRateLimitSizeForTests()).toBe(1);

    jest.advanceTimersByTime(61_000);
    middleware(createApiRequest('198.51.100.2'));

    expect(__getRateLimitSizeForTests()).toBe(1);
  });

  it('returns 429 when an ip exceeds the request limit', async () => {
    let response = middleware(createApiRequest('203.0.113.1'));
    for (let i = 0; i < 50; i++) {
      response = middleware(createApiRequest('203.0.113.1'));
    }

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: '请求过于频繁，请稍后再试' });
  });
});
