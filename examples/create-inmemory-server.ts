import { createMcpServer } from 'oas-mcp';

// Programmatic example: create an MCP server instance without starting HTTP.
// You can integrate this directly into another host application.

async function main() {
  const server = await createMcpServer({
    schemaURL: 'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.json',
    baseURL: 'https://petstore3.swagger.io'
  } as any, { debug: true });

  const tools = server.listTools();
  console.log('Available tool names:', tools.map(t => t.name));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
