import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createE2BSandboxRuntime } from '@/lib/agents/sandbox/e2b';

const createMock = jest.fn();

jest.mock('e2b', () => ({
  Sandbox: {
    create: (...args: unknown[]) => createMock(...args),
  },
}), { virtual: true });

function sandbox() {
  return {
    sandboxId: 'sbx_123',
    commands: {
      run: jest.fn(async (command, options) => {
        if (String(command).includes('process.versions.node')) {
          options.onStdout?.('22.11.0\n');
        }
        return { exitCode: 0 };
      }),
    },
    files: {
      read: jest.fn(),
      write: jest.fn(),
      makeDir: jest.fn(),
      exists: jest.fn(),
    },
    kill: jest.fn(),
  };
}

describe('E2B sandbox runtime', () => {
  const tempProjectRoot = path.join(process.cwd(), 'tmp-e2b-skills-test');

  beforeEach(() => {
    createMock.mockReset();
    delete process.env.E2B_API_KEY;
  });

  afterEach(async () => {
    await rm(tempProjectRoot, { recursive: true, force: true });
  });

  it('creates an E2B sandbox with the configured template and timeout', async () => {
    const sbx = sandbox();
    createMock.mockResolvedValue(sbx);
    process.env.E2B_API_KEY = ' e2b_test_key ';

    const runtime = await createE2BSandboxRuntime({
      template: 'nodejs',
      cwd: '/home/user/project',
      timeoutMs: 3_600_000,
    });

    expect(runtime.id).toBe('sbx_123');
    expect(createMock).toHaveBeenCalledWith('nodejs', {
      apiKey: 'e2b_test_key',
      timeoutMs: 3_600_000,
      allowInternetAccess: true,
    });
  });

  it('runs shell commands in the sandbox working directory and streams output', async () => {
    const sbx = sandbox();
    sbx.commands.run.mockImplementation(async (command, options) => {
      if (String(command).includes('process.versions.node')) {
        options.onStdout?.('22.11.0\n');
        return { exitCode: 0 };
      }
      options.onStdout?.('hello\n');
      options.onStderr?.('warn\n');
      return { exitCode: 7 };
    });
    createMock.mockResolvedValue(sbx);

    const runtime = await createE2BSandboxRuntime({ cwd: '/workspace' });
    const chunks: string[] = [];
    const result = await runtime.exec('npm test', {
      onData: (chunk) => chunks.push(chunk.toString('utf8')),
      timeout: 1234,
    });

    expect(sbx.commands.run).toHaveBeenCalledWith('npm test', {
      cwd: '/workspace',
      timeoutMs: 1234,
      onStdout: expect.any(Function),
      onStderr: expect.any(Function),
      signal: undefined,
    });
    expect(chunks.join('')).toBe('hello\nwarn\n');
    expect(result).toEqual({ exitCode: 7 });
  });

  it('installs Node.js 22 when the sandbox starts with Node.js below v22', async () => {
    const sbx = sandbox();
    const onStatus = jest.fn();
    sbx.commands.run.mockImplementation(async (command, options) => {
      if (String(command).includes('process.versions.node')) {
        const nodeCheckCount = sbx.commands.run.mock.calls
          .filter(([calledCommand]) => String(calledCommand).includes('process.versions.node'))
          .length;
        options.onStdout?.(nodeCheckCount === 1 ? '20.18.1\n' : '22.11.0\n');
        return { exitCode: 0 };
      }
      if (String(command).includes('deb.nodesource.com/setup_22.x')) {
        options.onStdout?.('installed node v22\n');
        return { exitCode: 0 };
      }
      return { exitCode: 0 };
    });
    createMock.mockResolvedValue(sbx);

    await createE2BSandboxRuntime({ cwd: '/workspace', onStatus });

    expect(sbx.commands.run).toHaveBeenCalledWith(
      expect.stringContaining('deb.nodesource.com/setup_22.x'),
      expect.objectContaining({ timeoutMs: 180_000 })
    );
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      label: '设置沙箱 Node.js 版本',
      detail: expect.stringContaining('当前 v20.18.1'),
      status: 'active',
    }));
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      label: '沙箱 Node.js 版本已设置',
      detail: 'v22.11.0',
      status: 'done',
    }));
  });

  it('maps file operations into the E2B filesystem', async () => {
    const sbx = sandbox();
    sbx.files.read.mockResolvedValue('hello');
    sbx.files.exists.mockResolvedValue(true);
    createMock.mockResolvedValue(sbx);

    const runtime = await createE2BSandboxRuntime({ cwd: '/workspace' });

    await expect(runtime.readFile('/workspace/README.md')).resolves.toEqual(Buffer.from('hello'));
    await runtime.writeFile('/workspace/src/app.ts', 'content');
    await runtime.mkdir('/workspace/src');
    await runtime.access('/workspace/src/app.ts');

    expect(sbx.files.read).toHaveBeenCalledWith('/workspace/README.md', { format: 'bytes' });
    expect(sbx.files.write).toHaveBeenCalledWith('/workspace/src/app.ts', 'content');
    expect(sbx.files.makeDir).toHaveBeenCalledWith('/workspace/src');
    expect(sbx.files.exists).toHaveBeenCalledWith('/workspace/src/app.ts');
  });

  it('syncs official built-in skills into the sandbox project tree', async () => {
    const sbx = sandbox();
    createMock.mockResolvedValue(sbx);
    const onStatus = jest.fn();
    const projectRoot = tempProjectRoot;
    await mkdir(path.join(projectRoot, 'lib/agents/skills/official/hyperframes'), { recursive: true });
    await writeFile(path.join(projectRoot, 'README.md'), 'project root should not sync');
    await writeFile(
      path.join(projectRoot, 'lib/agents/skills/official/hyperframes/SKILL.md'),
      '---\nname: hyperframes\n---\n'
    );

    await createE2BSandboxRuntime({
      cwd: '/workspace',
      localProjectDir: projectRoot,
      onStatus,
    });

    const writeCall = sbx.files.write.mock.calls.find(
      ([remotePath]) => remotePath === '/workspace/lib/agents/skills/official/hyperframes/SKILL.md'
    );
    expect(writeCall).toBeDefined();
    expect(writeCall?.[1]).toBeDefined();
    expect(sbx.files.write).not.toHaveBeenCalledWith(
      '/workspace/README.md',
      expect.anything()
    );
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      label: '内置 Skills 文件夹复制完成',
      detail: expect.stringContaining('copied lib/agents/skills/official'),
      status: 'done',
    }));
  });
});
