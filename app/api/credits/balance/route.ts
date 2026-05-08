import { NextRequest, NextResponse } from 'next/server';
import {
  createSupabaseCreditClient,
  creditErrorResponse,
  getAuthenticatedUserId,
} from '@/lib/credits';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    const balance = await createSupabaseCreditClient().getBalance(userId);
    return NextResponse.json(balance);
  } catch (error) {
    const creditResponse = creditErrorResponse(error);
    if (creditResponse) return creditResponse;

    console.error('[Credits Balance API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '积分余额查询失败' },
      { status: 500 }
    );
  }
}
