/** @jest-environment node */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

import { POST } from '@/app/api/invite-code/route';
import { NextRequest } from 'next/server';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/invite-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid-token',
    },
    body: JSON.stringify(body),
  });
}

describe('Invite Code API Route', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    mockSupabase.from.mockReset();
    mockSupabase.rpc.mockReset();
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  });

  it('should reject request without code and userId', async () => {
    const req = createRequest({ action: 'activate' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('缺少激活码或用户信息');
  });

  it('should reject request with empty code', async () => {
    const req = createRequest({ code: '', userId });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return expires_at null for non-existent activation (check action)', async () => {
    mockSupabase.from.mockReturnValue(createSelectChain({ data: null, error: null }));

    const req = createRequest({ action: 'check', userId });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expires_at).toBeNull();
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid-token');
  });

  it('should reject check action for invalid userId format', async () => {
    const req = createRequest({ action: 'check', userId: 'not-a-uuid' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('参数格式错误');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should reject check action for a different authenticated user', async () => {
    const req = createRequest({ action: 'check', userId: otherUserId });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('无权查询');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should grant 1000 credits when an invite code is activated for the first time', async () => {
    mockSupabase.from
      .mockReturnValueOnce(createSelectChain({
        data: {
          id: 'invite-1',
          code: 'WELCOME',
          is_enabled: true,
          is_activated: false,
          duration_days: 30,
          user_id: null,
          activated_at: null,
        },
        error: null,
      }))
      .mockReturnValueOnce(createUpdateChain({ error: null }));

    const req = createRequest({ code: 'WELCOME', userId });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, duration_days: 30, credits_granted: 1000 });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('grant_user_credits', {
      p_user_id: userId,
      p_points: 1000,
      p_reason: 'invite code activation: WELCOME',
    });
  });

  it('should not grant credits again when the same user verifies an already activated code', async () => {
    mockSupabase.from.mockReturnValueOnce(createSelectChain({
      data: {
        id: 'invite-1',
        code: 'WELCOME',
        is_enabled: true,
        is_activated: true,
        duration_days: 30,
        user_id: userId,
        activated_at: new Date().toISOString(),
      },
      error: null,
    }));

    const req = createRequest({ code: 'WELCOME', userId });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, duration_days: 30 });
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

function createSelectChain(result: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
}

function createUpdateChain(result: { error: unknown }) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result),
  };
}
