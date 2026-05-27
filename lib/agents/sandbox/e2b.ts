import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { Sandbox } from 'e2b';
import type { AgentSandboxRuntime } from './types';
import { sortSandboxEntries, toSandboxFileEntry } from './files';

const DEFAULT_TEMPLATE = 'muses-node22';
export const DEFAULT_SANDBOX_CWD = '/home/user/musesAOS';
const DEFAULT_TIMEOUT_MS = 60 * 60_000;
const DEFAULT_MAX_SKILLS_SYNC_BYTES = 50 * 1024 * 1024;
const MIN_NODE_MAJOR_VERSION = 22;
const NODE_SETUP_TIMEOUT_MS = 180_000;
const BUILT_IN_SKILLS_RELATIVE_DIR = 'lib/agents/skills/official';
const EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  'coverage',
  'node_modules',
]);
type SandboxStatus = {
  label: string;
  detail?: string;
  status?: 'active' | 'done' | 'error' | 'info';
};

export interface CreateE2BSandboxRuntimeOptions {
  template?: string;
  cwd?: string;
  timeoutMs?: number;
  apiKey?: string;
  localProjectDir?: string;
  syncProject?: boolean;
  maxSyncBytes?: number;
  maxSkillsSyncBytes?: number;
  onStatus?: (event: SandboxStatus) => void;
}

type E2BSandbox = Awaited<ReturnType<typeof Sandbox.create>>;

export async function createE2BSandboxRuntime({
  template = process.env.E2B_SANDBOX_TEMPLATE || DEFAULT_TEMPLATE,
  cwd = process.env.E2B_SANDBOX_CWD || DEFAULT_SANDBOX_CWD,
  timeoutMs = getNumberEnv('E2B_SANDBOX_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS,
  apiKey = process.env.E2B_API_KEY?.trim(),
  localProjectDir = process.cwd(),
  syncProject = process.env.E2B_SANDBOX_SYNC_PROJECT !== 'false',
  maxSkillsSyncBytes = getNumberEnv('E2B_SANDBOX_MAX_SKILLS_SYNC_BYTES') || DEFAULT_MAX_SKILLS_SYNC_BYTES,
  onStatus,
}: CreateE2BSandboxRuntimeOptions = {}): Promise<AgentSandboxRuntime> {
  const createOptions = {
    ...(apiKey ? { apiKey } : {}),
    timeoutMs,
    allowInternetAccess: true,
  };
  onStatus?.({ label: '创建 E2B 沙箱', detail: `${template} · timeout ${timeoutMs}ms`, status: 'active' });
  const sandbox = await Sandbox.create(template, createOptions);
  onStatus?.({ label: 'E2B 沙箱创建完成', detail: sandbox.sandboxId, status: 'done' });
  const runtime = new E2BSandboxRuntime(sandbox, cwd, onStatus);

  await ensureSandboxNodeVersion({ sandbox, onStatus });

  onStatus?.({ label: '准备沙箱工作目录', detail: cwd, status: 'active' });
  await runtime.mkdir(cwd);
  onStatus?.({ label: '沙箱工作目录就绪', detail: cwd, status: 'done' });
  if (syncProject) {
    onStatus?.({
      label: '复制内置 Skills 文件夹到沙箱',
      detail: `${BUILT_IN_SKILLS_RELATIVE_DIR} -> ${path.posix.join(cwd, BUILT_IN_SKILLS_RELATIVE_DIR)}`,
      status: 'active',
    });
    const syncResult = await syncBuiltInSkillsToSandbox({
      sandbox,
      localProjectDir,
      remoteProjectDir: cwd,
      maxBytes: maxSkillsSyncBytes,
    });
    onStatus?.({
      label: '内置 Skills 文件夹复制完成',
      detail: syncResult
        ? `${syncResult.files} files · ${formatBytes(syncResult.bytes)} · copied ${BUILT_IN_SKILLS_RELATIVE_DIR}`
        : `本地目录不存在，跳过 ${BUILT_IN_SKILLS_RELATIVE_DIR}`,
      status: syncResult ? 'done' : 'info',
    });
  }

  return runtime;
}

class E2BSandboxRuntime implements AgentSandboxRuntime {
  id: string;

  constructor(
    private readonly sandbox: E2BSandbox,
    public readonly cwd: string,
    private readonly onStatus?: (event: SandboxStatus) => void
  ) {
    this.id = sandbox.sandboxId;
  }

  async exec(
    command: string,
    _cwd: string,
    options: {
      onData: (data: Buffer) => void;
      signal?: AbortSignal;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
    }
  ): Promise<{ exitCode: number | null }>;
  async exec(
    command: string,
    options: {
      onData: (data: Buffer) => void;
      signal?: AbortSignal;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
    }
  ): Promise<{ exitCode: number | null }>;
  async exec(
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
    const options = typeof cwdOrOptions === 'string' ? maybeOptions : cwdOrOptions;
    const cwd = typeof cwdOrOptions === 'string' ? cwdOrOptions : this.cwd;
    if (!options) throw new Error('E2B_EXEC_OPTIONS_MISSING');

    this.onStatus?.({ label: 'E2B 执行命令', detail: `$ ${truncateStatusDetail(command)}`, status: 'active' });
    let lastOutputStatusAt = 0;
    const result = await this.sandbox.commands.run(command, {
      cwd,
      timeoutMs: options.timeout,
      onStdout: (data: string) => {
        options.onData(Buffer.from(data));
        lastOutputStatusAt = this.emitCommandOutputStatus(data, lastOutputStatusAt);
      },
      onStderr: (data: string) => {
        options.onData(Buffer.from(data));
        lastOutputStatusAt = this.emitCommandOutputStatus(data, lastOutputStatusAt);
      },
      signal: options.signal,
      envs: filterEnv(options.env),
    } as never);

    const exitCode = 'exitCode' in result ? result.exitCode : null;
    this.onStatus?.({
      label: exitCode && exitCode !== 0 ? 'E2B 命令执行失败' : 'E2B 命令执行完成',
      detail: exitCode === null ? 'exit code unavailable' : `exit code ${exitCode}`,
      status: exitCode && exitCode !== 0 ? 'error' : 'done',
    });
    return { exitCode };
  }

  private emitCommandOutputStatus(data: string, lastOutputStatusAt: number): number {
    const now = Date.now();
    if (now - lastOutputStatusAt < 800) return lastOutputStatusAt;
    const detail = truncateStatusDetail(data);
    if (!detail) return lastOutputStatusAt;
    this.onStatus?.({ label: 'E2B 命令输出', detail, status: 'active' });
    return now;
  }

  async readFile(absolutePath: string): Promise<Buffer> {
    const data = await this.sandbox.files.read(absolutePath, { format: 'bytes' });
    return Buffer.from(data);
  }

  async writeFile(absolutePath: string, content: string): Promise<void> {
    await this.sandbox.files.write(absolutePath, content);
  }

  async mkdir(dir: string): Promise<void> {
    await this.sandbox.files.makeDir(dir);
  }

  async access(absolutePath: string): Promise<void> {
    const exists = await this.sandbox.files.exists(absolutePath);
    if (!exists) {
      throw new Error(`ENOENT: no such file or directory, access '${absolutePath}'`);
    }
  }

  async listDir(absolutePath: string) {
    const entries = await this.sandbox.files.list(absolutePath, { depth: 1 });
    return sortSandboxEntries(entries.map(toSandboxFileEntry));
  }

  async stat(absolutePath: string) {
    return toSandboxFileEntry(await this.sandbox.files.getInfo(absolutePath));
  }

  isStarted(): boolean {
    return true;
  }

  async dispose(): Promise<void> {
    await this.sandbox.kill();
  }
}

async function syncDirectoryToSandbox({
  sandbox,
  localRoot,
  remoteRoot,
  maxBytes,
  excludedRelativePaths = new Set(),
}: {
  sandbox: E2BSandbox;
  localRoot: string;
  remoteRoot: string;
  maxBytes: number;
  excludedRelativePaths?: Set<string>;
}): Promise<{ files: number; bytes: number }> {
  let syncedBytes = 0;
  let syncedFiles = 0;

  async function walk(localDir: string): Promise<void> {
    const entries = await readdir(localDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
      const localPath = path.join(localDir, entry.name);
      const relativePath = path.relative(localRoot, localPath);
      const normalizedRelativePath = toPosixPath(relativePath);
      if (excludedRelativePaths.has(normalizedRelativePath)) continue;
      const remotePath = path.posix.join(remoteRoot, toPosixPath(relativePath));

      if (entry.isDirectory()) {
        await sandbox.files.makeDir(remotePath);
        await walk(localPath);
        continue;
      }

      if (!entry.isFile()) continue;
      const info = await stat(localPath);
      if (syncedBytes + info.size > maxBytes) continue;
      syncedBytes += info.size;
      syncedFiles += 1;
      const content = await readFile(localPath);
      const arrayBuffer = content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength
      );
      await sandbox.files.write(remotePath, arrayBuffer);
    }
  }

  await walk(localRoot);
  return { files: syncedFiles, bytes: syncedBytes };
}

async function ensureSandboxNodeVersion({
  sandbox,
  onStatus,
}: {
  sandbox: E2BSandbox;
  onStatus?: (event: SandboxStatus) => void;
}): Promise<void> {
  onStatus?.({
    label: '检查沙箱 Node.js 版本',
    detail: `要求 v${MIN_NODE_MAJOR_VERSION}+`,
    status: 'active',
  });

  const currentVersion = await getSandboxNodeVersion(sandbox);
  const currentMajor = currentVersion ? Number(currentVersion.split('.')[0]) : 0;
  if (Number.isFinite(currentMajor) && currentMajor >= MIN_NODE_MAJOR_VERSION) {
    onStatus?.({
      label: '沙箱 Node.js 版本满足要求',
      detail: `v${currentVersion}`,
      status: 'done',
    });
    return;
  }

  onStatus?.({
    label: '设置沙箱 Node.js 版本',
    detail: currentVersion
      ? `当前 v${currentVersion}，正在切换到 v${MIN_NODE_MAJOR_VERSION}+`
      : `未检测到 node，正在安装 v${MIN_NODE_MAJOR_VERSION}+`,
    status: 'active',
  });

  await runSandboxCommand(
    sandbox,
    `bash -lc 'set -e
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v'`,
    { timeoutMs: NODE_SETUP_TIMEOUT_MS }
  );

  const nextVersion = await getSandboxNodeVersion(sandbox);
  const nextMajor = nextVersion ? Number(nextVersion.split('.')[0]) : 0;
  if (!Number.isFinite(nextMajor) || nextMajor < MIN_NODE_MAJOR_VERSION) {
    throw new Error(`E2B_NODE_VERSION_UNSUPPORTED:${nextVersion || 'unknown'}`);
  }

  onStatus?.({
    label: '沙箱 Node.js 版本已设置',
    detail: `v${nextVersion}`,
    status: 'done',
  });
}

async function getSandboxNodeVersion(sandbox: E2BSandbox): Promise<string | null> {
  const output = await runSandboxCommand(
    sandbox,
    `bash -lc 'node -p "process.versions.node" 2>/dev/null || true'`,
    { timeoutMs: 30_000, allowFailure: true }
  );
  const version = output.trim().split(/\s+/).find((part) => /^\d+\.\d+\.\d+$/.test(part));
  return version || null;
}

async function runSandboxCommand(
  sandbox: E2BSandbox,
  command: string,
  {
    timeoutMs,
    allowFailure = false,
  }: {
    timeoutMs: number;
    allowFailure?: boolean;
  }
): Promise<string> {
  let output = '';
  const result = await sandbox.commands.run(command, {
    timeoutMs,
    onStdout: (data: string) => {
      output += data;
    },
    onStderr: (data: string) => {
      output += data;
    },
  } as never);

  const exitCode = 'exitCode' in result ? result.exitCode : null;
  if (!allowFailure && exitCode && exitCode !== 0) {
    throw new Error(`E2B_COMMAND_FAILED:${exitCode}:${truncateStatusDetail(command)}`);
  }
  return output;
}

async function syncBuiltInSkillsToSandbox({
  sandbox,
  localProjectDir,
  remoteProjectDir,
  maxBytes,
}: {
  sandbox: E2BSandbox;
  localProjectDir: string;
  remoteProjectDir: string;
  maxBytes: number;
}): Promise<{ files: number; bytes: number } | null> {
  const localSkillsDir = path.join(localProjectDir, BUILT_IN_SKILLS_RELATIVE_DIR);
  try {
    const info = await stat(localSkillsDir);
    if (!info.isDirectory()) return null;
  } catch {
    return null;
  }

  return syncDirectoryToSandbox({
    sandbox,
    localRoot: localSkillsDir,
    remoteRoot: path.posix.join(remoteProjectDir, BUILT_IN_SKILLS_RELATIVE_DIR),
    maxBytes,
  });
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

function getNumberEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function filterEnv(env?: NodeJS.ProcessEnv): Record<string, string> | undefined {
  if (!env) return undefined;
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function truncateStatusDetail(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 180)}...`;
}
