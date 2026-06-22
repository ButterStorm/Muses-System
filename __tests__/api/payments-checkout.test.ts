/** @jest-environment node */

const createSessionMock = jest.fn();
const getAuthenticatedUserIdMock = jest.fn();
const rateLimitCheckMock = jest.fn();

jest.mock('@waffo/pancake-ts', () => ({
  WaffoPancakeError: class WaffoPancakeError extends Error {},
}));

jest.mock('@/lib/rateLimit', () => ({
  createPersistentRateLimiter: () => ({ check: rateLimitCheckMock }),
}));

jest.mock('@/lib/waffo', () => ({
  getWaffoClient: () => ({ checkout: { createSession: createSessionMock } }),
  isWaffoCreditPackId: (value: unknown) => value === 'starter' || value === 'value',
  WAFFO_CREDIT_PACKS: {
    starter: { id: 'starter', productId: 'product-1', currency: 'USD', credits: 100 },
    value: { id: 'value', productId: 'product-2', currency: 'USD', credits: 1000 },
  },
}));

jest.mock('@/lib/credits', () => ({
  CreditBillingError: class CreditBillingError extends Error {},
  getAuthenticatedUserId: (...args: unknown[]) => getAuthenticatedUserIdMock(...args),
  getServerSupabaseClient: () => ({
    auth: { admin: { getUserById: jest.fn().mockResolvedValue({ data: { user: { email: 'user@example.com' } } }) } },
  }),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/payments/checkout/route';

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/payments/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
    body: JSON.stringify(body),
  });
}

describe('Waffo checkout API', () => {
  beforeEach(() => {
    getAuthenticatedUserIdMock.mockReset().mockResolvedValue('11111111-1111-4111-8111-111111111111');
    rateLimitCheckMock.mockReset().mockResolvedValue({ allowed: true, remaining: 9, retryAfterMs: 600_000 });
    createSessionMock.mockReset().mockResolvedValue({
      checkoutUrl: 'https://checkout.example/session-1',
      sessionId: 'session-1',
      expiresAt: '2026-06-22T12:00:00Z',
    });
  });

  it('creates a checkout session with server-owned credit metadata', async () => {
    const response = await POST(createRequest({ packId: 'starter' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checkoutUrl).toBe('https://checkout.example/session-1');
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      productId: 'product-1',
      metadata: {
        userId: '11111111-1111-4111-8111-111111111111',
        creditPackId: 'starter',
        credits: '100',
      },
    }));
  });

  it('rejects unknown packs before creating a session', async () => {
    const response = await POST(createRequest({ packId: 'unknown' }));

    expect(response.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('uses the persistent limiter result', async () => {
    rateLimitCheckMock.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 12_000 });

    const response = await POST(createRequest({ packId: 'starter' }));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('12');
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});
