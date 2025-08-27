import { createMcpServer } from './tools/mcpServer.js';
import { parseRequestParams } from './util/params.js';

const sample = {
  openapi: '3.0.0',
  info: { title: 'Sample', version: '1.0.0' },
  paths: {
    '/hello/{name}': {
      get: {
        summary: 'Say hello',
        operationId: 'sayHello',
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'lang', in: 'query', required: false, schema: { type: 'string' } }
        ]
      }
    }
  }
};

async function main() {
  const schemaDataUrl = 'data:application/json,' + encodeURIComponent(JSON.stringify(sample));
  const params = await parseRequestParams({ s: schemaDataUrl, u: 'https://example.com' });
  const server = await createMcpServer(params, { debug: true });
  console.log('Tools:', server.listTools());
}
main().catch(e => { console.error(e); process.exit(1); });
