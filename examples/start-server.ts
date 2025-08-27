import { startServer } from 'oas-mcp';

// Minimal example: start the HTTP SSE MCP server pointing at a public OpenAPI spec
// Usage (after building or using tsx):
//   npx tsx examples/start-server.ts
// Then visit: http://127.0.0.1:8080/sse?s=<ENCODED_SPEC_URL>&u=<BASE_API_URL>

async function main() {
  await startServer({ host: '127.0.0.1', port: 8080, debug: false });
  // Provide your own encoded spec URL & base URL as query params when connecting.
  console.log('Server running on http://127.0.0.1:8080');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
