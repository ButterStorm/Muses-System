/** @jest-environment node */

import { DELETE, PATCH, POST, PUT } from '@/app/api/agent/stream/route';
import { resetChatRuntimeContext, startChatSandboxRuntime, streamChat } from '@/lib/agents/muses-agent/chat';
import { disposeAgentRuntime } from '@/lib/agents/runtime/manager';
import { getAuthenticatedUserId } from '@/lib/credits';

jest.mock('@/lib/agents/muses-agent/chat', () => ({
  resetChatRuntimeContext: jest.fn(),
  startChatSandboxRuntime: jest.fn(),
  streamChat: jest.fn(),
}));

jest.mock('@/lib/agents/runtime/manager', () => ({
  disposeAgentRuntime: jest.fn(),
}));

jest.mock('@/lib/credits', () => ({
  CreditBillingError: class CreditBillingError extends Error {
    constructor(message: string, public readonly status: number, public readonly code: string) {
      super(message);
      this.name = 'CreditBillingError';
    }
  },
  getAuthenticatedUserId: jest.fn(),
}));

const mockedStreamChat = jest.mocked(streamChat);
const mockedStartChatSandboxRuntime = jest.mocked(startChatSandboxRuntime);
const mockedResetChatRuntimeContext = jest.mocked(resetChatRuntimeContext);
const mockedDisposeAgentRuntime = jest.mocked(disposeAgentRuntime);
const mockedGetAuthenticatedUserId = jest.mocked(getAuthenticatedUserId);

function createRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
    headers: new Headers({ authorization: 'Bearer test-token' }),
  };
}

async function readStream(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value);
  }
  return output;
}

describe('Agent stream API route', () => {
  beforeEach(() => {
    mockedStreamChat.mockReset();
    mockedStartChatSandboxRuntime.mockReset();
    mockedResetChatRuntimeContext.mockReset();
    mockedDisposeAgentRuntime.mockReset();
    mockedGetAuthenticatedUserId.mockResolvedValue('user_123');
  });

  it('streams runtime, delta, and done events', async () => {
    mockedStreamChat.mockImplementation(async ({ onEvent }) => {
      onEvent({ type: 'runtime', runtimeId: 'user:user_123', model: 'deepseek:deepseek-v4-flash' });
      onEvent({ type: 'delta', text: '你' });
      onEvent({ type: 'done', response: '你好' });
      return { response: '你好' };
    });

    const response = await POST(createRequest({ runtimeId: 'local:1', message: 'hi' }) as never);
    const output = await readStream(response as Response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(output).toContain('event: runtime');
    expect(output).toContain('"runtimeId":"user:user_123"');
    expect(output).toContain('event: delta');
    expect(output).toContain('"text":"你"');
    expect(output).toContain('event: done');
    expect(mockedStreamChat).toHaveBeenCalledWith(expect.objectContaining({
      runtimeId: 'user:user_123',
    }));
  });

  it('ignores late stream errors after the client cancels the response body', async () => {
    mockedStreamChat.mockImplementation(async ({ onEvent }) => {
      onEvent({ type: 'runtime', runtimeId: 'user:user_123', model: 'deepseek:deepseek-v4-flash' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      throw new Error('late failure');
    });

    const response = await POST(createRequest({ runtimeId: 'local:1', message: 'hi' }) as never);
    const reader = (response as Response).body!.getReader();

    await reader.read();
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(200);
  });

  it('returns 409 when a runtime is already streaming', async () => {
    mockedStreamChat.mockRejectedValue(new Error('AGENT_RUNTIME_BUSY'));

    const response = await POST(createRequest({ runtimeId: 'local:1', message: 'hi' }) as never);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('AI 助手正在处理上一条消息，请稍后再试');
  });

  it('rejects invalid models', async () => {
    const response = await POST(
      createRequest({ runtimeId: 'local:1', message: 'hi', model: 'deepseek-v4-flash' }) as never
    );

    expect(response.status).toBe(400);
    expect(mockedStreamChat).not.toHaveBeenCalled();
  });

  it('disposes a runtime on delete', async () => {
    const response = await DELETE(createRequest({ runtimeId: 'local:1' }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockedDisposeAgentRuntime).toHaveBeenCalledWith('user:user_123');
  });

  it('waits for runtime disposal before returning from delete', async () => {
    let resolveDispose: () => void = () => undefined;
    mockedDisposeAgentRuntime.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveDispose = resolve;
    }));

    const responsePromise = DELETE(createRequest({ runtimeId: 'local:1' }) as never);
    let settled = false;
    responsePromise.then(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    resolveDispose();
    const response = await responsePromise;

    expect(response.status).toBe(200);
  });

  it('rejects delete requests without a runtime id', async () => {
    const response = await DELETE(createRequest({ runtimeId: '' }) as never);

    expect(response.status).toBe(400);
    expect(mockedDisposeAgentRuntime).not.toHaveBeenCalled();
  });

  it('resets runtime context without disposing the runtime', async () => {
    mockedResetChatRuntimeContext.mockResolvedValue(true);

    const response = await PATCH(createRequest({ runtimeId: 'local:1' }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, reset: true });
    expect(mockedResetChatRuntimeContext).toHaveBeenCalledWith({
      runtimeId: 'user:user_123',
      model: 'deepseek:deepseek-v4-flash',
    });
    expect(mockedDisposeAgentRuntime).not.toHaveBeenCalled();
  });

  it('starts the authenticated user sandbox on put', async () => {
    mockedStartChatSandboxRuntime.mockImplementation(async ({ onEvent }) => {
      onEvent({ type: 'runtime', runtimeId: 'user:user_123', model: 'deepseek:deepseek-v4-flash' });
      onEvent({ type: 'done', response: 'sandbox started' });
    });

    const response = await PUT(createRequest({ runtimeId: 'project:other' }) as never);
    const output = await readStream(response as Response);

    expect(response.status).toBe(200);
    expect(output).toContain('"runtimeId":"user:user_123"');
    expect(mockedStartChatSandboxRuntime).toHaveBeenCalledWith(expect.objectContaining({
      runtimeId: 'user:user_123',
    }));
  });
});
