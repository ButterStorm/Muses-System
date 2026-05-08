import { NextRequest, NextResponse } from 'next/server';
import {
  creditErrorResponse,
  getAuthenticatedUserId,
  listCreditTransactions,
} from '@/lib/credits';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    const transactions = await listCreditTransactions(userId);
    return NextResponse.json({ transactions });
  } catch (error) {
    const creditResponse = creditErrorResponse(error);
    if (creditResponse) return creditResponse;

    console.error('[Credits Transactions API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '积分流水查询失败' },
      { status: 500 }
    );
  }
}
