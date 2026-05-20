import {
  createAgentSession,
  DefaultResourceLoader,
} from '@mariozechner/pi-coding-agent';
import { createMusesAgent } from '@/lib/agents/muses-agent/createMusesAgent';
import { createE2BSandboxRuntime } from '@/lib/agents/sandbox/e2b';
import { buildSandboxedCoreTools } from '@/lib/agents/sandbox/tools';

jest.mock('@/lib/agents/model-router', () => ({
  getDefaultAgentModel: () => 'deepseek:deepseek-v4-flash',
  resolveAgentModel: () => ({
    provider: 'deepseek',
    modelId: 'deepseek-v4-flash',
    capabilities: {
      supportsImage: false,
      supportsReasoning: false,
      contextWindow: 128000,
      maxTokens: 8192,
    },
    model: {
      id: 'deepseek-v4-flash',
      provider: 'deepseek',
      input: ['text'],
      reasoning: false,
      contextWindow: 128000,
      maxTokens: 8192,
    },
  }),
}));

jest.mock('@/lib/agents/mcp/adapter', () => ({
  MCP_BRIDGE_TOOL_NAMES: ['mcp_list_servers', 'mcp_list_tools', 'mcp_call_tool'],
  buildConfiguredMcpCustomTools: jest.fn(() => [{ name: 'mcp_workspace_search' }]),
  createMcpBridgeExtensionFactory: jest.fn(() => jest.fn()),
  getMcpBridgeDiagnostics: jest.fn(() => ({
    serverCount: 3,
    configuredServerIds: ['tavily-mcp', 'sequentialthinking', 'mcp-trends-hub'],
    bridgeToolNames: ['mcp_list_servers', 'mcp_list_tools', 'mcp_call_tool'],
    staticToolCount: 0,
  })),
}));

jest.mock('@/lib/agents/skills/config', () => ({
  getAgentSkillPaths: jest.fn(() => ['/repo/.muses-agent/skills/test-skill']),
}));

jest.mock('@/lib/agents/sandbox/e2b', () => ({
  DEFAULT_SANDBOX_CWD: '/workspace',
  createE2BSandboxRuntime: jest.fn(async () => ({
    id: 'sbx_123',
    cwd: '/workspace',
    exec: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    dispose: jest.fn(),
  })),
}));

jest.mock('@/lib/agents/sandbox/tools', () => ({
  isE2BSandboxEnabled: jest.fn(() => process.env.AGENT_SANDBOX_PROVIDER === 'e2b'),
  buildSandboxedCoreTools: jest.fn(() => [
    { name: 'read' },
    { name: 'bash' },
    { name: 'write' },
    { name: 'edit' },
  ]),
}));

const mockedCreateAgentSession = jest.mocked(createAgentSession);
const mockedDefaultResourceLoader = jest.mocked(DefaultResourceLoader);
const mockedCreateE2BSandboxRuntime = jest.mocked(createE2BSandboxRuntime);
const mockedBuildSandboxedCoreTools = jest.mocked(buildSandboxedCoreTools);

describe('createMusesAgent', () => {
  beforeEach(() => {
    mockedCreateAgentSession.mockClear();
    mockedDefaultResourceLoader.mockClear();
    mockedCreateE2BSandboxRuntime.mockClear();
    mockedBuildSandboxedCoreTools.mockClear();
    delete process.env.AGENT_SANDBOX_PROVIDER;
  });

  it('creates a project-cwd session with core tools, configured skills, and MCP tools', async () => {
    await createMusesAgent({ model: 'deepseek:deepseek-v4-flash' });

    const resourceLoaderConfig = mockedDefaultResourceLoader.mock.calls[0][0] as unknown as {
      systemPromptOverride: (base?: string) => string;
    };
    const systemPrompt = resourceLoaderConfig.systemPromptOverride();

    expect(mockedDefaultResourceLoader).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: process.cwd(),
        noExtensions: true,
        extensionFactories: [expect.any(Function)],
        noSkills: true,
        additionalSkillPaths: ['/repo/.muses-agent/skills/test-skill'],
      })
    );
    expect(mockedCreateAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: process.cwd(),
        tools: [
          'read',
          'bash',
          'write',
          'edit',
          'mcp_list_servers',
          'mcp_list_tools',
          'mcp_call_tool',
        ],
        customTools: [{ name: 'mcp_workspace_search' }],
      })
    );
    expect(mockedCreateAgentSession.mock.calls[0][0]).not.toHaveProperty('noTools');
    expect(systemPrompt).toContain('Registered MCP servers');
    expect(systemPrompt).toContain('sequentialthinking');
    expect(systemPrompt).toContain('mcp-trends-hub');
    expect(systemPrompt).toContain('Do not present low-level pi execution tools');
  });

  it('loads built-in skills before lazily starting E2B sandbox-backed tools', async () => {
    process.env.AGENT_SANDBOX_PROVIDER = 'e2b';

    await createMusesAgent({ model: 'deepseek:deepseek-v4-flash' });

    const resourceLoaderConfig = mockedDefaultResourceLoader.mock.calls[0][0] as unknown as {
      systemPromptOverride: (base?: string) => string;
      skillsOverride: (base: {
        skills: Array<{
          filePath: string;
          baseDir: string;
          sourceInfo: { path: string; baseDir?: string };
        }>;
        diagnostics: unknown[];
      }) => {
        skills: Array<{
          filePath: string;
          baseDir: string;
          sourceInfo: { path: string; baseDir?: string };
        }>;
        diagnostics: unknown[];
      };
    };
    const systemPrompt = resourceLoaderConfig.systemPromptOverride();
    const remappedSkills = resourceLoaderConfig.skillsOverride({
      skills: [{
        filePath: `${process.cwd()}/lib/agents/skills/official/ai-hot/SKILL.md`,
        baseDir: `${process.cwd()}/lib/agents/skills/official/ai-hot`,
        sourceInfo: {
          path: `${process.cwd()}/lib/agents/skills/official/ai-hot/SKILL.md`,
          baseDir: `${process.cwd()}/lib/agents/skills/official/ai-hot`,
        },
      }],
      diagnostics: [],
    });

    expect(mockedDefaultResourceLoader).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: process.cwd(),
        noSkills: true,
        additionalSkillPaths: ['/repo/.muses-agent/skills/test-skill'],
        skillsOverride: expect.any(Function),
      })
    );
    expect(remappedSkills.skills[0]).toMatchObject({
      filePath: '/workspace/lib/agents/skills/official/ai-hot/SKILL.md',
      baseDir: '/workspace/lib/agents/skills/official/ai-hot',
      sourceInfo: {
        path: '/workspace/lib/agents/skills/official/ai-hot/SKILL.md',
        baseDir: '/workspace/lib/agents/skills/official/ai-hot',
      },
    });
    expect(mockedCreateAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          'read',
          'bash',
          'write',
          'edit',
          'mcp_list_servers',
          'mcp_list_tools',
          'mcp_call_tool',
        ],
        customTools: [
          { name: 'read' },
          { name: 'bash' },
          { name: 'write' },
          { name: 'edit' },
          { name: 'mcp_workspace_search' },
        ],
      })
    );
    expect(mockedCreateE2BSandboxRuntime).not.toHaveBeenCalled();
    expect(systemPrompt).toContain('E2B sandbox is configured and starts lazily');
    expect(systemPrompt).toContain('Built-in Skills');
    expect(systemPrompt).toContain('Do not ask the user to run npm install');
    expect(systemPrompt).toContain('Do not claim that sandbox network is unavailable unless a sandbox command actually failed');
    expect(systemPrompt).toContain('first run a sandbox-side registry/package diagnostic');
    expect(systemPrompt).not.toContain('local Skills');
    expect(systemPrompt).not.toContain("user's Mac");
  });

  it('starts E2B only when a sandbox tool operation is used', async () => {
    process.env.AGENT_SANDBOX_PROVIDER = 'e2b';

    await createMusesAgent({ model: 'deepseek:deepseek-v4-flash' });

    const lazyRuntime = mockedBuildSandboxedCoreTools.mock.calls[0][0];
    await lazyRuntime.access('/workspace/package.json');

    expect(mockedCreateE2BSandboxRuntime).toHaveBeenCalledTimes(1);
    expect(mockedCreateE2BSandboxRuntime).toHaveBeenCalledWith({
      localProjectDir: process.cwd(),
      onStatus: undefined,
    });
  });
});
