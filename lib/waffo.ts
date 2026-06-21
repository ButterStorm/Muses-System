import 'server-only';

import { WaffoPancake } from '@waffo/pancake-ts';

export const WAFFO_STORE_ID = 'STO_46QFoZN6ZR1sudB6hIR6b1';
export const WAFFO_ENVIRONMENT = process.env.WAFFO_ENVIRONMENT === 'test' ? 'test' : 'prod';

export const WAFFO_CREDIT_PACKS = {
  starter: {
    id: 'starter',
    productId: process.env.WAFFO_PRODUCT_STARTER_ID || 'PROD_1Gy277SgzqCmj0akjl2jYJ',
    productName: 'AI-TEST',
    amount: '1.00',
    currency: 'USD',
    credits: 100,
  },
  value: {
    id: 'value',
    productId: process.env.WAFFO_PRODUCT_VALUE_ID || 'PROD_2KBWdeDWDoJitS5pAFnboV',
    productName: 'AI Credit',
    amount: '10.00',
    currency: 'USD',
    credits: 1000,
  },
} as const;

export type WaffoCreditPackId = keyof typeof WAFFO_CREDIT_PACKS;

export function isWaffoCreditPackId(value: unknown): value is WaffoCreditPackId {
  return typeof value === 'string' && value in WAFFO_CREDIT_PACKS;
}

let client: WaffoPancake | null = null;

export function getWaffoClient() {
  const merchantId = process.env.WAFFO_MERCHANT_ID;
  const privateKey = process.env.WAFFO_PRIVATE_KEY;

  if (!merchantId || !privateKey) {
    throw new Error('Waffo Pancake 服务端配置不完整');
  }

  if (!client) {
    client = new WaffoPancake({ merchantId, privateKey });
  }

  return client;
}
