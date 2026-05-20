import { MCP_SERVERS } from '@/lib/agents/mcp/config';

describe('default MCP config', () => {
  it('includes the default ModelScope MCP servers', () => {
    expect(MCP_SERVERS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'tavily-mcp',
          transport: {
            type: 'sse',
            url: 'https://mcp.api-inference.modelscope.net/15c14768246f4d/sse',
          },
          allowedTools: [],
        }),
        expect.objectContaining({
          id: 'sequentialthinking',
          transport: {
            type: 'streamable_http',
            url: 'https://mcp.api-inference.modelscope.net/71d799d154fc42/mcp',
          },
          allowedTools: [],
        }),
        expect.objectContaining({
          id: 'mcp-trends-hub',
          transport: {
            type: 'streamable_http',
            url: 'https://mcp.api-inference.modelscope.net/8a0471b0c6594b/mcp',
          },
          allowedTools: [],
        }),
      ])
    );
  });
});
