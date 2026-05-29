import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

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

  if (!ALLOWED_PROTOCOLS.has(mediaUrl.protocol)) {
    return NextResponse.json({ error: '不支持的 url 协议' }, { status: 400 });
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

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
