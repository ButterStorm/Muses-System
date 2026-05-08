import axios from 'axios';
import { API_TIMEOUTS, createApiClient } from './apiClient';

const axiosClient = createApiClient(API_TIMEOUTS.standard);

export interface CreditBalance {
  balance_points: number;
  frozen_points: number;
  available_points: number;
  lifetime_granted_points: number;
  lifetime_spent_points: number;
}

export interface CreditTransaction {
  id: string;
  type: string;
  status: string;
  points: number;
  feature: string | null;
  model: string | null;
  reason: string | null;
  created_at: string;
  settled_at: string | null;
}

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
