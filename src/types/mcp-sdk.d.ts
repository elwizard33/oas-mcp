declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  export class McpServer {
    constructor(meta: { name: string; version: string }, opts?: any);
    registerTool(name: string, config: any, handler: (args: any) => Promise<any>): void;
    connect(transport: any): Promise<void>;
    close?(): void;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport { constructor(opts?: any); }
}
