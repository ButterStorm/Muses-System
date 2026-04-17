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
    const invoke = jest.fn().mockResolvedValue({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'DeepAgents 本地响应' },
      ],
    });

    mockedCreateMusesAgent.mockReturnValue({
      invoke,
    } as never);

    await expect(chat({ message: 'hello', model: 'openai:gpt-4o' })).resolves.toEqual({
      response: 'DeepAgents 本地响应',
    });

    expect(mockedCreateMusesAgent).toHaveBeenCalledWith({ model: 'openai:gpt-4o' });
    expect(invoke).toHaveBeenCalledWith({
      messages: [{ role: 'user', content: 'hello' }],
    });
  });

  it('should throw when the agent returns empty content', async () => {
    const invoke = jest.fn().mockResolvedValue({
      messages: [{ role: 'assistant', content: [] }],
    });

    mockedCreateMusesAgent.mockReturnValue({
      invoke,
    } as never);

    await expect(chat({ message: 'hello' })).rejects.toThrow('AI 返回内容为空');
  });
});
