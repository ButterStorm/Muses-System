import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export type CreditFeature = 'text' | 'image' | 'video' | 'music' | 'audio_speech' | 'audio_transcribe';

export interface CreditChargeInput {
  feature: CreditFeature;
  model: string;
  size?: string;
  duration?: number;
  referenceCount?: number;
}

export interface CreditCharge {
  feature: CreditFeature;
  model: string;
  points: number;
  metadata: Record<string, unknown>;
}

export interface CreditReservation {
  transactionId: string;
  balancePoints: number;
  frozenPoints: number;
}

export interface CreditReservationClient {
  reserveCredits(userId: string, charge: CreditCharge): Promise<CreditReservation>;
  settleReservation(transactionId: string): Promise<CreditReservation>;
  refundReservation(transactionId: string, reason: string): Promise<CreditReservation>;
  getBalance(userId: string): Promise<CreditBalance>;
}

export interface CreditBalance {
  balance_points: number;
  frozen_points: number;
  available_points: number;
  lifetime_granted_points: number;
  lifetime_spent_points: number;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: string;
  status: string;
  points: number;
  feature: string | null;
  model: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  settled_at: string | null;
}

export class CreditBillingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'CreditBillingError';
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let serverClient: SupabaseClient | null = null;

export function calculateCreditCharge(input: CreditChargeInput): CreditCharge {
  const metadata: Record<string, unknown> = {};
  let points: number;

  if (input.feature === 'text') {
    const premiumTextModels = new Set(['deepseek-v4-pro', 'kimi-k2.5', 'gemini-3-pro']);
    points = premiumTextModels.has(input.model) ? 3 : 1;
  } else if (input.feature === 'image') {
    const premiumImageModels = new Set(['gpt-image-2', 'gemini-3-pro-image']);
    points = premiumImageModels.has(input.model) ? 10 : 5;
    if (input.size === '4K') points += 5;
    if (input.referenceCount && input.referenceCount > 3) points += 2;
    metadata.size = input.size;
    metadata.reference_count = input.referenceCount || 0;
  } else if (input.feature === 'video') {
    const premiumVideoProviders = new Set(['kling', 'doubao', 'seedance-2-0']);
    const unit = premiumVideoProviders.has(input.model) ? 60 : 30;
    const blocks = Math.max(1, Math.ceil((input.duration || 5) / 5));
    points = unit * blocks;
    metadata.duration = input.duration || 5;
  } else if (input.feature === 'music') {
    points = 20;
  } else {
    points = 2;
  }

  return {
    feature: input.feature,
    model: input.model,
    points,
    metadata,
  };
}

export function createCreditBilling(client: CreditReservationClient) {
  return {
    async withReservation<T extends Record<string, unknown>>(
      userId: string,
      input: CreditChargeInput,
      work: () => Promise<T>
    ): Promise<T & { credits_charged: number; credits_balance: number; transaction_id: string }> {
      const charge = calculateCreditCharge(input);
      const reservation = await client.reserveCredits(userId, charge);

      try {
        const result = await work();
        const settled = await client.settleReservation(reservation.transactionId);
        return {
          ...result,
          credits_charged: charge.points,
          credits_balance: settled.balancePoints,
          transaction_id: reservation.transactionId,
        };
      } catch (error) {
        await Promise.resolve(client.refundReservation(
          reservation.transactionId,
          error instanceof Error ? error.message : '生成失败'
        )).catch((refundError) => {
          console.error('[Credits] Refund failed:', refundError);
        });
        throw error;
      }
    },
  };
}

export function getServerSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new CreditBillingError('服务器配置错误：Supabase 服务密钥未配置', 500, 'CREDITS_NOT_CONFIGURED');
  }

  if (!serverClient) {
    serverClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return serverClient;
}

export async function getAuthenticatedUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!token) {
    throw new CreditBillingError('请先登录后再使用积分生成', 401, 'AUTH_REQUIRED');
  }

  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new CreditBillingError('登录状态已失效，请重新登录', 401, 'AUTH_INVALID');
  }

  return data.user.id;
}

export function createSupabaseCreditClient(supabase = getServerSupabaseClient()): CreditReservationClient {
  return {
    async reserveCredits(userId, charge) {
      const { data, error } = await supabase.rpc('reserve_user_credits', {
        p_user_id: userId,
        p_points: charge.points,
        p_feature: charge.feature,
        p_model: charge.model,
        p_metadata: charge.metadata,
      });

      if (error) throw mapSupabaseCreditError(error);
      return mapReservation(data);
    },

    async settleReservation(transactionId) {
      const { data, error } = await supabase.rpc('settle_credit_reservation', {
        p_transaction_id: transactionId,
      });

      if (error) throw mapSupabaseCreditError(error);
      return mapReservation(data);
    },

    async refundReservation(transactionId, reason) {
      const { data, error } = await supabase.rpc('refund_credit_reservation', {
        p_transaction_id: transactionId,
        p_reason: reason,
      });

      if (error) throw mapSupabaseCreditError(error);
      return mapReservation(data);
    },

    async getBalance(userId) {
      const { data, error } = await supabase
        .from('user_credit_accounts')
        .select('balance_points, frozen_points, lifetime_granted_points, lifetime_spent_points')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            balance_points: 0,
            frozen_points: 0,
            available_points: 0,
            lifetime_granted_points: 0,
            lifetime_spent_points: 0,
          };
        }
        throw mapSupabaseCreditError(error);
      }

      const balancePoints = Number(data?.balance_points || 0);
      const frozenPoints = Number(data?.frozen_points || 0);
      return {
        balance_points: balancePoints,
        frozen_points: frozenPoints,
        available_points: Math.max(balancePoints - frozenPoints, 0),
        lifetime_granted_points: Number(data?.lifetime_granted_points || 0),
        lifetime_spent_points: Number(data?.lifetime_spent_points || 0),
      };
    },
  };
}

export async function withCreditBilling<T extends Record<string, unknown>>(
  request: NextRequest,
  input: CreditChargeInput,
  work: () => Promise<T>
) {
  const userId = await getAuthenticatedUserId(request);
  const billing = createCreditBilling(createSupabaseCreditClient());
  return billing.withReservation(userId, input, work);
}

export function creditErrorResponse(error: unknown) {
  if (error instanceof CreditBillingError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  return null;
}

export async function listCreditTransactions(userId: string): Promise<CreditTransaction[]> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('id, user_id, type, status, points, feature, model, reason, metadata, created_at, settled_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw mapSupabaseCreditError(error);
  return (data || []) as CreditTransaction[];
}

function mapReservation(data: unknown): CreditReservation {
  const row = Array.isArray(data) ? data[0] : data;
  const value = row as {
    transaction_id?: string;
    balance_points?: number;
    frozen_points?: number;
  } | null;

  if (!value?.transaction_id) {
    throw new CreditBillingError('积分流水返回异常', 500, 'CREDIT_RPC_INVALID_RESPONSE');
  }

  return {
    transactionId: value.transaction_id,
    balancePoints: Number(value.balance_points || 0),
    frozenPoints: Number(value.frozen_points || 0),
  };
}

function mapSupabaseCreditError(error: { message?: string; code?: string }) {
  const message = error.message || '积分系统错误';
  if (message.includes('INSUFFICIENT_CREDITS')) {
    return new CreditBillingError('积分不足，请充值后再试', 402, 'INSUFFICIENT_CREDITS');
  }
  if (message.includes('CREDIT_TRANSACTION_NOT_FOUND')) {
    return new CreditBillingError('积分流水不存在', 404, 'CREDIT_TRANSACTION_NOT_FOUND');
  }
  return new CreditBillingError(message, 500, error.code || 'CREDIT_SYSTEM_ERROR');
}
