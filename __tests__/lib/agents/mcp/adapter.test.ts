import {
  buildConfiguredMcpCustomTools,
  buildMcpCustomTools,
  createMcpBridgeExtensionFactory,
  MCP_BRIDGE_TOOL_NAMES,
  toMcpToolName,
} from '@/lib/agents/mcp/adapter';
import { MCP_SERVERS } from '@/lib/agents/mcp/config';
import type { McpServerConfig } from '@/lib/agents/mcp/config';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

const config: McpServerConfig[] = [
  {
    id: 'workspace',
    transport: { type: 'http', url: 'http://mcp.local' },
    allowedTools: [
      {
        name: 'search',
        description: 'Search workspace',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ],
  },
];

describe('MCP adapter', () => {
  it('prefixes MCP tool names with the server id', () => {
    expect(toMcpToolName('workspace', 'search-files')).toBe('mcp_workspace_search_files');
  });

  it('registers allowlisted MCP tools and stable MCP bridge tools', () => {
    const tools = buildMcpCustomTools(config, {
      callTool: jest.fn(),
    });

    expect(tools).toHaveLength(4);
    expect(tools[0]).toMatchObject({
      name: 'mcp_workspace_search',
      description: 'Search workspace',
    });
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['mcp_list_servers', 'mcp_list_tools', 'mcp_call_tool'])
    );
  });

  it('keeps configured custom tools static so bridge tools come from the extension', () => {
    const tools = buildConfiguredMcpCustomTools();

    expect(tools).toHaveLength(MCP_SERVERS.reduce((count, server) => count + server.allowedTools.length, 0));
    expect(tools.map((tool) => tool.name)).not.toEqual(expect.arrayContaining(MCP_BRIDGE_TOOL_NAMES));
  });

  it('registers the MCP bridge tools through an internal extension factory', async () => {
    const registeredTools: string[] = [];
    const extension = createMcpBridgeExtensionFactory(config, {
      callTool: jest.fn(),
      discoverTools: jest.fn().mockResolvedValue([]),
    });

    await extension({
      registerTool(tool: ToolDefinition) {
        registeredTools.push(tool.name);
      },
    } as never);

    expect(registeredTools).toEqual(Array.from(MCP_BRIDGE_TOOL_NAMES));
  });

  it('returns text and JSON content from successful MCP calls', async () => {
    const callTool = jest.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'found result' },
        { type: 'json', data: { count: 1 } },
      ],
    });
    const [tool] = buildMcpCustomTools(config, { callTool });

    const result = await tool.execute(
      'tool-call-1',
      { query: 'agent' },
      undefined,
      undefined,
      {} as never
    );

    expect(callTool).toHaveBeenCalledWith(config[0], 'search', { query: 'agent' }, undefined);
    const text = result.content[0].type === 'text' ? result.content[0].text : '';
    expect(text).toContain('found result');
    expect(text).toContain('"count":1');
  });

  it('throws sanitized MCP errors', async () => {
    const [tool] = buildMcpCustomTools(config, {
      callTool: jest.fn().mockRejectedValue(new Error('secret token sk-test leaked')),
    });

    await expect(
      tool.execute('tool-call-1', { query: 'agent' }, undefined, undefined, {} as never)
    ).rejects.toThrow('MCP 工具调用失败');
  });

  it('discovers lazy MCP tools through the bridge', async () => {
    const discoverTools = jest.fn().mockResolvedValue([
      {
        name: 'trend',
        description: 'Read trends',
        inputSchema: { type: 'object', properties: {} },
      },
    ]);
    const lazyConfig: McpServerConfig[] = [
      {
        id: 'trends',
        transport: { type: 'streamable_http', url: 'http://mcp.local/mcp' },
        allowedTools: [],
      },
    ];
    const listTools = buildMcpCustomTools(lazyConfig, {
      callTool: jest.fn(),
      discoverTools,
    }).find((tool) => tool.name === 'mcp_list_tools')!;

    const result = await listTools.execute(
      'tool-call-1',
      { serverId: 'trends' },
      undefined,
      undefined,
      {} as never
    );

    expect(discoverTools).toHaveBeenCalledWith(lazyConfig[0], undefined);
    const text = result.content[0].type === 'text' ? result.content[0].text : '';
    expect(text).toContain('"name": "trend"');
  });

  it('calls lazy MCP tools through the bridge after discovery', async () => {
    const callTool = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'trend result' }],
    });
    const lazyConfig: McpServerConfig[] = [
      {
        id: 'trends',
        transport: { type: 'streamable_http', url: 'http://mcp.local/mcp' },
        allowedTools: [],
      },
    ];
    const bridgeCallTool = buildMcpCustomTools(lazyConfig, {
      callTool,
      discoverTools: jest.fn().mockResolvedValue([{ name: 'trend' }]),
    }).find((tool) => tool.name === 'mcp_call_tool')!;

    const result = await bridgeCallTool.execute(
      'tool-call-1',
      { serverId: 'trends', toolName: 'trend', arguments: { topic: 'ai' } },
      undefined,
      undefined,
      {} as never
    );

    expect(callTool).toHaveBeenCalledWith(lazyConfig[0], 'trend', { topic: 'ai' }, undefined);
    const text = result.content[0].type === 'text' ? result.content[0].text : '';
    expect(text).toContain('trend result');
  });
});
