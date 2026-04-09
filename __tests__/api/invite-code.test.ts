import { POST } from '@/app/api/invite-code/route';
import { NextRequest } from 'next/server';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/invite-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Invite Code API Route', () => {
  it('should reject request without code and userId', async () => {
    const req = createRequest({ action: 'activate' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('缺少激活码或用户信息');
  });

  it('should reject request with empty code', async () => {
    const req = createRequest({ code: '', userId: 'user-1' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return expires_at null for non-existent activation (check action)', async () => {
    const req = createRequest({ action: 'check', userId: 'nonexistent-user' });
    const res = await POST(req);
    const data = await res.json();
    // Will either be null or an error depending on Supabase mock
    expect(res.status).toBe(200);
    expect(data.expires_at).toBeNull();
  });
});
