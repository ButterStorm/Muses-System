import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRateLimiter } from '@/lib/rateLimit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inviteCodeLimiter = createRateLimiter({ limit: 8, windowMs: 10 * 60 * 1000 });

function getServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase 配置错误');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 查询用户有效期
    if (body.action === 'check' && body.userId) {
      const supabase = getServerClient();
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

    const supabase = getServerClient();

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
      return NextResponse.json({ success: true, duration_days: inviteCode.duration_days });
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
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
