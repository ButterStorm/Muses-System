/** @jest-environment node */

import {
  calculateCreditCharge,
  createCreditBilling,
  CreditBillingError,
  type CreditReservationClient,
} from '@/lib/credits';

describe('credit pricing', () => {
  it('charges text requests by model tier', () => {
    expect(calculateCreditCharge({ feature: 'text', model: 'gpt-5-mini' }).points).toBe(1);
    expect(calculateCreditCharge({ feature: 'text', model: 'deepseek-v4-pro' }).points).toBe(3);
  });

  it('charges image requests by model and high-resolution size', () => {
    expect(calculateCreditCharge({ feature: 'image', model: 'doubao-seedream-5.0-lite', size: '2K' }).points).toBe(5);
    expect(calculateCreditCharge({ feature: 'image', model: 'gpt-image-2', size: '2K' }).points).toBe(10);
    expect(calculateCreditCharge({ feature: 'image', model: 'gpt-image-2', size: '4K' }).points).toBe(15);
  });

  it('charges video requests in 5-second blocks by provider tier', () => {
    expect(calculateCreditCharge({ feature: 'video', model: 'happyhorse', duration: 5 }).points).toBe(30);
    expect(calculateCreditCharge({ feature: 'video', model: 'kling', duration: 6 }).points).toBe(120);
    expect(calculateCreditCharge({ feature: 'video', model: 'seedance-2-0', duration: 15 }).points).toBe(180);
  });
});

describe('credit billing workflow', () => {
  let client: jest.Mocked<CreditReservationClient>;

  beforeEach(() => {
    client = {
      reserveCredits: jest.fn(),
      settleReservation: jest.fn(),
      refundReservation: jest.fn(),
      getBalance: jest.fn(),
    };
  });

  it('reserves credits before work and settles them after success', async () => {
    client.reserveCredits.mockResolvedValue({
      transactionId: 'tx-1',
      balancePoints: 97,
      frozenPoints: 3,
    });
    client.settleReservation.mockResolvedValue({
      transactionId: 'tx-1',
      balancePoints: 97,
      frozenPoints: 0,
    });

    const billing = createCreditBilling(client);
    const result = await billing.withReservation(
      'user-1',
      { feature: 'text', model: 'deepseek-v4-pro' },
      async () => ({ text: 'ok' })
    );

    expect(result).toEqual({
      text: 'ok',
      credits_charged: 3,
      credits_balance: 97,
      transaction_id: 'tx-1',
    });
    expect(client.reserveCredits).toHaveBeenCalledWith('user-1', expect.objectContaining({ points: 3 }));
    expect(client.settleReservation).toHaveBeenCalledWith('tx-1');
    expect(client.refundReservation).not.toHaveBeenCalled();
  });

  it('refunds the reservation when work fails', async () => {
    client.reserveCredits.mockResolvedValue({
      transactionId: 'tx-2',
      balancePoints: 90,
      frozenPoints: 10,
    });

    const billing = createCreditBilling(client);
    await expect(
      billing.withReservation(
        'user-1',
        { feature: 'image', model: 'gpt-image-2', size: '2K' },
        async () => {
          throw new Error('upstream failed');
        }
      )
    ).rejects.toThrow('upstream failed');

    expect(client.refundReservation).toHaveBeenCalledWith('tx-2', 'upstream failed');
    expect(client.settleReservation).not.toHaveBeenCalled();
  });

  it('throws a 402 billing error when credits are insufficient', async () => {
    client.reserveCredits.mockRejectedValue(
      new CreditBillingError('积分不足，请充值后再试', 402, 'INSUFFICIENT_CREDITS')
    );

    const billing = createCreditBilling(client);
    await expect(
      billing.withReservation('user-1', { feature: 'music', model: 'suno' }, async () => ({ songs: [] }))
    ).rejects.toMatchObject({
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
    });
  });
});
