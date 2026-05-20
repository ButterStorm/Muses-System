import { agentService } from '@/services/agentService';
import { TextDecoder, TextEncoder } from 'node:util';
import { ReadableStream } from 'node:stream/web';

global.TextDecoder = TextDecoder as typeof global.TextDecoder;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: 'test-token' } },
      })),
    },
  },
}));

describe('agentService streamMessage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses SSE delta events and returns the final response', async () => {
    const body = [
      'event: runtime\n',
      'data: {"type":"runtime","runtimeId":"local:1","model":"deepseek:deepseek-v4-flash"}\n\n',
      'event: status\n',
      'data: {"type":"status","label":"解析模型路由","detail":"deepseek:deepseek-v4-flash","status":"done"}\n\n',
      'event: delta\n',
      'data: {"type":"delta","text":"你"}\n\n',
      'event: delta\n',
      'data: {"type":"delta","text":"好"}\n\n',
      'event: done\n',
      'data: {"type":"done","response":"你好"}\n\n',
    ].join('');
    const encoder = new TextEncoder();
    const onDelta = jest.fn();
    const onRuntime = jest.fn();
    const onStatus = jest.fn();
    const onDone = jest.fn();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      }),
    } as unknown as Response);

    const result = await agentService.streamMessage('hi', {
      runtimeId: 'local:1',
      model: 'deepseek:deepseek-v4-flash',
      onDelta,
      onRuntime,
      onStatus,
      onDone,
    });

    expect(onRuntime).toHaveBeenCalledWith({
      runtimeId: 'local:1',
      model: 'deepseek:deepseek-v4-flash',
    });
    expect(onStatus).toHaveBeenCalledWith({
      label: '解析模型路由',
      detail: 'deepseek:deepseek-v4-flash',
      status: 'done',
    });
    expect(onDelta).toHaveBeenCalledWith('你');
    expect(onDelta).toHaveBeenCalledWith('好');
    expect(onDone).toHaveBeenCalledWith('你好');
    expect(result).toBe('你好');
  });

  it('parses SSE tool events', async () => {
    const body = [
      'event: tool\n',
      'data: {"type":"tool","name":"read","status":"start"}\n\n',
      'event: tool\n',
      'data: {"type":"tool","name":"bash","status":"end","detail":"exit code 0","isError":false}\n\n',
      'event: done\n',
      'data: {"type":"done","response":"完成"}\n\n',
    ].join('');
    const encoder = new TextEncoder();
    const onTool = jest.fn();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      }),
    } as unknown as Response);

    const result = await agentService.streamMessage('hi', {
      runtimeId: 'local:1',
      onTool,
    });

    expect(onTool).toHaveBeenCalledWith({
      name: 'read',
      status: 'start',
      isError: false,
    });
    expect(onTool).toHaveBeenCalledWith({
      name: 'bash',
      status: 'end',
      detail: 'exit code 0',
      isError: false,
    });
    expect(result).toBe('完成');
  });

  it('throws a stable error for non-ok stream responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'busy' }),
    } as Response);

    await expect(
      agentService.streamMessage('hi', { runtimeId: 'local:1' })
    ).rejects.toThrow('busy');
  });

  it('passes an abort signal to the stream request', async () => {
    const controller = new AbortController();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(streamController) {
          streamController.close();
        },
      }),
    } as unknown as Response);

    await agentService.streamMessage('hi', {
      runtimeId: 'local:1',
      signal: controller.signal,
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/agent/stream', expect.objectContaining({
      signal: controller.signal,
    }));
    expect(global.fetch).toHaveBeenCalledWith('/api/agent/stream', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer test-token',
      }),
    }));
  });

  it('closes a runtime through the stream endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await agentService.closeRuntime('local:1');

    expect(global.fetch).toHaveBeenCalledWith('/api/agent/stream', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ runtimeId: 'local:1' }),
    });
  });

  it('resets runtime context without closing the runtime', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reset: true }),
    } as Response);

    await agentService.resetRuntimeContext('local:1');

    expect(global.fetch).toHaveBeenCalledWith('/api/agent/stream', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ runtimeId: 'local:1' }),
    });
  });
});
