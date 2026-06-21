import { NextRequest, NextResponse } from 'next/server';
import { WaffoPancakeError } from '@waffo/pancake-ts';
import { CreditBillingError, getAuthenticatedUserId, getServerSupabaseClient } from '@/lib/credits';
import { createRateLimiter } from '@/lib/rateLimit';
import { getWaffoClient, isWaffoCreditPackId, WAFFO_CREDIT_PACKS } from '@/lib/waffo';

const checkoutLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    const rateLimit = checkoutLimiter.check(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '创建付款页面过于频繁，请稍后再试' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json().catch(() => null) as { packId?: unknown } | null;
    if (!isWaffoCreditPackId(body?.packId)) {
      return NextResponse.json({ error: '无效的积分充值档位' }, { status: 400 });
    }

    const pack = WAFFO_CREDIT_PACKS[body.packId];
    const supabase = getServerSupabaseClient();
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const successUrl = new URL('/', request.nextUrl.origin);
    successUrl.searchParams.set('payment', 'success');
    successUrl.searchParams.set('pack', pack.id);

    const session = await getWaffoClient().checkout.createSession({
      productId: pack.productId,
      currency: pack.currency,
      buyerEmail: authUser.user?.email,
      successUrl: successUrl.toString(),
      darkMode: true,
      metadata: {
        userId,
        creditPackId: pack.id,
        credits: String(pack.credits),
      },
      orderMerchantExternalId: `muses:${userId}:${pack.id}`,
    });

    return NextResponse.json({
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    if (error instanceof CreditBillingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof WaffoPancakeError) {
      console.error('[Waffo Checkout] SDK error:', error.status, error.errors);
      return NextResponse.json({ error: '付款页面创建失败，请稍后重试' }, { status: 502 });
    }

    console.error('[Waffo Checkout] Error:', error);
    return NextResponse.json({ error: '付款服务暂不可用' }, { status: 500 });
  }
}
