/** @jest-environment node */

import { NextRequest } from 'next/server';

const fetchMock = jest.fn();
global.fetch = fetchMock;

let GET: typeof import('@/app/api/media/proxy/route')['GET'];

beforeAll(async () => {
  ({ GET } = await import('@/app/api/media/proxy/route'));
});

function createRequest(url: string, ip = '203.0.113.10') {
  return new NextRequest(`http://localhost:3000/api/media/proxy?url=${encodeURIComponent(url)}`, {
    headers: {
      'x-forwarded-for': ip,
    },
  });
}

describe('Media Proxy API Route', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('proxies allowed Suno HTTPS image hosts', async () => {
    fetchMock.mockResolvedValue(new Response('image-bytes', {
      status: 200,
      headers: {
        'content-type': 'image/png',
      },
    }));

    const res = await GET(createRequest('https://cdn1.suno.ai/covers/cover.png'));
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(body).toBe('image-bytes');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://cdn1.suno.ai/covers/cover.png'),
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('rejects HTTP URLs', async () => {
    const res = await GET(createRequest('http://cdn1.suno.ai/covers/cover.png', '203.0.113.11'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('不支持的 url 协议');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects hosts outside the allowlist', async () => {
    const res = await GET(createRequest('https://example.com/cover.png', '203.0.113.12'));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('不允许代理该域名');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-image responses', async () => {
    fetchMock.mockResolvedValue(new Response('not image', {
      status: 200,
      headers: {
        'content-type': 'text/html',
      },
    }));

    const res = await GET(createRequest('https://cdn2.suno.ai/page.html', '203.0.113.13'));
    const data = await res.json();

    expect(res.status).toBe(415);
    expect(data.error).toBe('目标资源不是图片');
  });

  it('rejects responses larger than the configured limit', async () => {
    fetchMock.mockResolvedValue(new Response('x'.repeat(5 * 1024 * 1024 + 1), {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
      },
    }));

    const res = await GET(createRequest('https://cdn.suno.ai/large.jpg', '203.0.113.14'));
    const data = await res.json();

    expect(res.status).toBe(413);
    expect(data.error).toBe('图片资源过大');
  });

  it('rate limits repeated requests by IP', async () => {
    fetchMock.mockImplementation(async () => new Response('ok', {
      status: 200,
      headers: {
        'content-type': 'image/webp',
      },
    }));

    let res = await GET(createRequest('https://audiopipe.suno.ai/cover.webp', '203.0.113.15'));
    for (let i = 1; i < 61; i++) {
      res = await GET(createRequest('https://audiopipe.suno.ai/cover.webp', '203.0.113.15'));
    }

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
