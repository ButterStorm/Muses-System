import { NextRequest, NextResponse } from 'next/server';

// 简单的内存限流器
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000; // 1 分钟窗口
const MAX_REQUESTS = 50; // 每个 IP 每分钟最多 50 次请求
const MAX_TRACKED_KEYS = 10_000;
let cleanupIntervalMs = 60_000;
let lastCleanupTime = 0;

function cleanupExpiredRecords(now: number) {
  if (now - lastCleanupTime < cleanupIntervalMs && rateLimitMap.size <= MAX_TRACKED_KEYS) {
    return;
  }

  lastCleanupTime = now;
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }

  if (rateLimitMap.size <= MAX_TRACKED_KEYS) {
    return;
  }

  const overflow = rateLimitMap.size - MAX_TRACKED_KEYS;
  let removed = 0;
  for (const key of rateLimitMap.keys()) {
    rateLimitMap.delete(key);
    removed++;
    if (removed >= overflow) break;
  }
}

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
  cleanupExpiredRecords(now);
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

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(MAX_REQUESTS));
  response.headers.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - current.count)));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};

export function __resetRateLimitForTests() {
  rateLimitMap.clear();
  lastCleanupTime = 0;
  cleanupIntervalMs = 60_000;
}

export function __getRateLimitSizeForTests(): number {
  return rateLimitMap.size;
}

export function __setRateLimitCleanupIntervalForTests(intervalMs: number) {
  cleanupIntervalMs = intervalMs;
}
