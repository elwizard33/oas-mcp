import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';
import { parseRequestParams } from '../src/util/params.js';

const sample = { openapi: '3.0.0', info: { title: 'S', version: '1.0.0' }, paths: { '/echo': { post: { summary: 'Echo', requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { msg: { type: 'string' } } } } } } } } } };

describe('MCP Server', () => {
  it('generates tool for endpoint', async () => {
    const schemaDataUrl = 'data:application/json,' + encodeURIComponent(JSON.stringify(sample));
    const params = await parseRequestParams({ s: schemaDataUrl, u: 'https://example.com' });
    const server = await createMcpServer(params, { debug: false });
    const tools = server.listTools();
    expect(tools.some(t => t.name.includes('post_echo'))).toBe(true);
  });
});
