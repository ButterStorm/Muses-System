export interface McpAllowedToolConfig {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type McpTransportConfig =
  | { type: 'http'; url: string; headers?: Record<string, string> }
  | { type: 'sse'; url: string; headers?: Record<string, string> }
  | { type: 'streamable_http'; url: string; headers?: Record<string, string> }
  | { type: 'command'; command: string; args?: string[]; env?: Record<string, string> };

export interface McpServerConfig {
  id: string;
  transport: McpTransportConfig;
  allowedTools: McpAllowedToolConfig[];
}

export const MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'tavily-mcp',
    transport: {
      type: 'sse',
      url: 'https://mcp.api-inference.modelscope.net/15c14768246f4d/sse',
    },
    allowedTools: [],
  },
  {
    id: 'sequentialthinking',
    transport: {
      type: 'streamable_http',
      url: 'https://mcp.api-inference.modelscope.net/71d799d154fc42/mcp',
    },
    allowedTools: [],
  },
  {
    id: 'mcp-trends-hub',
    transport: {
      type: 'streamable_http',
      url: 'https://mcp.api-inference.modelscope.net/8a0471b0c6594b/mcp',
    },
    allowedTools: [],
  },
];
