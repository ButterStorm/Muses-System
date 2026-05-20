import {
  AGENT_MODEL_ROUTES,
  DEFAULT_AGENT_MODEL,
  resolveAgentModel,
} from '@/lib/agents/model-router';

describe('agent model router', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createRegistry() {
    return {
      find: jest.fn(() => undefined),
    };
  }

  it('resolves deepseek flash through the built-in pi-ai provider', () => {
    process.env.DeepSeek_API_KEY = 'deepseek-test-key';

    const resolved = resolveAgentModel('deepseek:deepseek-v4-flash', createRegistry());

    expect(resolved.key).toBe('deepseek:deepseek-v4-flash');
    expect(resolved.provider).toBe('deepseek');
    expect(resolved.modelId).toBe('deepseek-v4-flash');
    expect(resolved.model).toMatchObject({
      id: 'deepseek-v4-flash',
      provider: 'deepseek',
      api: 'openai-completions',
      baseUrl: 'https://api.deepseek.com',
    });
    expect(resolved.capabilities).toMatchObject({
      supportsImage: false,
      supportsReasoning: false,
    });
  });

  it('throws a stable configuration error when DeepSeek_API_KEY is missing', () => {
    delete process.env.DeepSeek_API_KEY;

    expect(() => resolveAgentModel('deepseek:deepseek-v4-flash', createRegistry())).toThrow(
      'AGENT_PROVIDER_CONFIG_MISSING:deepseek'
    );
  });

  it('resolves openai gpt-4o through the built-in pi-ai registry', () => {
    const resolved = resolveAgentModel('openai:gpt-4o', createRegistry());

    expect(resolved.key).toBe('openai:gpt-4o');
    expect(resolved.provider).toBe('openai');
    expect(resolved.modelId).toBe('gpt-4o');
    expect(resolved.model.provider).toBe('openai');
  });

  it('rejects invalid, unknown, and non-whitelisted models', () => {
    const registry = createRegistry();

    expect(() => resolveAgentModel('gpt-4o', registry)).toThrow('AGENT_MODEL_KEY_INVALID');
    expect(() => resolveAgentModel('unknown:model', registry)).toThrow('AGENT_MODEL_NOT_ALLOWED');
    expect(() => resolveAgentModel('deepseek:unknown-model', registry)).toThrow('AGENT_MODEL_NOT_ALLOWED');
  });

  it('exposes the default model and route capabilities for the agent UI', () => {
    expect(DEFAULT_AGENT_MODEL).toBe('deepseek:deepseek-v4-flash');
    expect(AGENT_MODEL_ROUTES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'deepseek:deepseek-v4-flash',
          provider: 'deepseek',
          modelId: 'deepseek-v4-flash',
          capabilities: expect.objectContaining({
            contextWindow: expect.any(Number),
            maxTokens: expect.any(Number),
          }),
        }),
      ])
    );
  });
});
