import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/rateLimit';

const DEFAULT_ALLOWED_HOSTS = new Set([
  'cdn1.suno.ai',
  'cdn2.suno.ai',
  'cdn.suno.ai',
  'audiopipe.suno.ai',
]);
const MEDIA_PROXY_MAX_BYTES = 5 * 1024 * 1024;
const mediaProxyLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
  }

  let mediaUrl: URL;
  try {
    mediaUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'url 参数格式错误' }, { status: 400 });
  }

  if (mediaUrl.protocol !== 'https:') {
    return NextResponse.json({ error: '不支持的 url 协议' }, { status: 400 });
  }

  if (!getAllowedHosts().has(mediaUrl.hostname.toLowerCase())) {
    return NextResponse.json({ error: '不允许代理该域名' }, { status: 403 });
  }

  const rateLimit = mediaProxyLimiter.check(getClientIp(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后重试' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(mediaUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Referer: mediaUrl.origin,
        'User-Agent': 'Mozilla/5.0 MusesAOS/1.0',
      },
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[Media Proxy] Fetch failed:', error);
    return NextResponse.json({ error: '封面代理请求失败' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `封面加载失败 (${upstream.status})` },
      { status: upstream.status || 502 }
    );
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  if (!contentType.toLowerCase().startsWith('image/')) {
    return NextResponse.json({ error: '目标资源不是图片' }, { status: 415 });
  }

  const body = await readLimitedBody(upstream.body, MEDIA_PROXY_MAX_BYTES);
  if (!body) {
    return NextResponse.json({ error: '图片资源过大' }, { status: 413 });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function getAllowedHosts() {
  const hosts = new Set(DEFAULT_ALLOWED_HOSTS);
  for (const host of (process.env.MEDIA_PROXY_ALLOWED_HOSTS || '').split(',')) {
    const normalized = host.trim().toLowerCase();
    if (normalized) hosts.add(normalized);
  }
  return hosts;
}

function getClientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'local';
}

async function readLimitedBody(body: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
