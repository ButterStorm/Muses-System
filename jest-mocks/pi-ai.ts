export const getModel = jest.fn((provider: string, modelId: string) => {
  if (provider === 'openai' && modelId === 'gpt-4o') {
    return {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      api: 'openai-responses',
      baseUrl: 'https://api.openai.com/v1',
      reasoning: false,
      input: ['text', 'image'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 16384,
    };
  }

  if (provider === 'deepseek' && ['deepseek-v4-flash', 'deepseek-v4-pro'].includes(modelId)) {
    return {
      id: modelId,
      name: modelId,
      provider: 'deepseek',
      api: 'openai-completions',
      baseUrl: 'https://api.deepseek.com',
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
    };
  }

  return undefined;
});
