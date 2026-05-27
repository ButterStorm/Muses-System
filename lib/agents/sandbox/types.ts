export interface AgentSandboxRuntime {
  id: string;
  cwd: string;
  exec: {
    (
      command: string,
      cwd: string,
      options: {
        onData: (data: Buffer) => void;
        signal?: AbortSignal;
        timeout?: number;
        env?: NodeJS.ProcessEnv;
      }
    ): Promise<{ exitCode: number | null }>;
    (
      command: string,
      options: {
        onData: (data: Buffer) => void;
        signal?: AbortSignal;
        timeout?: number;
        env?: NodeJS.ProcessEnv;
      }
    ): Promise<{ exitCode: number | null }>;
  };
  readFile: (absolutePath: string) => Promise<Buffer>;
  writeFile: (absolutePath: string, content: string) => Promise<void>;
  mkdir: (dir: string) => Promise<void>;
  access: (absolutePath: string) => Promise<void>;
  listDir: (absolutePath: string) => Promise<SandboxFileEntry[]>;
  stat: (absolutePath: string) => Promise<SandboxFileEntry>;
  isStarted?: () => boolean;
  dispose: () => Promise<void>;
}

export interface SandboxFileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  mimeType?: string;
}
