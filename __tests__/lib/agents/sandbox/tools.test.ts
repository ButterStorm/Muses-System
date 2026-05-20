import {
  createReadToolDefinition,
  createWriteToolDefinition,
} from '@mariozechner/pi-coding-agent';
import { buildSandboxedCoreTools, isE2BSandboxEnabled } from '@/lib/agents/sandbox/tools';

describe('sandboxed agent tools', () => {
  beforeEach(() => {
    delete process.env.AGENT_SANDBOX_PROVIDER;
    delete process.env.E2B_API_KEY;
  });

  it('builds core pi tools backed by sandbox operations', () => {
    const runtime = {
      id: 'sbx_123',
      cwd: '/workspace',
      exec: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn(),
      dispose: jest.fn(),
    };

    const tools = buildSandboxedCoreTools(runtime);

    expect(tools.map((tool) => tool.name)).toEqual(['read', 'bash', 'write', 'edit']);
  });

  it('keeps sandbox runtime methods bound when tools call operations', async () => {
    class RuntimeWithThis {
      id = 'sbx_123';
      cwd = '/workspace';
      exec = jest.fn();
      dispose = jest.fn();

      async readFile() {
        return Buffer.from(this.id);
      }

      async writeFile() {
        this.dispose();
      }

      async mkdir() {
        this.dispose();
      }

      async access() {
        this.dispose();
      }
    }

    const runtime = new RuntimeWithThis();
    const tools = buildSandboxedCoreTools(runtime);

    const readOperations = (createReadToolDefinition as jest.Mock).mock.calls.at(-1)[1].operations;
    const writeOperations = (createWriteToolDefinition as jest.Mock).mock.calls.at(-1)[1].operations;

    await expect(readOperations.readFile('/workspace/a.txt')).resolves.toEqual(Buffer.from('sbx_123'));
    await writeOperations.writeFile('/workspace/a.txt', 'content');

    expect(tools.map((tool) => tool.name)).toEqual(['read', 'bash', 'write', 'edit']);
    expect(runtime.dispose).toHaveBeenCalled();
  });

  it('enables E2B automatically when an API key is configured', () => {
    process.env.E2B_API_KEY = ' e2b_test_key ';

    expect(isE2BSandboxEnabled()).toBe(true);
  });

  it('allows explicitly disabling E2B even when an API key exists', () => {
    process.env.E2B_API_KEY = 'e2b_test_key';
    process.env.AGENT_SANDBOX_PROVIDER = 'none';

    expect(isE2BSandboxEnabled()).toBe(false);
  });
});
