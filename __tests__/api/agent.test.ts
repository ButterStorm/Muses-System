/** @jest-environment node */

import { POST } from '@/app/api/agent/route';
import { chat } from '@/lib/agents/muses-agent-sdk/chat';

jest.mock('@/lib/agents/muses-agent-sdk/chat', () => ({
  chat: jest.fn(),
}));

const mockedChat = jest.mocked(chat);

function createRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  };
}

describe('Agent API Route', () => {
  beforeEach(() => {
    mockedChat.mockReset();
  });

  it('should reject an empty message', async () => {
    const req = createRequest({ message: '' });

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('输入验证失败');
  });

  it('should return the SDK response for a valid request', async () => {
    mockedChat.mockResolvedValue({ response: '本地 SDK 已接管。' });

    const req = createRequest({ message: '你好', model: 'openai:gpt-4o' });

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ response: '本地 SDK 已接管。' });
    expect(mockedChat).toHaveBeenCalledWith({
      message: '你好',
      model: 'openai:gpt-4o',
    });
  });

  it('should surface a stable error when the SDK throws', async () => {
    mockedChat.mockRejectedValue(new Error('boom'));

    const req = createRequest({ message: '你好' });

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: 'AI 助手响应失败，请稍后重试' });
  });

  it('should not leak SDK configuration details when the SDK mentions OPENAI_API_KEY', async () => {
    mockedChat.mockRejectedValue(new Error('OPENAI_API_KEY is missing: sk-test-secret'));

    const req = createRequest({ message: '你好' });

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('AI 服务配置异常，请联系管理员');
    expect(data.error).not.toContain('OPENAI_API_KEY');
    expect(data.error).not.toContain('sk-test-secret');
  });
});
