import {
  acquireRuntimeLock,
  cleanupAgentRuntimes,
  disposeAgentRuntime,
  getAgentRuntime,
  getRequiredSandboxRuntime,
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
  beforeEach(async () => {
    await resetAgentRuntimesForTests();
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

    await cleanupAgentRuntimes({ now: 1_000 + 31 * 60_000, ttlMs: 30 * 60_000 });

    expect(oldSession.dispose).toHaveBeenCalled();
    createSession.mockResolvedValue(session('new'));
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('waits for async runtime disposal during cleanup before removing the runtime', async () => {
    let didDispose = false;
    const oldSession = {
      ...session('old'),
      dispose: jest.fn(async () => {
        await Promise.resolve();
        didDispose = true;
      }),
    };
    createSession.mockResolvedValue(oldSession);
    await getOrCreateAgentRuntime({
      runtimeId: 'project:async-cleanup',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
      now: 1_000,
    });

    const cleanupPromise = cleanupAgentRuntimes({ now: 1_000 + 31 * 60_000, ttlMs: 30 * 60_000 });
    expect(didDispose).toBe(false);
    await cleanupPromise;

    expect(didDispose).toBe(true);
    expect(getAgentRuntime('project:async-cleanup')).toBeUndefined();
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

    await disposeAgentRuntime('project:1');

    expect(currentSession.dispose).toHaveBeenCalled();
  });

  it('waits for async runtime disposal before resolving', async () => {
    let didDispose = false;
    const currentSession = {
      ...session('first'),
      dispose: jest.fn(async () => {
        await Promise.resolve();
        didDispose = true;
      }),
    };
    createSession.mockResolvedValue(currentSession);
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });

    const disposePromise = disposeAgentRuntime('project:1');
    expect(didDispose).toBe(false);
    await disposePromise;

    expect(didDispose).toBe(true);
  });

  it('returns an existing runtime without creating a new session', async () => {
    const currentSession = session('first');
    createSession.mockResolvedValue(currentSession);
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });

    const runtime = getAgentRuntime('project:1');

    expect(runtime?.session).toBe(currentSession);
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('returns the sandbox runtime when one is attached to the session', async () => {
    const sandboxRuntime = {
      id: 'sandbox-1',
      cwd: '/home/user/musesAOS',
      exec: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn(),
      listDir: jest.fn(),
      stat: jest.fn(),
      dispose: jest.fn(),
    };
    createSession.mockResolvedValue({ ...session('first'), sandboxRuntime });
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });

    await expect(getRequiredSandboxRuntime('project:1')).resolves.toBe(sandboxRuntime);
  });

  it('rejects sandbox lookup when the runtime is missing or has no sandbox', async () => {
    await expect(getRequiredSandboxRuntime('missing')).rejects.toThrow('AGENT_RUNTIME_NOT_FOUND');

    createSession.mockResolvedValue(session('first'));
    await getOrCreateAgentRuntime({
      runtimeId: 'project:1',
      model: 'deepseek:deepseek-v4-flash',
      createSession,
    });

    await expect(getRequiredSandboxRuntime('project:1')).rejects.toThrow('AGENT_SANDBOX_NOT_STARTED');
  });
});
