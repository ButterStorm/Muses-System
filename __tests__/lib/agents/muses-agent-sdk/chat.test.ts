import { chat, streamChat } from '@/lib/agents/muses-agent/chat';
import { createMusesAgent } from '@/lib/agents/muses-agent/createMusesAgent';
import { resetAgentRuntimesForTests } from '@/lib/agents/runtime/manager';

jest.mock('@/lib/agents/muses-agent/createMusesAgent', () => ({
  createMusesAgent: jest.fn(),
}));

const mockedCreateMusesAgent = jest.mocked(createMusesAgent);

describe('muses-agent-sdk chat', () => {
  beforeEach(() => {
    mockedCreateMusesAgent.mockReset();
    resetAgentRuntimesForTests();
  });

  it('should return the final assistant text content', async () => {
    const unsubscribe = jest.fn();
    const prompt = jest.fn(async () => undefined);
    const dispose = jest.fn();

    mockedCreateMusesAgent.mockReturnValue({
      subscribe: jest.fn((handler) => {
        handler({
          type: 'message_update',
          assistantMessageEvent: {
            type: 'text_delta',
            delta: 'DeepAgents 本地响应',
          },
        });
        return unsubscribe;
      }),
      prompt,
      dispose,
    } as never);

    await expect(chat({ message: 'hello', model: 'openai:gpt-4o' })).resolves.toEqual({
      response: 'DeepAgents 本地响应',
    });

    expect(mockedCreateMusesAgent).toHaveBeenCalledWith({ model: 'openai:gpt-4o' });
    expect(prompt).toHaveBeenCalledWith('hello');
    expect(unsubscribe).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });

  it('should include recent conversation history in the prompt', async () => {
    const unsubscribe = jest.fn();
    const prompt = jest.fn(async () => undefined);
    const dispose = jest.fn();

    mockedCreateMusesAgent.mockReturnValue({
      subscribe: jest.fn((handler) => {
        handler({
          type: 'message_update',
          assistantMessageEvent: {
            type: 'text_delta',
            delta: '继续回答',
          },
        });
        return unsubscribe;
      }),
      prompt,
      dispose,
    } as never);

    await chat({
      message: '下一步呢？',
      history: [
        { role: 'user', content: '我在做图片生成' },
        { role: 'assistant', content: '可以先确定风格。' },
      ],
    });

    expect(mockedCreateMusesAgent).toHaveBeenCalledWith({ model: 'deepseek:deepseek-v4-flash' });
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('用户: 我在做图片生成'));
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('助手: 可以先确定风格。'));
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('当前用户消息: 下一步呢？'));
  });

  it('should throw when the agent returns empty content', async () => {
    const unsubscribe = jest.fn();
    const prompt = jest.fn(async () => undefined);
    const dispose = jest.fn();

    mockedCreateMusesAgent.mockReturnValue({
      subscribe: jest.fn(() => unsubscribe),
      prompt,
      dispose,
    } as never);

    await expect(chat({ message: 'hello' })).rejects.toThrow('AI 返回内容为空');
    expect(unsubscribe).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });

  it('emits sandbox-ready status when reusing an already started sandbox runtime', async () => {
    const events: unknown[] = [];
    const prompt = jest.fn(async () => undefined);

    mockedCreateMusesAgent.mockReturnValue({
      sandboxRuntime: {
        id: 'sbx_123',
        cwd: '/workspace',
        isStarted: () => true,
        dispose: jest.fn(),
      },
      subscribe: jest.fn((handler) => {
        handler({
          type: 'message_update',
          assistantMessageEvent: {
            type: 'text_delta',
            delta: '完成',
          },
        });
        return jest.fn();
      }),
      prompt,
      dispose: jest.fn(),
    } as never);

    await streamChat({
      runtimeId: 'project:1',
      message: '继续运行',
      model: 'deepseek:deepseek-v4-flash',
      onEvent: (event) => events.push(event),
    });

    expect(events).toContainEqual({
      type: 'status',
      label: 'E2B 沙箱已就绪',
      detail: 'sbx_123 · /workspace',
      status: 'done',
    });
  });

  it('streams bash tool command and output details', async () => {
    const events: unknown[] = [];
    const prompt = jest.fn(async () => undefined);

    mockedCreateMusesAgent.mockReturnValue({
      subscribe: jest.fn((handler) => {
        handler({
          type: 'tool_execution_start',
          toolName: 'bash',
          args: { command: 'npm test' },
        });
        handler({
          type: 'tool_execution_update',
          toolName: 'bash',
          partialResult: {
            content: [{ type: 'text', text: 'PASS __tests__/demo.test.ts' }],
          },
        });
        handler({
          type: 'tool_execution_end',
          toolName: 'bash',
          result: {
            content: [{ type: 'text', text: 'exit code 0' }],
          },
          isError: false,
        });
        handler({
          type: 'message_update',
          assistantMessageEvent: {
            type: 'text_delta',
            delta: '完成',
          },
        });
        return jest.fn();
      }),
      prompt,
      dispose: jest.fn(),
    } as never);

    await streamChat({
      runtimeId: 'project:tool-detail',
      message: '运行测试',
      model: 'deepseek:deepseek-v4-flash',
      onEvent: (event) => events.push(event),
    });

    expect(events).toContainEqual({
      type: 'tool',
      name: 'bash',
      status: 'start',
      detail: '$ npm test',
    });
    expect(events).toContainEqual({
      type: 'tool',
      name: 'bash',
      status: 'update',
      detail: 'PASS __tests__/demo.test.ts',
    });
    expect(events).toContainEqual({
      type: 'tool',
      name: 'bash',
      status: 'end',
      detail: 'exit code 0',
      isError: false,
    });
  });
});
