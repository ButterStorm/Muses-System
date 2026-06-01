import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/rateLimit';
import { CreditBillingError, getAuthenticatedUserId, getServerSupabaseClient } from '@/lib/credits';

const inviteCodeLimiter = createRateLimiter({ limit: 8, windowMs: 10 * 60 * 1000 });
const INVITE_ACTIVATION_CREDITS = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 查询用户有效期
    if (body.action === 'check' && body.userId) {
      if (typeof body.userId !== 'string' || !UUID_PATTERN.test(body.userId)) {
        return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
      }

      const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      const clientKey = `${forwardedFor || 'local'}:${body.userId}`;
      const rateLimit = inviteCodeLimiter.check(clientKey);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: '尝试次数过多，请稍后再试' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
            },
          }
        );
      }

      const authenticatedUserId = await getAuthenticatedUserId(request);
      if (body.userId !== authenticatedUserId) {
        return NextResponse.json({ error: '无权查询' }, { status: 403 });
      }

      const supabase = getServerSupabaseClient();
      const { data: inviteCode } = await supabase
        .from('invite_codes')
        .select('activated_at, duration_days')
        .eq('user_id', body.userId)
        .eq('is_activated', true)
        .single();

      if (!inviteCode?.activated_at) {
        return NextResponse.json({ expires_at: null });
      }
      const expiresAt = new Date(inviteCode.activated_at);
      expiresAt.setDate(expiresAt.getDate() + inviteCode.duration_days);
      return NextResponse.json({ expires_at: expiresAt.toISOString() });
    }

    const { code, userId } = body;

    if (!code || !userId) {
      return NextResponse.json({ error: '缺少激活码或用户信息' }, { status: 400 });
    }

    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientKey = `${forwardedFor || 'local'}:${userId}`;
    const rateLimit = inviteCodeLimiter.check(clientKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '尝试次数过多，请稍后再试' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
          },
        }
      );
    }

    const supabase = getServerSupabaseClient();

    const { data: inviteCode, error: queryError } = await supabase
      .from('invite_codes')
      .select('id, code, is_enabled, is_activated, duration_days, user_id, activated_at')
      .eq('code', code.trim())
      .single();

    if (queryError || !inviteCode) {
      return NextResponse.json({ error: '激活码不存在' }, { status: 404 });
    }

    if (!inviteCode.is_enabled) {
      return NextResponse.json({ error: '该激活码已被禁用' }, { status: 403 });
    }

    if (!inviteCode.is_activated) {
      // 首次激活：绑定用户
      const { error: updateError } = await supabase
        .from('invite_codes')
        .update({
          is_activated: true,
          user_id: userId,
          activated_at: new Date().toISOString(),
        })
        .eq('id', inviteCode.id);

      if (updateError) {
        return NextResponse.json({ error: '激活失败，请重试' }, { status: 500 });
      }

      const { error: creditError } = await supabase.rpc('grant_user_credits', {
        p_user_id: userId,
        p_points: INVITE_ACTIVATION_CREDITS,
        p_reason: `invite code activation: ${code.trim()}`,
      });

      if (creditError) {
        console.error('[Invite Code API] Credit grant failed:', creditError);
        return NextResponse.json({ error: '激活成功，但积分赠送失败，请联系管理员' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        duration_days: inviteCode.duration_days,
        credits_granted: INVITE_ACTIVATION_CREDITS,
      });
    }

    // 已激活：验证是否属于当前用户 + 是否过期
    if (inviteCode.user_id !== userId) {
      return NextResponse.json({ error: '该激活码不属于您' }, { status: 403 });
    }

    if (inviteCode.activated_at) {
      const expiresAt = new Date(inviteCode.activated_at);
      expiresAt.setDate(expiresAt.getDate() + inviteCode.duration_days);
      if (expiresAt < new Date()) {
        return NextResponse.json({ error: '激活码已过期' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, duration_days: inviteCode.duration_days });
  } catch (error) {
    if (error instanceof CreditBillingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
