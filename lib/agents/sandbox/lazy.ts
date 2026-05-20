import type { AgentSandboxRuntime } from './types';

interface CreateLazySandboxRuntimeOptions {
  id: string;
  cwd: string;
  createRuntime: () => Promise<AgentSandboxRuntime>;
  onStart?: () => void;
  onReady?: (runtime: AgentSandboxRuntime) => void;
}

export function createLazySandboxRuntime({
  id,
  cwd,
  createRuntime,
  onStart,
  onReady,
}: CreateLazySandboxRuntimeOptions): AgentSandboxRuntime {
  let runtimePromise: Promise<AgentSandboxRuntime> | null = null;
  let runtime: AgentSandboxRuntime | null = null;

  const getRuntime = async () => {
    if (runtime) return runtime;
    if (!runtimePromise) {
      onStart?.();
      runtimePromise = createRuntime().then((createdRuntime) => {
        runtime = createdRuntime;
        onReady?.(createdRuntime);
        return createdRuntime;
      });
    }
    return runtimePromise;
  };

  async function exec(
    command: string,
    cwd: string,
    options: {
      onData: (data: Buffer) => void;
      signal?: AbortSignal;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
    }
  ): Promise<{ exitCode: number | null }>;
  async function exec(
    command: string,
    options: {
      onData: (data: Buffer) => void;
      signal?: AbortSignal;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
    }
  ): Promise<{ exitCode: number | null }>;
  async function exec(
    command: string,
    cwdOrOptions:
      | string
      | {
        onData: (data: Buffer) => void;
        signal?: AbortSignal;
        timeout?: number;
        env?: NodeJS.ProcessEnv;
      },
    maybeOptions?: {
      onData: (data: Buffer) => void;
      signal?: AbortSignal;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
    }
  ): Promise<{ exitCode: number | null }> {
    const activeRuntime = await getRuntime();
    if (typeof cwdOrOptions === 'string') {
      return activeRuntime.exec(command, cwdOrOptions, maybeOptions!);
    }
    return activeRuntime.exec(command, cwdOrOptions);
  }

  return {
    get id() {
      return runtime?.id ?? id;
    },
    cwd,
    exec,
    readFile: async (absolutePath) => (await getRuntime()).readFile(absolutePath),
    writeFile: async (absolutePath, content) => (await getRuntime()).writeFile(absolutePath, content),
    mkdir: async (dir) => (await getRuntime()).mkdir(dir),
    access: async (absolutePath) => (await getRuntime()).access(absolutePath),
    isStarted: () => Boolean(runtime),
    dispose: async () => {
      if (!runtimePromise) return;
      const activeRuntime = await runtimePromise;
      await activeRuntime.dispose();
      runtime = null;
      runtimePromise = null;
    },
  };
}
