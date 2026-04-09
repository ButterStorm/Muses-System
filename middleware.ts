import { NextRequest, NextResponse } from 'next/server';

// 简单的内存限流器
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000; // 1 分钟窗口
const MAX_REQUESTS = 50; // 每个 IP 每分钟最多 50 次请求

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

export function middleware(request: NextRequest) {
  // 仅对 API 路由限流
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const key = getRateLimitKey(request);
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
  } else {
    record.count++;
  }

  const current = rateLimitMap.get(key)!;

  if (current.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后再试' },
      { status: 429 }
    );
  }

  // 定期清理过期记录
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetTime) rateLimitMap.delete(k);
    }
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(MAX_REQUESTS));
  response.headers.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - current.count)));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
