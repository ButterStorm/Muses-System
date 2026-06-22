import { NextResponse } from 'next/server';
import { verifyWebhook, WebhookEventType, type WebhookEventData } from '@waffo/pancake-ts';
import { getServerSupabaseClient } from '@/lib/credits';
import {
  isWaffoCreditPackId,
  WAFFO_CREDIT_PACKS,
  WAFFO_ENVIRONMENT,
  WAFFO_STORE_ID,
} from '@/lib/waffo';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-waffo-signature');

  let event;
  try {
    event = verifyWebhook<WebhookEventData>(rawBody, signature, { environment: WAFFO_ENVIRONMENT });
  } catch (error) {
    console.warn('[Waffo Webhook] Signature rejected:', error instanceof Error ? error.message : 'unknown');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  if (event.mode !== WAFFO_ENVIRONMENT || event.storeId !== WAFFO_STORE_ID) {
    return new NextResponse('Ignored', { status: 200 });
  }

  if (event.eventType !== WebhookEventType.OrderCompleted) {
    return new NextResponse('OK', { status: 200 });
  }

  const packId = event.data.orderMetadata?.creditPackId;
  const userId = event.data.orderMetadata?.userId;
  if (!isWaffoCreditPackId(packId) || !userId) {
    console.error('[Waffo Webhook] Missing trusted checkout metadata', { eventId: event.id });
    return new NextResponse('Invalid order metadata', { status: 400 });
  }

  const pack = WAFFO_CREDIT_PACKS[packId];
  const amountMatches = Number(event.data.amount) === Number(pack.amount);
  if (
    event.data.productName !== pack.productName ||
    event.data.currency !== pack.currency ||
    !amountMatches
  ) {
    console.error('[Waffo Webhook] Product validation failed', {
      eventId: event.id,
      orderId: event.data.orderId,
      packId,
    });
    return new NextResponse('Product mismatch', { status: 400 });
  }

  const payload = JSON.parse(rawBody);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const supabase = getServerSupabaseClient();
    const { error } = await supabase.from('waffo_payment_events').insert({
      delivery_id: event.id,
      event_id: event.eventId,
      order_id: event.data.orderId,
      user_id: userId,
      pack_id: pack.id,
      points: pack.credits,
      amount: pack.amount,
      currency: pack.currency,
      payload,
    });

    if (!error || error.code === '23505') {
      return new NextResponse('OK', { status: 200 });
    }

    console.error(`[Waffo Webhook] Credit fulfillment attempt ${attempt} failed:`, error);
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  return new NextResponse('Credit fulfillment failed', {
    status: 503,
    headers: { 'Retry-After': '5' },
  });
}
