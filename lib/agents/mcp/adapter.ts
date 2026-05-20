import { spawn } from 'node:child_process';
import { defineTool } from '@mariozechner/pi-coding-agent';
import type { ExtensionFactory, ToolDefinition } from '@mariozechner/pi-coding-agent';
import { MCP_SERVERS, type McpServerConfig } from './config';

const MCP_PROTOCOL_VERSION = '2025-03-26';
export const MCP_BRIDGE_TOOL_NAMES = [
  'mcp_list_servers',
  'mcp_list_tools',
  'mcp_call_tool',
] as const;

export type McpBridgeToolName = (typeof MCP_BRIDGE_TOOL_NAMES)[number];

export interface McpCallResult {
  content?: Array<{ type: string; text?: string; data?: unknown; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface McpDiscoveredTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpBridgeServerSummary {
  id: string;
  transport: McpServerConfig['transport']['type'];
  staticToolCount: number;
  lazyToolsAvailable: boolean;
}

export interface McpToolSummary {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpBridgeDiagnostics {
  serverCount: number;
  configuredServerIds: string[];
  bridgeToolNames: McpBridgeToolName[];
  staticToolCount: number;
}

export interface McpAdapterOptions {
  discoverTools?: (
    server: McpServerConfig,
    signal?: AbortSignal
  ) => Promise<McpDiscoveredTool[]>;
  callTool?: (
    server: McpServerConfig,
    toolName: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ) => Promise<McpCallResult>;
}

export function toMcpToolName(serverId: string, toolName: string): string {
  return `mcp_${sanitizeToolPart(serverId)}_${sanitizeToolPart(toolName)}`;
}

export function buildConfiguredMcpCustomTools(): ToolDefinition[] {
  return buildMcpAllowlistedCustomTools(MCP_SERVERS);
}

export function buildMcpCustomTools(
  servers: McpServerConfig[],
  options: McpAdapterOptions = {}
): ToolDefinition[] {
  const callTool = options.callTool || callConfiguredMcpTool;
  const discoverTools = options.discoverTools || discoverConfiguredMcpTools;

  return [
    ...buildMcpAllowlistedCustomTools(servers, { callTool }),
    ...buildMcpBridgeTools(servers, { callTool, discoverTools }),
  ];
}

export function buildMcpAllowlistedCustomTools(
  servers: McpServerConfig[],
  options: Pick<McpAdapterOptions, 'callTool'> = {}
): ToolDefinition[] {
  const callTool = options.callTool || callConfiguredMcpTool;

  return servers.flatMap((server) =>
    server.allowedTools.map((tool) =>
      defineTool({
        name: toMcpToolName(server.id, tool.name),
        label: `${server.id}:${tool.name}`,
        description: tool.description,
        promptSnippet: `Call MCP tool ${server.id}:${tool.name}`,
        parameters: tool.inputSchema as never,
        async execute(_toolCallId, params, signal) {
          try {
            const result = await callTool(server, tool.name, params as Record<string, unknown>, signal);
            return {
              content: [{ type: 'text', text: formatMcpResult(result) }],
              details: { serverId: server.id, toolName: tool.name },
            };
          } catch {
            throw new Error('MCP 工具调用失败');
          }
        },
      })
    )
  );
}

export function createMcpBridgeExtensionFactory(
  servers: McpServerConfig[] = MCP_SERVERS,
  options: McpAdapterOptions = {}
): ExtensionFactory {
  return (pi) => {
    const callTool = options.callTool || callConfiguredMcpTool;
    const discoverTools = options.discoverTools || discoverConfiguredMcpTools;

    for (const tool of buildMcpBridgeTools(servers, { callTool, discoverTools })) {
      pi.registerTool(tool);
    }
  };
}

export function getMcpBridgeDiagnostics(
  servers: McpServerConfig[] = MCP_SERVERS
): McpBridgeDiagnostics {
  return {
    serverCount: servers.length,
    configuredServerIds: servers.map((server) => server.id),
    bridgeToolNames: Array.from(MCP_BRIDGE_TOOL_NAMES),
    staticToolCount: servers.reduce((count, server) => count + server.allowedTools.length, 0),
  };
}

function buildMcpBridgeTools(
  servers: McpServerConfig[],
  options: Required<McpAdapterOptions>
): ToolDefinition[] {
  return [
    defineTool({
      name: MCP_BRIDGE_TOOL_NAMES[0],
      label: 'List MCP servers',
      description: 'List project-configured MCP servers available to the Muses agent runtime.',
      promptSnippet: 'Use this to inspect which MCP servers are configured before selecting a remote MCP capability.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as never,
      async execute() {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              servers: servers.map((server) => ({
                id: server.id,
                transport: server.transport.type,
                staticToolCount: server.allowedTools.length,
                lazyToolsAvailable: server.allowedTools.length === 0,
              } satisfies McpBridgeServerSummary)),
            }, null, 2),
          }],
          details: { serverCount: servers.length },
        };
      },
    }),
    defineTool({
      name: MCP_BRIDGE_TOOL_NAMES[1],
      label: 'List MCP tools',
      description: 'Discover tools exposed by a configured MCP server. Use this before calling a lazy MCP tool.',
      promptSnippet: 'Use this to discover tools for a configured MCP server by serverId.',
      parameters: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Configured MCP server id, for example tavily-mcp, sequentialthinking, or mcp-trends-hub.',
          },
        },
        required: ['serverId'],
        additionalProperties: false,
      } as never,
      async execute(_toolCallId, params, signal) {
        const serverId = getStringParam(params, 'serverId');
        const server = findMcpServer(servers, serverId);
        try {
          const tools = await getServerTools(server, options.discoverTools, signal);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                serverId,
                tools: tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  inputSchema: tool.inputSchema,
                } satisfies McpToolSummary)),
              }, null, 2),
            }],
            details: { serverId, toolCount: tools.length },
          };
        } catch {
          throw new Error('MCP 工具发现失败');
        }
      },
    }),
    defineTool({
      name: MCP_BRIDGE_TOOL_NAMES[2],
      label: 'Call MCP tool',
      description: 'Call a tool on a configured MCP server through the MCP protocol.',
      promptSnippet: 'Use this after mcp_list_tools to call a remote MCP tool with serverId, toolName, and arguments.',
      parameters: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Configured MCP server id.',
          },
          toolName: {
            type: 'string',
            description: 'Remote MCP tool name from mcp_list_tools.',
          },
          arguments: {
            type: 'object',
            description: 'Arguments to pass to the remote MCP tool.',
            additionalProperties: true,
          },
        },
        required: ['serverId', 'toolName', 'arguments'],
        additionalProperties: false,
      } as never,
      async execute(_toolCallId, params, signal) {
        const serverId = getStringParam(params, 'serverId');
        const toolName = getStringParam(params, 'toolName');
        const args = getObjectParam(params, 'arguments');
        const server = findMcpServer(servers, serverId);

        try {
          await assertMcpToolAllowed(server, toolName, options.discoverTools, signal);
          const result = await options.callTool(server, toolName, args, signal);
          return {
            content: [{ type: 'text', text: formatMcpResult(result) }],
            details: { serverId, toolName },
          };
        } catch {
          throw new Error('MCP 工具调用失败');
        }
      },
    }),
  ];
}

async function callConfiguredMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<McpCallResult> {
  if (server.transport.type === 'http' || server.transport.type === 'streamable_http') {
    return callHttpMcpTool(server, toolName, args, signal);
  }

  if (server.transport.type === 'sse') {
    return callSseMcpTool(server, toolName, args, signal);
  }

  return callCommandMcpTool(server, toolName, args, signal);
}

async function discoverConfiguredMcpTools(
  server: McpServerConfig,
  signal?: AbortSignal
): Promise<McpDiscoveredTool[]> {
  if (server.allowedTools.length > 0) {
    return server.allowedTools;
  }

  if (server.transport.type === 'http' || server.transport.type === 'streamable_http') {
    const result = await callHttpMcpMethod(server, 'tools/list', {}, signal);
    return normalizeMcpTools(result.tools);
  }

  if (server.transport.type === 'sse') {
    const result = await callSseMcpMethod(server, 'tools/list', {}, signal);
    return normalizeMcpTools(result.tools);
  }

  return [];
}

async function callHttpMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<McpCallResult> {
  const transport = server.transport;
  if (transport.type !== 'http' && transport.type !== 'streamable_http') {
    throw new Error('MCP_TRANSPORT_MISMATCH');
  }

  return callHttpMcpMethod(server, 'tools/call', {
    name: toolName,
    arguments: args,
  }, signal);
}

async function callHttpMcpMethod(
  server: McpServerConfig,
  method: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<any> {
  const transport = server.transport;
  if (transport.type !== 'http' && transport.type !== 'streamable_http') {
    throw new Error('MCP_TRANSPORT_MISMATCH');
  }

  const sessionId = transport.type === 'streamable_http'
    ? await initializeHttpMcpSession(server, signal)
    : undefined;

  const response = await fetch(transport.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      ...transport.headers,
    },
    signal,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  const payload = await parseMcpHttpResponse(response);
  if (!response.ok || payload.error) {
    throw new Error('MCP_HTTP_ERROR');
  }

  return payload.result || payload;
}

async function initializeHttpMcpSession(
  server: McpServerConfig,
  signal?: AbortSignal
): Promise<string | undefined> {
  const transport = server.transport;
  if (transport.type !== 'streamable_http') return undefined;

  const response = await fetch(transport.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      ...transport.headers,
    },
    signal,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: 'muses-agent-runtime',
          version: '1.0.0',
        },
      },
    }),
  });

  await parseMcpHttpResponse(response);
  if (!response.ok) {
    throw new Error('MCP_INITIALIZE_ERROR');
  }

  const sessionId = response.headers.get('mcp-session-id') || undefined;
  if (sessionId) {
    await sendHttpMcpInitialized(server, sessionId, signal);
  }
  return sessionId;
}

async function sendHttpMcpInitialized(
  server: McpServerConfig,
  sessionId: string,
  signal?: AbortSignal
): Promise<void> {
  const transport = server.transport;
  if (transport.type !== 'streamable_http') return;

  const response = await fetch(transport.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      'mcp-session-id': sessionId,
      ...transport.headers,
    },
    signal,
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    }),
  });

  if (!response.ok) {
    throw new Error('MCP_INITIALIZED_NOTIFICATION_ERROR');
  }
  await response.text().catch(() => undefined);
}

async function callSseMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<McpCallResult> {
  return callSseMcpMethod(server, 'tools/call', {
    name: toolName,
    arguments: args,
  }, signal);
}

async function callSseMcpMethod(
  server: McpServerConfig,
  method: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<any> {
  const endpoint = await resolveSseMessageEndpoint(server, signal);
  const transport = server.transport;
  if (transport.type !== 'sse') {
    throw new Error('MCP_TRANSPORT_MISMATCH');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...transport.headers,
    },
    signal,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  const payload = await parseMcpHttpResponse(response);
  if (!response.ok || payload.error) {
    throw new Error('MCP_SSE_ERROR');
  }

  return payload.result || payload;
}

async function resolveSseMessageEndpoint(
  server: McpServerConfig,
  signal?: AbortSignal
): Promise<string> {
  const transport = server.transport;
  if (transport.type !== 'sse') {
    throw new Error('MCP_TRANSPORT_MISMATCH');
  }

  const response = await fetch(transport.url, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      ...transport.headers,
    },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error('MCP_SSE_CONNECT_ERROR');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const startedAt = Date.now();

  try {
    while (Date.now() - startedAt < 10_000) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const endpoint = parseSseEndpoint(buffer);
      if (endpoint) return new URL(endpoint, transport.url).toString();
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }

  throw new Error('MCP_SSE_ENDPOINT_NOT_FOUND');
}

function callCommandMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<McpCallResult> {
  const transport = server.transport;
  if (transport.type !== 'command') {
    return Promise.reject(new Error('MCP_TRANSPORT_MISMATCH'));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(transport.command, transport.args || [], {
      env: { ...process.env, ...transport.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('MCP_COMMAND_TIMEOUT'));
    }, 30_000);

    const abort = () => {
      child.kill();
      reject(new Error('MCP_COMMAND_ABORTED'));
    };
    signal?.addEventListener('abort', abort, { once: true });

    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const parsed = tryReadFramedJson(stdout);
      if (parsed) {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        child.kill();
        if (parsed.error) reject(new Error('MCP_COMMAND_ERROR'));
        else resolve(parsed.result || parsed);
      }
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      reject(error);
    });

    writeFramedJson(child.stdin, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    });
  });
}

function formatMcpResult(result: McpCallResult): string {
  const content = result.content || [];
  if (content.length === 0) {
    return JSON.stringify(result);
  }

  return content
    .map((item) => {
      if (item.type === 'text') return item.text || '';
      if (item.type === 'json') return JSON.stringify(item.data);
      return JSON.stringify(item);
    })
    .filter(Boolean)
    .join('\n');
}

async function getServerTools(
  server: McpServerConfig,
  discoverTools: NonNullable<McpAdapterOptions['discoverTools']>,
  signal?: AbortSignal
): Promise<McpDiscoveredTool[]> {
  if (server.allowedTools.length > 0) {
    return server.allowedTools;
  }

  return discoverTools(server, signal);
}

async function assertMcpToolAllowed(
  server: McpServerConfig,
  toolName: string,
  discoverTools: NonNullable<McpAdapterOptions['discoverTools']>,
  signal?: AbortSignal
): Promise<void> {
  const tools = await getServerTools(server, discoverTools, signal);
  if (!tools.some((tool) => tool.name === toolName)) {
    throw new Error('MCP_TOOL_NOT_ALLOWED');
  }
}

function findMcpServer(servers: McpServerConfig[], serverId: string): McpServerConfig {
  const server = servers.find((item) => item.id === serverId);
  if (!server) {
    throw new Error('MCP_SERVER_NOT_CONFIGURED');
  }
  return server;
}

function getStringParam(params: unknown, key: string): string {
  if (!params || typeof params !== 'object') {
    throw new Error('MCP_PARAM_INVALID');
  }

  const value = (params as Record<string, unknown>)[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('MCP_PARAM_INVALID');
  }
  return value;
}

function getObjectParam(params: unknown, key: string): Record<string, unknown> {
  if (!params || typeof params !== 'object') {
    throw new Error('MCP_PARAM_INVALID');
  }

  const value = (params as Record<string, unknown>)[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MCP_PARAM_INVALID');
  }
  return value as Record<string, unknown>;
}

function normalizeMcpTools(value: unknown): McpDiscoveredTool[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((tool): tool is Record<string, unknown> => Boolean(tool) && typeof tool === 'object')
    .filter((tool) => typeof tool.name === 'string')
    .map((tool) => ({
      name: String(tool.name),
      description: typeof tool.description === 'string' ? tool.description : undefined,
      inputSchema: normalizeInputSchema(tool.inputSchema),
    }));
}

function normalizeInputSchema(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { type: 'object', properties: {} };
}

async function parseMcpHttpResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('text/event-stream')) {
    const parsed = parseSseJsonPayload(text);
    if (parsed) return parsed;
  }

  return JSON.parse(text || '{}');
}

function parseSseEndpoint(buffer: string): string | null {
  return buffer
    .split('\n\n')
    .map((chunk) => parseSseData(chunk))
    .find((data) => Boolean(data && data.includes('/'))) || null;
}

function parseSseJsonPayload(buffer: string): any | null {
  const data = buffer
    .split('\n\n')
    .map((chunk) => parseSseData(chunk))
    .find(Boolean);
  if (!data) return null;
  return JSON.parse(data);
}

function parseSseData(chunk: string): string | null {
  const dataLines = chunk
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());

  if (dataLines.length === 0) return null;
  return dataLines.join('\n');
}

function sanitizeToolPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function writeFramedJson(stdin: NodeJS.WritableStream, payload: unknown): void {
  const body = JSON.stringify(payload);
  stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

function tryReadFramedJson(buffer: string): any | null {
  const headerEnd = buffer.indexOf('\r\n\r\n');
  if (headerEnd === -1) return null;

  const header = buffer.slice(0, headerEnd);
  const match = header.match(/Content-Length:\s*(\d+)/i);
  if (!match) return null;

  const length = Number(match[1]);
  const bodyStart = headerEnd + 4;
  const body = buffer.slice(bodyStart, bodyStart + length);
  if (Buffer.byteLength(body, 'utf8') < length) return null;

  return JSON.parse(body);
}
