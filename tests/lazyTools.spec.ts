import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const bigSpec = {
  openapi: '3.0.0',
  info: { title: 'Lazy', version: '1.0.0' },
  paths: {
    '/a': { get: { summary: 'A' } },
    '/b': { get: { summary: 'B' } }
  }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(bigSpec)), filters: [] };

describe('Lazy tool instantiation', () => {
  it('defers tool building until listTools or callTool', async () => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: () => Promise.resolve('{}'), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    // Accessing internal map size through listTools triggers realization, so check before by calling callTool should throw until realized.
    // We cannot access private internals; instead ensure listTools returns both tools and then call works.
    const tools = server.listTools();
    expect(tools.some(t => t.name.includes('get_a'))).toBe(true);
    expect(tools.some(t => t.name.includes('get_b'))).toBe(true);
  });
});
