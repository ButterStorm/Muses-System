import { createLazySandboxRuntime } from '@/lib/agents/sandbox/lazy';
import type { AgentSandboxRuntime } from '@/lib/agents/sandbox/types';

function sandboxRuntime(id = 'sbx_123'): AgentSandboxRuntime {
  return {
    id,
    cwd: '/workspace',
    exec: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    listDir: jest.fn(),
    stat: jest.fn(),
    isStarted: () => true,
    dispose: jest.fn(),
  };
}

describe('lazy sandbox runtime', () => {
  it('reports whether the backing sandbox has been started', async () => {
    const createRuntime = jest.fn(async () => sandboxRuntime());
    const runtime = createLazySandboxRuntime({
      id: 'e2b:lazy',
      cwd: '/workspace',
      createRuntime,
    });

    expect(runtime.id).toBe('e2b:lazy');
    expect(runtime.isStarted?.()).toBe(false);

    await runtime.access('/workspace/package.json');

    expect(runtime.id).toBe('sbx_123');
    expect(runtime.isStarted?.()).toBe(true);
  });
});
