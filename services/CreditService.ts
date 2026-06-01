import axios from 'axios';
import type {
  CreditBalance,
  CreditTransaction as BackendCreditTransaction,
} from '@/lib/credits';
import { API_TIMEOUTS, createApiClient } from './apiClient';

const axiosClient = createApiClient(API_TIMEOUTS.standard);

export type { CreditBalance };

export type CreditTransaction = Pick<
  BackendCreditTransaction,
  'id' | 'type' | 'status' | 'points' | 'feature' | 'model' | 'reason' | 'created_at' | 'settled_at'
>;

export async function getCreditBalance(): Promise<CreditBalance | null> {
  try {
    const response = await axiosClient.get<CreditBalance>('/credits/balance');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function getCreditTransactions(): Promise<CreditTransaction[]> {
  const response = await axiosClient.get<{ transactions: CreditTransaction[] }>('/credits/transactions');
  return response.data.transactions;
}
