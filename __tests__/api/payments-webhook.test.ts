/** @jest-environment node */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

const verifyWebhookMock = jest.fn();
const insertMock = jest.fn();

jest.mock('@waffo/pancake-ts', () => ({
  verifyWebhook: (...args: unknown[]) => verifyWebhookMock(...args),
  WebhookEventType: { OrderCompleted: 'order.completed' },
}));

jest.mock('@/lib/waffo', () => ({
  isWaffoCreditPackId: (value: unknown) => value === 'starter' || value === 'value',
  WAFFO_ENVIRONMENT: 'test',
  WAFFO_STORE_ID: 'store-1',
  WAFFO_CREDIT_PACKS: {
    starter: { id: 'starter', productName: 'Starter', amount: '1.00', currency: 'USD', credits: 100 },
    value: { id: 'value', productName: 'Value', amount: '10.00', currency: 'USD', credits: 1000 },
  },
}));

jest.mock('@/lib/credits', () => ({
  getServerSupabaseClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

import { POST } from '@/app/api/payments/waffo/webhook/route';

const validEvent = {
  id: 'delivery-1',
  eventId: 'event-1',
  eventType: 'order.completed',
  mode: 'test',
  storeId: 'store-1',
  data: {
    orderId: 'order-1',
    amount: '1.00',
    currency: 'USD',
    productName: 'Starter',
    orderMetadata: {
      userId: '11111111-1111-4111-8111-111111111111',
      creditPackId: 'starter',
    },
  },
};

function createRequest() {
  return new Request('http://localhost/api/payments/waffo/webhook', {
    method: 'POST',
    headers: { 'x-waffo-signature': 'valid-signature' },
    body: JSON.stringify({ event: 'payload' }),
  });
}

describe('Waffo payment webhook', () => {
  beforeEach(() => {
    verifyWebhookMock.mockReset().mockReturnValue(validEvent);
    insertMock.mockReset().mockResolvedValue({ error: null });
  });

  it('waits for the payment event insert before acknowledging delivery', async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      delivery_id: 'delivery-1',
      order_id: 'order-1',
      points: 100,
    }));
  });

  it('treats a unique violation as an idempotent replay', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505' } });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('returns 503 after transient database failures so Waffo can retry', async () => {
    jest.useFakeTimers();
    insertMock.mockResolvedValue({ error: { code: '08006', message: 'database unavailable' } });

    const responsePromise = POST(createRequest());
    await jest.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(insertMock).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('rejects invalid signatures without writing an event', async () => {
    verifyWebhookMock.mockImplementation(() => { throw new Error('invalid'); });

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
