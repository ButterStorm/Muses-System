import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent';
import path from 'node:path';
import { getDefaultAgentModel, resolveAgentModel } from '@/lib/agents/model-router';
import {
  buildConfiguredMcpCustomTools,
  createMcpBridgeExtensionFactory,
  getMcpBridgeDiagnostics,
  MCP_BRIDGE_TOOL_NAMES,
} from '@/lib/agents/mcp/adapter';
import { MCP_SERVERS } from '@/lib/agents/mcp/config';
import { createE2BSandboxRuntime, DEFAULT_SANDBOX_CWD } from '@/lib/agents/sandbox/e2b';
import { createLazySandboxRuntime } from '@/lib/agents/sandbox/lazy';
import { buildSandboxedCoreTools, isE2BSandboxEnabled } from '@/lib/agents/sandbox/tools';
import type { AgentSandboxRuntime } from '@/lib/agents/sandbox/types';
import { getAgentSkillPaths } from '@/lib/agents/skills/config';
import type { AgentRuntimeSession } from '@/lib/agents/runtime/types';

const CORE_AGENT_TOOLS = ['read', 'bash', 'write', 'edit'] as const;
const BUILT_IN_SKILLS_RELATIVE_DIR = 'lib/agents/skills/official';

const MUSES_AGENT_SYSTEM_PROMPT = `You are a helpful AI assistant embedded in a creative canvas application called MusesSystem.

You help users with their tasks, answer questions, and provide creative inspiration.

Keep your answers practical, concise, and collaborative.

When explaining your available capabilities to the user:
- Present user-facing capabilities in terms of configured Skills and MCP servers.
- Do not present low-level pi execution tools such as read, write, edit, or bash as primary user-facing capabilities unless the user explicitly asks about implementation details.
- MCP servers are registered runtime capabilities even when their concrete MCP tools are discovered or called lazily.
- Use the MCP bridge tools (mcp_list_servers, mcp_list_tools, mcp_call_tool) when a task requires a registered MCP server.
- If an MCP server has no static allowlisted tools, describe the server capability instead of saying MCP is unavailable.`;

interface CreateMusesAgentOptions {
  model?: string;
  onStatus?: (event: { label: string; detail?: string; status?: 'active' | 'done' | 'error' | 'info' }) => void;
  sandboxRuntime?: AgentSandboxRuntime;
}

export async function createMusesAgent({ model, onStatus, sandboxRuntime: existingSandboxRuntime }: CreateMusesAgentOptions = {}) {
  const requestedModel = model || getDefaultAgentModel();
  onStatus?.({ label: '解析模型路由', detail: requestedModel, status: 'active' });

  const authStorage = AuthStorage.inMemory();
  const configuredProviders: string[] = [];

  if (process.env.OPENAI_API_KEY) {
    authStorage.setRuntimeApiKey('openai', process.env.OPENAI_API_KEY);
    configuredProviders.push('openai');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    authStorage.setRuntimeApiKey('anthropic', process.env.ANTHROPIC_API_KEY);
    configuredProviders.push('anthropic');
  }

  if (process.env.DeepSeek_API_KEY) {
    authStorage.setRuntimeApiKey('deepseek', process.env.DeepSeek_API_KEY);
    configuredProviders.push('deepseek');
  }

  if (process.env.OPENROUTER_API_KEY) {
    authStorage.setRuntimeApiKey('openrouter', process.env.OPENROUTER_API_KEY);
    configuredProviders.push('openrouter');
  }
  onStatus?.({
    label: '注册模型 provider 凭证',
    detail: configuredProviders.length ? configuredProviders.join(', ') : '没有发现可用 provider 凭证',
    status: 'done',
  });

  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const resolved = resolveAgentModel(requestedModel, modelRegistry);
  onStatus?.({
    label: '模型路由完成',
    detail: `${resolved.provider}:${resolved.modelId} · context ${resolved.capabilities.contextWindow}`,
    status: 'done',
  });
  const cwd = process.cwd();
  const skillPaths = getAgentSkillPaths(cwd);
  const mcpTools = buildConfiguredMcpCustomTools();
  const sandboxEnabled = isE2BSandboxEnabled();
  const sandboxRuntime = existingSandboxRuntime ?? (sandboxEnabled
    ? createLazySandboxRuntime({
      id: 'e2b:lazy',
      cwd: process.env.E2B_SANDBOX_CWD || DEFAULT_SANDBOX_CWD,
      createRuntime: () => createE2BSandboxRuntime({ localProjectDir: cwd, onStatus }),
      onStart: () => onStatus?.({
        label: '启动 E2B 沙箱',
        detail: '首次使用执行工具，正在创建远程运行环境',
        status: 'active',
      }),
      onReady: (runtime) => onStatus?.({
        label: 'E2B 沙箱已就绪',
        detail: `${runtime.id} · ${runtime.cwd}`,
        status: 'done',
      }),
    })
    : null);
  const ownsSandboxRuntime = Boolean(sandboxRuntime && !existingSandboxRuntime);
  const sandboxTools = sandboxRuntime ? buildSandboxedCoreTools(sandboxRuntime) : [];
  const mcpDiagnostics = getMcpBridgeDiagnostics(MCP_SERVERS);
  const mcpBridgeExtensionFactory = createMcpBridgeExtensionFactory(MCP_SERVERS);
  const activeTools = [...CORE_AGENT_TOOLS, ...MCP_BRIDGE_TOOL_NAMES];
  const capabilityPrompt = buildAgentCapabilityPrompt({
    skillPaths,
    mcpServers: MCP_SERVERS,
    mcpDiagnostics,
    sandboxRuntime,
  });

  onStatus?.({
    label: '启用核心工具',
    detail: sandboxRuntime
      ? `${CORE_AGENT_TOOLS.join(', ')} · E2B sandbox lazy`
      : CORE_AGENT_TOOLS.join(', '),
    status: 'done',
  });
  onStatus?.({
    label: '启用 MCP bridge 工具',
    detail: MCP_BRIDGE_TOOL_NAMES.join(', '),
    status: 'done',
  });
  onStatus?.({
    label: '读取内置 Skills 配置',
    detail: skillPaths.length ? summarizePaths(skillPaths) : '没有配置内置 skill',
    status: skillPaths.length ? 'done' : 'info',
  });
  onStatus?.({
    label: '读取 MCP 配置',
    detail: `${mcpDiagnostics.serverCount} 个 server · ${mcpDiagnostics.staticToolCount} 个 static tool · bridge enabled`,
    status: MCP_SERVERS.length ? 'done' : 'info',
  });

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir: getAgentDir(),
    noExtensions: true,
    extensionFactories: [mcpBridgeExtensionFactory],
    noSkills: true,
    additionalSkillPaths: skillPaths,
    skillsOverride: sandboxRuntime
      ? (base) => ({
        ...base,
        skills: base.skills.map((skill) => mapSkillToSandboxPath(skill, cwd, sandboxRuntime.cwd)),
      })
      : undefined,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => `${MUSES_AGENT_SYSTEM_PROMPT}\n\n${capabilityPrompt}`,
    appendSystemPromptOverride: () => [],
  });
  onStatus?.({ label: '加载 Agent 资源', detail: 'system prompt + configured skills', status: 'active' });
  await resourceLoader.reload();
  onStatus?.({ label: 'Agent 资源加载完成', detail: '已关闭全局 skills/extensions 自动发现', status: 'done' });

  onStatus?.({ label: '创建 pi agent session', detail: '初始化工具、模型和资源上下文', status: 'active' });
  const { session } = await createAgentSession({
    cwd,
    authStorage,
    modelRegistry,
    model: resolved.model,
    tools: activeTools,
    customTools: [...sandboxTools, ...mcpTools],
    resourceLoader,
    sessionManager: SessionManager.inMemory(cwd),
  });
  onStatus?.({ label: 'pi agent session 就绪', detail: '可以接收 prompt', status: 'done' });

  const runtimeSession = session as AgentRuntimeSession;
  if (sandboxRuntime) {
    runtimeSession.sandboxRuntime = sandboxRuntime;
    const disposeSession = runtimeSession.dispose.bind(runtimeSession);
    runtimeSession.dispose = async (options) => {
      await Promise.resolve(disposeSession());
      if (ownsSandboxRuntime && options?.disposeSandbox !== false) {
        await sandboxRuntime.dispose();
      }
    };
  }

  return runtimeSession;
}

function summarizePaths(paths: string[]): string {
  return paths
    .map((skillPath) => skillPath.split('/').filter(Boolean).at(-1) || skillPath)
    .join(', ');
}

function mapSkillToSandboxPath<T extends {
  filePath: string;
  baseDir: string;
  sourceInfo: { path: string; baseDir?: string };
}>(skill: T, localCwd: string, sandboxCwd: string): T {
  return {
    ...skill,
    filePath: toSandboxPath(skill.filePath, localCwd, sandboxCwd),
    baseDir: toSandboxPath(skill.baseDir, localCwd, sandboxCwd),
    sourceInfo: {
      ...skill.sourceInfo,
      path: toSandboxPath(skill.sourceInfo.path, localCwd, sandboxCwd),
      baseDir: skill.sourceInfo.baseDir
        ? toSandboxPath(skill.sourceInfo.baseDir, localCwd, sandboxCwd)
        : undefined,
    },
  };
}

function toSandboxPath(localPath: string, localCwd: string, sandboxCwd: string): string {
  const relativePath = path.relative(localCwd, localPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return localPath;
  }

  const normalizedRelativePath = relativePath.split(path.sep).join(path.posix.sep);
  if (!normalizedRelativePath.startsWith(BUILT_IN_SKILLS_RELATIVE_DIR)) {
    return localPath;
  }

  return path.posix.join(sandboxCwd, normalizedRelativePath);
}

function buildAgentCapabilityPrompt({
  skillPaths,
  mcpServers,
  mcpDiagnostics,
  sandboxRuntime,
}: {
  skillPaths: string[];
  mcpServers: typeof MCP_SERVERS;
  mcpDiagnostics: ReturnType<typeof getMcpBridgeDiagnostics>;
  sandboxRuntime: ReturnType<typeof createLazySandboxRuntime> | null;
}): string {
  return [
    'Configured MusesSystem agent capabilities:',
    '',
    'Execution environment:',
    sandboxRuntime
      ? [
        `- E2B sandbox is configured and starts lazily on first read, write, edit, or bash tool use.`,
        '- Before any sandbox tool is used, built-in Skills are loaded from MusesSystem and no remote sandbox is created.',
        `- Once started, the read, write, edit, and bash tools operate inside the remote Linux sandbox at ${sandboxRuntime.cwd}.`,
        '- Use the sandbox tools to create files, install dependencies, run scripts, render previews, and inspect outputs when the user asks you to execute work.',
        '- Do not ask the user to run npm install, npm run, cd, or other shell commands outside MusesSystem when sandbox tools are available.',
        '- Do not claim that sandbox network is unavailable unless a sandbox command actually failed with network-related stderr/stdout and a follow-up sandbox diagnostic such as `curl -I https://registry.npmjs.org/` or `npm view <package> version --registry=https://registry.npmjs.org` also fails.',
        '- If npm install, npx, or a package download fails, first run a sandbox-side registry/package diagnostic, then report the exact failing command and relevant error output. Distinguish network failure from package-not-found, version mismatch, missing script, or command misuse.',
      ].join('\n')
      : '- Project execution tools are active. If execution is unavailable, explain the exact tool error.',
    '',
    'Built-in Skills:',
    skillPaths.length
      ? skillPaths.map((skillPath) => `- ${getPathName(skillPath)}`).join('\n')
      : '- none',
    '',
    'Registered MCP servers:',
    mcpServers.length
      ? mcpServers.map((server) => `- ${server.id}: ${describeMcpServer(server.id)}`).join('\n')
      : '- none',
    '',
    `MCP bridge tools active: ${mcpDiagnostics.bridgeToolNames.join(', ')}.`,
    `Static MCP allowlist tools configured: ${mcpDiagnostics.staticToolCount}.`,
    'The MCP bridge is available through mcp_list_servers, mcp_list_tools, and mcp_call_tool. Use it to discover and invoke remote MCP tools lazily instead of using bash/curl as a workaround.',
  ].join('\n');
}

function getPathName(value: string): string {
  return value.split('/').filter(Boolean).at(-1) || value;
}

function describeMcpServer(serverId: string): string {
  const descriptions: Record<string, string> = {
    'tavily-mcp': 'web search and external research through Tavily/ModelScope MCP',
    sequentialthinking: 'structured multi-step problem solving and planning support',
    'mcp-trends-hub': 'trend, news, ranking, and source monitoring across multiple media platforms',
  };

  return descriptions[serverId] || 'project-configured MCP capability';
}
