import {
  acquireRuntimeLock,
  cleanupAgentRuntimes,
  disposeAgentRuntime,
  getOrCreateAgentRuntime,
  resetAgentRuntimesForTests,
} from '@/lib/agents/runtime/manager';

const createSession = jest.fn();

function session(id: string) {
  return {
    id,
    dispose: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    prompt: jest.fn(),
  };
}

describe('agent runtime manager', () => {
  beforeEach(() => {
    resetAgentRuntimesForTests();
    createSession.mockReset();
  });

  it('reuses the same session for the same runtime id and model', async () => {
    const firstSession = session('first');
    createSession.mockResolvedValue(firstSession);

    const first = await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });
    const second = await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });

    expect(first.session).toBe(firstSession);
    expect(second.session).toBe(firstSession);
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('creates independent sessions for different runtime ids', async () => {
    createSession
      .mockResolvedValueOnce(session('first'))
      .mockResolvedValueOnce(session('second'));

    const first = await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });
    const second = await getOrCreateAgentRuntime({
      runtimeId: 'project:2',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });

    expect(first.session).not.toBe(second.session);
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('recreates and disposes the runtime when the model changes', async () => {
    const oldSession = session('old');
    const newSession = session('new');
    createSession.mockResolvedValueOnce(oldSession).mockResolvedValueOnce(newSession);

    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });
    const updated = await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-pro',
      createSession,
    });

    expect(oldSession.dispose).toHaveBeenCalled();
    expect(updated.session).toBe(newSession);
  });

  it('disposes expired runtimes during cleanup', async () => {
    const oldSession = session('old');
    createSession.mockResolvedValue(oldSession);
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
      now: 1_000,
    });

    cleanupAgentRuntimes({ now: 1_000 + 31 * 60_000, ttlMs: 30 * 60_000 });

    expect(oldSession.dispose).toHaveBeenCalled();
    createSession.mockResolvedValue(session('new'));
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('prevents concurrent streaming for the same runtime', async () => {
    createSession.mockResolvedValue(session('first'));
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });

    const release = acquireRuntimeLock('project:1');

    expect(() => acquireRuntimeLock('project:1')).toThrow('AGENT_RUNTIME_BUSY');
    release();
    expect(() => acquireRuntimeLock('project:1')).not.toThrow();
  });

  it('disposes a runtime explicitly', async () => {
    const currentSession = session('first');
    createSession.mockResolvedValue(currentSession);
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });

    disposeAgentRuntime('project:1');

    expect(currentSession.dispose).toHaveBeenCalled();
  });
});
