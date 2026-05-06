import { chat } from '@/lib/agents/muses-agent-sdk/chat';
import { createMusesAgent } from '@/lib/agents/muses-agent-sdk/createMusesAgent';

jest.mock('@/lib/agents/muses-agent-sdk/createMusesAgent', () => ({
  createMusesAgent: jest.fn(),
}));

const mockedCreateMusesAgent = jest.mocked(createMusesAgent);

describe('muses-agent-sdk chat', () => {
  beforeEach(() => {
    mockedCreateMusesAgent.mockReset();
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
});
